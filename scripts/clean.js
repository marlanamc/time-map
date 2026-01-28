const { rmSync } = require("fs");
const { join } = require("path");

const targets = ["node_modules/.vite", "dist"];

targets.forEach((relativePath) => {
  try {
    rmSync(join(process.cwd(), relativePath), { recursive: true, force: true });
    console.log(`[clean] removed ${relativePath}`);
  } catch (error) {
    console.warn(
      `[clean] unable to remove ${relativePath} (it might not exist):`,
      error,
    );
  }
});
