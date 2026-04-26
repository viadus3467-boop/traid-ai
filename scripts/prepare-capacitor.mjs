import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, "www");

const filesToCopy = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "sw.js",
];

await rm(outDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
await mkdir(outDir, { recursive: true });

for (const file of filesToCopy) {
  await copyFile(path.join(root, file), path.join(outDir, file));
}

await cp(path.join(root, "assets"), path.join(outDir, "assets"), { recursive: true });

console.log("Prepared mobile web assets in ./www");
