#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const projectRoot = path.resolve(__dirname, "..");

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

function usage() {
  console.log(`Usage:
  node scripts/set_yangming_explanation_version.js list
  node scripts/set_yangming_explanation_version.js activate <version_id>
  node scripts/set_yangming_explanation_version.js legacy
  node scripts/set_yangming_explanation_version.js archive <version_id>
`);
}

function getClient() {
  loadLocalEnv();
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

async function listReleases(supabase) {
  const { data, error } = await supabase
    .from("yangming_explanation_releases")
    .select("version_id,label,status,is_active,rows_count,assets_count,storage_prefix,updated_at,activated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  console.table(data ?? []);
}

async function activateRelease(supabase, versionId) {
  const { data: target, error: targetError } = await supabase
    .from("yangming_explanation_releases")
    .select("version_id")
    .eq("version_id", versionId)
    .maybeSingle();
  if (targetError) throw targetError;
  if (!target) {
    throw new Error(`Release not found: ${versionId}`);
  }

  const now = new Date().toISOString();
  const { error: clearError } = await supabase
    .from("yangming_explanation_releases")
    .update({ is_active: false, status: "archived", updated_at: now })
    .eq("is_active", true);
  if (clearError) throw clearError;

  const { error: activateError } = await supabase
    .from("yangming_explanation_releases")
    .update({
      is_active: true,
      status: "active",
      activated_at: now,
      updated_at: now
    })
    .eq("version_id", versionId);
  if (activateError) throw activateError;
  console.log(`Activated Yangming release: ${versionId}`);
}

async function useLegacy(supabase) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("yangming_explanation_releases")
    .update({ is_active: false, status: "archived", updated_at: now })
    .eq("is_active", true);
  if (error) throw error;
  console.log("Yangming release disabled. API will fall back to legacy table.");
}

async function archiveRelease(supabase, versionId) {
  const { error } = await supabase
    .from("yangming_explanation_releases")
    .update({
      is_active: false,
      status: "archived",
      updated_at: new Date().toISOString()
    })
    .eq("version_id", versionId);
  if (error) throw error;
  console.log(`Archived Yangming release: ${versionId}`);
}

async function main() {
  const [command, versionId] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage();
    return;
  }
  const supabase = getClient();
  if (command === "list") {
    await listReleases(supabase);
    return;
  }
  if (command === "activate") {
    if (!versionId) throw new Error("activate requires a version_id.");
    await activateRelease(supabase, versionId);
    return;
  }
  if (command === "legacy") {
    await useLegacy(supabase);
    return;
  }
  if (command === "archive") {
    if (!versionId) throw new Error("archive requires a version_id.");
    await archiveRelease(supabase, versionId);
    return;
  }
  usage();
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
