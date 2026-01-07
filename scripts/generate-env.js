const fs = require("node:fs/promises");
const path = require("node:path");

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseDotenv(contents) {
  const env = {};
  const lines = contents.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function readEnvFile(filePath) {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return parseDotenv(contents);
  } catch {
    return {};
  }
}

async function main() {
  const root = process.cwd();
  const fileEnv = await readEnvFile(path.join(root, ".env.local"));

  const forceEmpty = hasFlag("--force-empty") || hasFlag("--empty");
  const supabaseUrl = forceEmpty ? "" : process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = forceEmpty
    ? ""
    : process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY || "";

  // Validate required environment variables
  if (!forceEmpty && (!supabaseUrl || !supabaseAnonKey)) {
    console.warn("⚠️  Warning: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY should be set for cloud sync features");
    console.warn("   The app will run in local-only mode without these variables");
  }

  // Create a minimal env.js file for backwards compatibility (but without secrets)
  const out = `// Generated at build time. Environment variables are handled by Vite.
// This file is kept for backwards compatibility only.
window.__GARDEN_FENCE_ENV = {};
`;

  await fs.writeFile(path.join(root, "env.js"), out, "utf8");
  console.log("✓ Environment configuration validated");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
