#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const projectRoot = path.resolve(__dirname, "..");
const DEFAULT_SOURCE_PATH = path.join(
  projectRoot,
  "reports",
  "yangming_import_preview",
  "visual_full",
  "yangming_visual_consolidated_rows.json"
);
const DEFAULT_ASSET_ROOT = path.join(projectRoot, "reports", "yangming_import_preview", "visual_full");
const DEFAULT_BUCKET = "yangming-explanations";
const ROW_BATCH_SIZE = 200;
const ASSET_CONCURRENCY = Number(process.env.YANGMING_ASSET_CONCURRENCY || "2");
const ASSET_UPLOAD_RETRIES = Number(process.env.YANGMING_ASSET_UPLOAD_RETRIES || "4");
const SKIP_ASSET_UPLOAD = process.env.YANGMING_SKIP_ASSET_UPLOAD === "1";
const DRY_RUN = process.env.YANGMING_DRY_RUN === "1";

function assetKindFilter() {
  const rawFilter = process.env.YANGMING_ASSET_KIND_FILTER?.trim();
  if (!rawFilter) return null;
  const kinds = rawFilter
    .split(",")
    .map((kind) => kind.trim())
    .filter(Boolean);
  return kinds.length ? new Set(kinds) : null;
}

function filterAssetsByKind(assets, allowedKinds) {
  if (!Array.isArray(assets)) return [];
  if (!allowedKinds) return assets;
  return assets.filter((asset) => allowedKinds.has(String(asset.kind || "")));
}

function filterAssetsWithIndexMap(assets, allowedKinds) {
  if (!Array.isArray(assets)) return { assets: [], assetIndexMap: new Map() };
  const filteredAssets = [];
  const assetIndexMap = new Map();
  assets.forEach((asset, index) => {
    if (allowedKinds && !allowedKinds.has(String(asset?.kind || ""))) return;
    assetIndexMap.set(index, filteredAssets.length);
    filteredAssets.push(asset);
  });
  return { assets: filteredAssets, assetIndexMap };
}

function remapSections(sections, assetIndexMap, isFilteringAssets) {
  if (!Array.isArray(sections)) return [];
  return sections
    .map((section) => {
      if (!section || typeof section !== "object") return null;
      const nextSection = { ...section };
      if (typeof nextSection.assetIndex === "number") {
        const mappedIndex = assetIndexMap.get(nextSection.assetIndex);
        if (typeof mappedIndex !== "number") {
          return isFilteringAssets ? null : nextSection;
        }
        nextSection.assetIndex = mappedIndex;
      }
      return nextSection;
    })
    .filter(Boolean);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [rawKey, ...rest] = line.split("=");
    const key = rawKey.trim().replace(/^export\s+/, "");
    if (!key || process.env[key]?.trim()) continue;
    let value = rest.join("=").trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.trim()) {
      process.env[key] = value;
    }
  }
}

function loadLocalEnv() {
  [
    ".env.yangming-import.local",
    ".env.local",
    ".env.production.local",
    path.join(".vercel", ".env.production.local")
  ].forEach((relativePath) => loadEnvFile(path.join(projectRoot, relativePath)));
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeStoragePrefix(prefix) {
  return String(prefix || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function withStoragePrefix(objectPath, storagePrefix) {
  const normalizedPath = String(objectPath || "").trim().replace(/^\/+/g, "");
  if (!normalizedPath) return "";
  return storagePrefix ? `${storagePrefix}/${normalizedPath}` : normalizedPath;
}

function sanitizeForPostgres(value) {
  if (typeof value === "string") {
    return value.replace(/\u0000/g, "").replace(/\\u0000/gi, "");
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForPostgres(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeForPostgres(item)])
    );
  }
  return value;
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryUpload(worker, label) {
  let lastError;
  for (let attempt = 1; attempt <= ASSET_UPLOAD_RETRIES; attempt += 1) {
    try {
      return await worker();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === ASSET_UPLOAD_RETRIES) break;
      const delay = 800 * attempt * attempt;
      console.warn(`upload retry ${attempt}/${ASSET_UPLOAD_RETRIES - 1} for ${label}: ${message}`);
      await wait(delay);
    }
  }
  throw lastError;
}

function toDbRow(row, storagePrefix = "", allowedAssetKinds = null) {
  const { assets: filteredAssets, assetIndexMap } = filterAssetsWithIndexMap(row.assets, allowedAssetKinds);
  const assets = filteredAssets
    .map((asset) => ({
        ...asset,
        // src is stored as the Storage object path; the API maps it to a public URL.
        src: typeof asset.src === "string" ? withStoragePrefix(asset.src, storagePrefix) : ""
      }))
    ;
  const sections = remapSections(row.sections, assetIndexMap, Boolean(allowedAssetKinds));

  return sanitizeForPostgres({
    question_id: row.question_id,
    body: row.body || "",
    author: row.author || null,
    reviewer: row.reviewer || null,
    source_label: row.source_label || null,
    source_file: row.source_file || null,
    source_page_start: row.source_page_start || null,
    source_page_end: row.source_page_end || null,
    question_stem_snapshot: row.question_stem_snapshot || null,
    answer_snapshot: row.answer_snapshot || null,
    sections,
    assets,
    match_status: row.match_status || null,
    match_score:
      typeof row.match_score === "number"
        ? row.match_score
        : row.match_score
          ? Number(row.match_score)
          : null,
    updated_at: new Date().toISOString()
  });
}

function collectAssets(rows, assetRoot, storagePrefix = "", allowedAssetKinds = null) {
  const unique = new Map();
  for (const row of rows) {
    for (const asset of filterAssetsByKind(row.assets, allowedAssetKinds)) {
      const objectPath = typeof asset.src === "string" ? asset.src.trim() : "";
      if (!objectPath || /^(?:https?:)?\/\//i.test(objectPath) || objectPath.startsWith("/")) continue;
      const filePath = path.join(assetRoot, objectPath);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing asset file for ${row.question_id}: ${objectPath}`);
      }
      const storageObjectPath = withStoragePrefix(objectPath, storagePrefix);
      if (!unique.has(storageObjectPath)) {
        unique.set(storageObjectPath, filePath);
      }
    }
  }
  return Array.from(unique.entries()).map(([objectPath, filePath]) => ({ objectPath, filePath }));
}

async function ensureBucket(supabase, bucket) {
  const { error } = await retryUpload(() => supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 52_428_800,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"]
  }), `create bucket ${bucket}`);

  if (error && !String(error.message || "").toLowerCase().includes("already exists")) {
    throw error;
  }

  const { error: updateError } = await retryUpload(() => supabase.storage.updateBucket(bucket, {
    public: true,
    fileSizeLimit: 52_428_800,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"]
  }), `update bucket ${bucket}`);
  if (updateError && !String(updateError.message || "").toLowerCase().includes("not found")) {
    throw updateError;
  }
}

async function uploadOneAsset(supabase, bucket, asset) {
  const body = fs.readFileSync(asset.filePath);
  const { error } = await supabase.storage.from(bucket).upload(asset.objectPath, body, {
    contentType: contentTypeFor(asset.filePath),
    upsert: true
  });
  if (error) {
    throw error;
  }
}

async function uploadAssets(supabase, bucket, assets) {
  let uploaded = 0;
  await runPool(assets, ASSET_CONCURRENCY, async (asset) => {
    await retryUpload(() => uploadOneAsset(supabase, bucket, asset), asset.objectPath);
    uploaded += 1;
    if (uploaded % 100 === 0 || uploaded === assets.length) {
      console.log(`uploaded assets ${uploaded}/${assets.length}`);
    }
  });
}

function dirnameForStorageObject(objectPath) {
  const index = objectPath.lastIndexOf("/");
  return index >= 0 ? objectPath.slice(0, index) : "";
}

async function listExistingAssetsInDirectory(supabase, bucket, directory) {
  const existing = new Set();
  const limit = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await retryUpload(() => supabase.storage.from(bucket).list(directory, {
      limit,
      offset
    }), `list existing assets ${directory || "/"}`);
    if (error) throw error;
    const rows = data ?? [];
    for (const item of rows) {
      if (!item.id) continue;
      existing.add(directory ? `${directory}/${item.name}` : item.name);
    }
    if (rows.length < limit) break;
    offset += limit;
  }

  return existing;
}

async function filterExistingAssets(supabase, bucket, assets) {
  if (process.env.YANGMING_SKIP_EXISTING_ASSETS === "0") return assets;
  const directories = Array.from(new Set(assets.map((asset) => dirnameForStorageObject(asset.objectPath))));
  const existing = new Set();
  let scanned = 0;

  for (const directory of directories) {
    const directoryExisting = await listExistingAssetsInDirectory(supabase, bucket, directory);
    for (const objectPath of directoryExisting) {
      existing.add(objectPath);
    }
    scanned += 1;
    if (scanned % 50 === 0 || scanned === directories.length) {
      console.log(`scanned existing asset folders ${scanned}/${directories.length}`);
    }
  }

  const pending = assets.filter((asset) => !existing.has(asset.objectPath));
  console.log(`existing assets: ${assets.length - pending.length}/${assets.length}`);
  return pending;
}

async function upsertRows(supabase, rows, storagePrefix = "", allowedAssetKinds = null) {
  const batches = chunk(rows.map((row) => toDbRow(row, storagePrefix, allowedAssetKinds)), ROW_BATCH_SIZE);
  let upserted = 0;
  for (const batch of batches) {
    const { error } = await supabase
      .from("yangming_question_explanations")
      .upsert(batch, { onConflict: "question_id" });
    if (error) throw error;
    upserted += batch.length;
    console.log(`upserted explanations ${upserted}/${rows.length}`);
  }
}

async function main() {
  loadLocalEnv();
  const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SOURCE_PATH;
  const assetRoot = process.env.YANGMING_ASSET_ROOT
    ? path.resolve(process.env.YANGMING_ASSET_ROOT)
    : DEFAULT_ASSET_ROOT;
  const bucket = process.env.YANGMING_EXPLANATION_BUCKET || DEFAULT_BUCKET;
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const key = serviceRoleKey || requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const storagePrefix = normalizeStoragePrefix(process.env.YANGMING_STORAGE_PREFIX);
  const importToken = process.env.YANGMING_IMPORT_TOKEN?.trim();
  const allowedAssetKinds = assetKindFilter();

  const rows = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  if (!Array.isArray(rows)) {
    throw new Error("Yangming import source must be a JSON array.");
  }

  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: importToken
      ? {
          headers: {
            "x-yangming-import-token": importToken
          }
        }
      : undefined
  });

  const assets = collectAssets(rows, assetRoot, storagePrefix, allowedAssetKinds);
  console.log(`import source: ${sourcePath}`);
  console.log(`rows: ${rows.length}`);
  console.log(`assets: ${assets.length}`);
  console.log(`bucket: ${bucket}`);
  if (DRY_RUN) console.log("dry run: enabled; no assets or rows will be written");
  if (SKIP_ASSET_UPLOAD) console.log("asset upload: skipped");
  if (storagePrefix) console.log(`storage prefix: ${storagePrefix}`);
  if (allowedAssetKinds) console.log(`asset kind filter: ${Array.from(allowedAssetKinds).join(", ")}`);

  if (DRY_RUN) {
    const assetKindCounts = rows.reduce((counts, row) => {
      for (const asset of filterAssetsByKind(row.assets, allowedAssetKinds)) {
        const kind = String(asset?.kind || "unknown");
        counts[kind] = (counts[kind] || 0) + 1;
      }
      return counts;
    }, {});
    console.log(`asset kind counts: ${JSON.stringify(assetKindCounts)}`);
    console.log("Yangming import dry run complete.");
    return;
  }

  if (!SKIP_ASSET_UPLOAD) {
    if (serviceRoleKey) {
      await ensureBucket(supabase, bucket);
    }
    const pendingAssets = await filterExistingAssets(supabase, bucket, assets);
    await uploadAssets(supabase, bucket, pendingAssets);
  }
  await upsertRows(supabase, rows, storagePrefix, allowedAssetKinds);
  console.log("Yangming explanations import complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
