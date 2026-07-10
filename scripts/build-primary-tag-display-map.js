const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const assignmentsPath = path.join(
  projectRoot,
  "data",
  "analysisPrimaryTagAssignments.json"
);
const outputPath = path.join(
  projectRoot,
  "data",
  "analysisPrimaryTagDisplayMap.json"
);

function main() {
  const payload = JSON.parse(fs.readFileSync(assignmentsPath, "utf8"));
  const entries = Object.entries(payload.assignments ?? {});
  const displayMap = Object.fromEntries(
    entries.map(([questionId, assignment]) => {
      const primaryTag = assignment?.primaryTag?.trim() || null;

      return [questionId, primaryTag];
    })
  );

  if (Object.keys(displayMap).length !== 6200) {
    throw new Error(`顯示標籤題數不符：${Object.keys(displayMap).length}`);
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(displayMap)}\n`);
  console.log(`Output: ${outputPath}`);
  console.log(`Questions: ${Object.keys(displayMap).length}`);
}

main();
