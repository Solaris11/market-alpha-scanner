import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const src = join(root, "src");
const testFiles = findTestFiles(src);

if (testFiles.length === 0) {
  console.log("No frontend tests found.");
  process.exit(0);
}

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(executable, ["tsx", "--test", ...testFiles], {
  cwd: root,
  stdio: "inherit",
});

process.exit(result.status ?? 1);

function findTestFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...findTestFiles(path));
    } else if (entry.endsWith(".test.ts")) {
      files.push(path);
    }
  }
  return files;
}
