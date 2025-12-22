const fs = require("node:fs/promises");
const path = require("node:path");

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyFileIfExists(src, dest) {
  if (!(await exists(src))) return;
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

async function copyDirIfExists(srcDir, destDir) {
  if (!(await exists(srcDir))) return;
  await ensureDir(destDir);

  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const src = path.join(srcDir, entry.name);
      const dest = path.join(destDir, entry.name);
      if (entry.isDirectory()) return copyDirIfExists(src, dest);
      if (entry.isFile()) return copyFileIfExists(src, dest);
    })
  );
}

async function main() {
  const root = process.cwd();
  const publicDir = path.join(root, "public");

  await ensureDir(publicDir);

  // HTML
  await copyFileIfExists(path.join(root, "dist", "index.html"), path.join(publicDir, "index.html"));
  await copyFileIfExists(path.join(root, "index.html"), path.join(publicDir, "index.html"));

  // Core assets
  await copyFileIfExists(path.join(root, "styles.css"), path.join(publicDir, "styles.css"));
  await copyFileIfExists(path.join(root, "styles.min.css"), path.join(publicDir, "styles.min.css"));
  await copyFileIfExists(path.join(root, "sw.js"), path.join(publicDir, "sw.js"));
  await copyFileIfExists(path.join(root, "manifest.webmanifest"), path.join(publicDir, "manifest.webmanifest"));

  // Bundles
  await copyDirIfExists(path.join(root, "dist"), path.join(publicDir, "dist"));
  await copyFileIfExists(path.join(root, "app.min.js"), path.join(publicDir, "app.min.js"));

  // Icons
  await copyDirIfExists(path.join(root, "icons"), path.join(publicDir, "icons"));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

