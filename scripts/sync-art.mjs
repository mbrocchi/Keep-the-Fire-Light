// Copies the user's artwork from Mockup/ into public/art/ with normalised
// lowercase names, so the app always serves the local source files.
// Runs automatically via `predev` / `prebuild`.
import { mkdir, copyFile, stat, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "Mockup");
const dest = join(root, "public", "art");

// Source name (as it exists on disk) -> served name.
const MAP = {
  "Background.png": "background.png",
  "title.png": "title.png",
  "logo.png": "logo.png",
};

async function newer(a, b) {
  try {
    const [sa, sb] = await Promise.all([stat(a), stat(b)]);
    return sa.mtimeMs > sb.mtimeMs;
  } catch {
    return true; // dest missing
  }
}

async function main() {
  let available;
  try {
    available = await readdir(src);
  } catch {
    console.error(`\n  [sync-art] Cannot read ${src}\n`);
    process.exit(1);
  }

  await mkdir(dest, { recursive: true });

  for (const [from, to] of Object.entries(MAP)) {
    // Tolerate case drift in the source folder (Background.png vs background.png).
    const actual = available.find((f) => f.toLowerCase() === from.toLowerCase());
    if (!actual) {
      console.error(`  [sync-art] MISSING: Mockup/${from}`);
      process.exitCode = 1;
      continue;
    }
    const a = join(src, actual);
    const b = join(dest, to);
    if (await newer(a, b)) {
      await copyFile(a, b);
      console.log(`  [sync-art] Mockup/${actual} -> public/art/${to}`);
    }
  }
}

main();
