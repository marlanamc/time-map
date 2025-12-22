const fs = require("node:fs/promises");
const path = require("node:path");

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

  const supabaseUrl = process.env.SUPABASE_URL || fileEnv.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || fileEnv.SUPABASE_ANON_KEY || "";

  const payload = {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
  };

  const out = `// Generated at build time. Do not edit.\nwindow.__GARDEN_FENCE_ENV = ${JSON.stringify(
    payload
  )};\n`;

  await fs.writeFile(path.join(root, "env.js"), out, "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

