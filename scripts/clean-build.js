const fs = require("node:fs/promises");
const path = require("node:path");

async function rmrf(targetPath) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

async function main() {
  const root = process.cwd();
  await rmrf(path.join(root, "dist"));
  await rmrf(path.join(root, "public"));
  await rmrf(path.join(root, "app.min.js"));
  await rmrf(path.join(root, "styles.min.css"));
  await rmrf(path.join(root, "env.js"));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

