#!/usr/bin/env node

/**
 * Security Scanning Script
 * Runs various security checks on the codebase
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ANSI colors for output
const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  reset: "\x1b[0m",
};

function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function runCommand(command, description) {
  logInfo(`Running: ${description}`);
  try {
    const output = execSync(command, { encoding: "utf8", stdio: "pipe" });
    logSuccess(description);
    return output;
  } catch (error) {
    logError(`${description} failed`);
    return error.stdout || error.stderr || "Unknown error";
  }
}

function checkForHardcodedSecrets() {
  logInfo("Checking for hardcoded secrets...");

  const secretPatterns = [
    /password\s*=\s*['"`][^'"`]+['"`]/gi,
    /api[_-]?key\s*=\s*['"`][^'"`]+['"`]/gi,
    /secret[_-]?key\s*=\s*['"`][^'"`]+['"`]/gi,
    /token\s*=\s*['"`][^'"`]+['"`]/gi,
    /auth[_-]?token\s*=\s*['"`][^'"`]+['"`]/gi,
    /private[_-]?key\s*=\s*['"`][^'"`]+['"`]/gi,
    /access[_-]?token\s*=\s*['"`][^'"`]+['"`]/gi,
    /refresh[_-]?token\s*=\s*['"`][^'"`]+['"`]/gi,
    /client[_-]?secret\s*=\s*['"`][^'"`]+['"`]/gi,
    /database[_-]?url\s*=\s*['"`][^'"`]+['"`]/gi,
  ];

  const filesToCheck = [
    "src/**/*.ts",
    "src/**/*.js",
    "src/**/*.json",
    ".env*",
    "config/**/*.js",
    "config/**/*.ts",
  ];

  let foundSecrets = false;

  filesToCheck.forEach((pattern) => {
    try {
      const files = execSync(
        `find . -name "${pattern}" -not -path "./node_modules/*" -not -path "./dist/*"`,
        { encoding: "utf8" }
      )
        .trim()
        .split("\n")
        .filter(Boolean);

      files.forEach((file) => {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, "utf8");
          const lines = content.split("\n");

          lines.forEach((line, index) => {
            secretPatterns.forEach((pattern) => {
              if (pattern.test(line)) {
                logError(`Potential secret found in ${file}:${index + 1}`);
                logError(`  ${line.trim()}`);
                foundSecrets = true;
              }
            });
          });
        }
      });
    } catch (error) {
      // Ignore file not found errors
    }
  });

  if (!foundSecrets) {
    logSuccess("No hardcoded secrets found");
  }

  return foundSecrets;
}

function checkDependencies() {
  logInfo("Checking dependencies for vulnerabilities...");

  try {
    const auditOutput = runCommand("npm audit --json", "npm audit");
    const auditData = JSON.parse(auditOutput);

    const vulnerabilities = auditData.vulnerabilities || {};
    const totalVulns = Object.keys(vulnerabilities).length;

    if (totalVulns === 0) {
      logSuccess("No vulnerabilities found");
    } else {
      logWarning(`Found ${totalVulns} vulnerabilities`);

      // Categorize vulnerabilities
      const critical = Object.values(vulnerabilities).filter(
        (v) => v.severity === "critical"
      ).length;
      const high = Object.values(vulnerabilities).filter(
        (v) => v.severity === "high"
      ).length;
      const moderate = Object.values(vulnerabilities).filter(
        (v) => v.severity === "moderate"
      ).length;
      const low = Object.values(vulnerabilities).filter(
        (v) => v.severity === "low"
      ).length;

      if (critical > 0) logError(`Critical: ${critical}`);
      if (high > 0) logError(`High: ${high}`);
      if (moderate > 0) logWarning(`Moderate: ${moderate}`);
      if (low > 0) logInfo(`Low: ${low}`);
    }

    return totalVulns;
  } catch (error) {
    logError("Failed to run npm audit");
    return -1;
  }
}

function checkOutdatedDependencies() {
  logInfo("Checking for outdated dependencies...");

  try {
    const outdatedOutput = runCommand("npm outdated", "npm outdated");

    if (outdatedOutput.trim() === "") {
      logSuccess("All dependencies are up to date");
      return 0;
    } else {
      logWarning("Found outdated dependencies");
      logInfo(outdatedOutput);
      return 1;
    }
  } catch (error) {
    logError("Failed to check for outdated dependencies");
    return -1;
  }
}

function checkFilePermissions() {
  logInfo("Checking file permissions...");

  const sensitiveFiles = [
    ".env*",
    "config/*.json",
    "src/config/*.ts",
    "src/config/*.js",
  ];

  let issues = 0;

  sensitiveFiles.forEach((pattern) => {
    try {
      const files = execSync(
        `find . -name "${pattern}" -not -path "./node_modules/*" -not -path "./dist/*"`,
        { encoding: "utf8" }
      )
        .trim()
        .split("\n")
        .filter(Boolean);

      files.forEach((file) => {
        if (fs.existsSync(file)) {
          const stats = fs.statSync(file);
          const mode = (stats.mode & parseInt("777", 8)).toString(8);

          // Check if file is readable by others
          if (mode[6] !== "0") {
            logWarning(`File ${file} is readable by others (mode: ${mode})`);
            issues++;
          }

          // Check if file is writable by others
          if (mode[7] !== "0") {
            logError(`File ${file} is writable by others (mode: ${mode})`);
            issues++;
          }
        }
      });
    } catch (error) {
      // Ignore file not found errors
    }
  });

  if (issues === 0) {
    logSuccess("File permissions are secure");
  }

  return issues;
}

function checkPackageScripts() {
  logInfo("Checking package.json scripts for security...");

  try {
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
    const scripts = packageJson.scripts || {};

    let issues = 0;

    // Check for potentially dangerous commands
    const dangerousPatterns = [
      /rm\s+-rf/,
      /sudo/,
      /chmod\s+777/,
      /eval/,
      /exec/,
      /curl.*\|.*sh/,
      /wget.*\|.*sh/,
    ];

    Object.entries(scripts).forEach(([name, command]) => {
      dangerousPatterns.forEach((pattern) => {
        if (pattern.test(command)) {
          logError(
            `Potentially dangerous command in script "${name}": ${command}`
          );
          issues++;
        }
      });
    });

    if (issues === 0) {
      logSuccess("Package scripts are secure");
    }

    return issues;
  } catch (error) {
    logError("Failed to check package.json");
    return -1;
  }
}

function checkEnvironmentVariables() {
  logInfo("Checking environment variable usage...");

  try {
    const envExample = fs.readFileSync(".env.example", "utf8");
    const lines = envExample.split("\n");

    let issues = 0;

    lines.forEach((line, index) => {
      // Check for actual values instead of placeholders
      if (
        line.includes("=") &&
        !line.includes("YOUR_") &&
        !line.includes("EXAMPLE_")
      ) {
        const [key, value] = line.split("=");
        if (value && value !== "" && value !== '""' && value !== "''") {
          logWarning(
            `Potential real value in .env.example line ${index + 1}: ${key}`
          );
          issues++;
        }
      }
    });

    if (issues === 0) {
      logSuccess("Environment variables are properly configured");
    }

    return issues;
  } catch (error) {
    logWarning("No .env.example file found");
    return 0;
  }
}

function generateReport(results) {
  const report = `
# Security Scan Report
Generated on: ${new Date().toISOString()}

## Summary
- Hardcoded Secrets: ${results.secrets ? "❌ Found" : "✅ None"}
- Vulnerabilities: ${
    results.vulnerabilities === -1
      ? "❌ Error"
      : results.vulnerabilities === 0
      ? "✅ None"
      : `⚠️ ${results.vulnerabilities}`
  }
- Outdated Dependencies: ${
    results.outdated === -1
      ? "❌ Error"
      : results.outdated === 0
      ? "✅ None"
      : "⚠️ Found"
  }
- File Permissions: ${
    results.permissions === 0 ? "✅ Secure" : `⚠️ ${results.permissions} issues`
  }
- Package Scripts: ${
    results.scripts === 0 ? "✅ Secure" : `⚠️ ${results.scripts} issues`
  }
- Environment Variables: ${
    results.envVars === 0 ? "✅ Secure" : `⚠️ ${results.envVars} issues`
  }

## Recommendations
${
  results.secrets
    ? "- Remove hardcoded secrets and use environment variables\n"
    : ""
}
${
  results.vulnerabilities > 0
    ? "- Run npm audit fix to update vulnerable dependencies\n"
    : ""
}
${
  results.outdated > 0 ? "- Update outdated dependencies with npm update\n" : ""
}
${results.permissions > 0 ? "- Review and fix file permissions\n" : ""}
${results.scripts > 0 ? "- Review package scripts for security\n" : ""}
${
  results.envVars > 0
    ? "- Ensure .env.example contains only placeholder values\n"
    : ""
}

## Security Score
${calculateSecurityScore(results)}/10
  `.trim();

  fs.writeFileSync("security-report.md", report);
  logSuccess("Security report generated: security-report.md");
}

function calculateSecurityScore(results) {
  let score = 10;

  if (results.secrets) score -= 3;
  if (results.vulnerabilities > 0)
    score -= Math.min(3, results.vulnerabilities);
  if (results.outdated > 0) score -= 1;
  if (results.permissions > 0) score -= 1;
  if (results.scripts > 0) score -= 1;
  if (results.envVars > 0) score -= 1;

  return Math.max(0, score);
}

function main() {
  log("🔒 Vision Board Security Scan", colors.cyan);
  log("================================", colors.cyan);

  const results = {
    secrets: checkForHardcodedSecrets(),
    vulnerabilities: checkDependencies(),
    outdated: checkOutdatedDependencies(),
    permissions: checkFilePermissions(),
    scripts: checkPackageScripts(),
    envVars: checkEnvironmentVariables(),
  };

  generateReport(results);

  const score = calculateSecurityScore(results);

  if (score >= 8) {
    logSuccess(`Security scan completed! Score: ${score}/10`);
  } else if (score >= 6) {
    logWarning(`Security scan completed with warnings. Score: ${score}/10`);
  } else {
    logError(`Security scan completed with issues. Score: ${score}/10`);
  }

  process.exit(score >= 6 ? 0 : 1);
}

if (require.main === module) {
  main();
}
