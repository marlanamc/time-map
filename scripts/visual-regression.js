#!/usr/bin/env node

/**
 * Visual Regression Testing Script
 * Compares screenshots and detects visual changes
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const pixelmatch = require("pixelmatch");
const PNG = require("pngjs").PNG;

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

class VisualRegressionTester {
  constructor() {
    this.testResults = [];
    this.screenshotDir = "test-results/visual-regression";
    this.baselineDir = "test-results/visual-regression/baseline";
    this.diffDir = "test-results/visual-regression/diff";
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.screenshotDir, this.baselineDir, this.diffDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  readPNG(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      return PNG.sync.read(buffer);
    } catch (error) {
      throw new Error(`Failed to read PNG: ${filePath}`);
    }
  }

  writePNG(png, filePath) {
    try {
      const buffer = PNG.sync.write(png);
      fs.writeFileSync(filePath, buffer);
    } catch (error) {
      throw new Error(`Failed to write PNG: ${filePath}`);
    }
  }

  compareScreenshots(baselinePath, currentPath, diffPath) {
    const baseline = this.readPNG(baselinePath);
    const current = this.readPNG(currentPath);

    const width = Math.max(baseline.width, current.width);
    const height = Math.max(baseline.height, current.height);

    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(
      baseline.data,
      current.data,
      diff.data,
      { width, height },
      { threshold: 0.1, includeAA: true }
    );

    this.writePNG(diff, diffPath);

    return {
      numDiffPixels,
      totalPixels: width * height,
      percentageDiff: (numDiffPixels / (width * height)) * 100,
      width,
      height,
    };
  }

  generateDiffImage(baselinePath, currentPath, diffPath, comparison) {
    const baseline = this.readPNG(baselinePath);
    const current = this.readPNG(currentPath);

    const width = comparison.width;
    const height = comparison.height;

    const diff = new PNG({ width, height });

    // Create a side-by-side comparison
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const baselineIdx = (y * width + x) << 2;
        const currentIdx = (y * width + x) << 2;
        const diffIdx = (y * width + x) << 2;

        const baselineR = baseline.data[baselineIdx];
        const baselineG = baseline.data[baselineIdx + 1];
        const baselineB = baseline.data[baselineIdx + 2];
        const baselineA = baseline.data[baselineIdx + 3];

        const currentR = current.data[currentIdx];
        const currentG = current.data[currentIdx + 1];
        const currentB = current.data[currentIdx + 2];
        const currentA = current.data[currentIdx + 3];

        // Highlight differences in red
        if (diff.data[diffIdx] === 255) {
          diff.data[diffIdx] = 255; // Red
          diff.data[diffIdx + 1] = 0; // Green
          diff.data[diffIdx + 2] = 0; // Blue
          diff.data[diffIdx + 3] = 255; // Alpha
        } else {
          // Show current image with reduced opacity
          diff.data[diffIdx] = currentR * 0.7;
          diff.data[diffIdx + 1] = currentG * 0.7;
          diff.data[diffIdx + 2] = currentB * 0.7;
          diff.data[diffIdx + 3] = currentA;
        }
      }
    }

    this.writePNG(diff, diffPath);
  }

  async runTest(testName, config = {}) {
    const {
      url = "http://localhost:4173",
      viewport = { width: 1280, height: 720 },
      selector = "body",
      threshold = 0.1,
      timeout = 10000,
    } = config;

    logInfo(`Running visual regression test: ${testName}`);

    try {
      // Take current screenshot
      const currentPath = path.join(
        this.screenshotDir,
        `${testName}-current.png`
      );
      const baselinePath = path.join(
        this.baselineDir,
        `${testName}-baseline.png`
      );
      const diffPath = path.join(this.diffDir, `${testName}-diff.png`);

      // Use Playwright to take screenshot
      const screenshotCommand = `npx playwright screenshot ${url} --viewport=${viewport.width}x${viewport.height} --selector=${selector} ${currentPath}`;
      execSync(screenshotCommand, { stdio: "pipe" });

      // Check if baseline exists
      if (!fs.existsSync(baselinePath)) {
        logWarning(`No baseline found for ${testName}. Creating baseline...`);
        fs.copyFileSync(currentPath, baselinePath);

        this.testResults.push({
          testName,
          status: "baseline_created",
          numDiffPixels: 0,
          percentageDiff: 0,
          message: "Baseline created",
        });

        return { status: "baseline_created", message: "Baseline created" };
      }

      // Compare screenshots
      const comparison = this.compareScreenshots(
        baselinePath,
        currentPath,
        diffPath
      );

      // Generate enhanced diff image
      this.generateDiffImage(baselinePath, currentPath, diffPath, comparison);

      const passed = comparison.percentageDiff <= threshold;

      const result = {
        testName,
        status: passed ? "passed" : "failed",
        numDiffPixels: comparison.numDiffPixels,
        percentageDiff: comparison.percentageDiff,
        threshold,
        message: passed
          ? "No visual changes detected"
          : `Visual changes detected: ${comparison.percentageDiff.toFixed(2)}%`,
      };

      this.testResults.push(result);

      if (passed) {
        logSuccess(`${testName}: ${result.message}`);
      } else {
        logError(`${testName}: ${result.message}`);
        logInfo(
          `Diff pixels: ${comparison.numDiffPixels} / ${comparison.totalPixels}`
        );
        logInfo(`Diff image: ${diffPath}`);
      }

      return result;
    } catch (error) {
      logError(`Test failed: ${testName} - ${error.message}`);

      const result = {
        testName,
        status: "error",
        numDiffPixels: 0,
        percentageDiff: 0,
        threshold,
        message: error.message,
      };

      this.testResults.push(result);
      return result;
    }
  }

  async runAllTests(testConfigs = []) {
    logInfo("Starting visual regression tests...");

    const defaultTests = [
      {
        name: "home-view-desktop",
        url: "http://localhost:4173",
        viewport: { width: 1280, height: 720 },
        selector: "#app",
      },
      {
        name: "home-view-mobile",
        url: "http://localhost:4173",
        viewport: { width: 375, height: 667 },
        selector: "#app",
      },
      {
        name: "garden-view",
        url: "http://localhost:4173",
        viewport: { width: 1280, height: 720 },
        selector: "#app",
      },
      {
        name: "day-view",
        url: "http://localhost:4173",
        viewport: { width: 1280, height: 720 },
        selector: "#app",
      },
    ];

    const tests = testConfigs.length > 0 ? testConfigs : defaultTests;

    for (const test of tests) {
      await this.runTest(test.name, test);
    }

    this.generateReport();
  }

  generateReport() {
    const passed = this.testResults.filter((r) => r.status === "passed").length;
    const failed = this.testResults.filter((r) => r.status === "failed").length;
    const errors = this.testResults.filter((r) => r.status === "error").length;
    const baselineCreated = this.testResults.filter(
      (r) => r.status === "baseline_created"
    ).length;

    const report = `
# Visual Regression Test Report
Generated on: ${new Date().toISOString()}

## Summary
- Total Tests: ${this.testResults.length}
- ✅ Passed: ${passed}
- ❌ Failed: ${failed}
- 🚨 Errors: ${errors}
- 📸 Baselines Created: ${baselineCreated}

## Test Results
${this.testResults
  .map((result) => {
    const icon =
      result.status === "passed"
        ? "✅"
        : result.status === "failed"
        ? "❌"
        : result.status === "error"
        ? "🚨"
        : "📸";

    return `${icon} **${result.testName}**
- Status: ${result.status}
- Difference: ${result.percentageDiff.toFixed(2)}%
- Threshold: ${result.threshold}%
- Message: ${result.message}`;
  })
  .join("\n\n")}

## Recommendations
${
  failed > 0
    ? `
- Review failed tests and update baselines if changes are expected
- Check diff images in ${this.diffDir} for visual changes
- Consider updating thresholds if differences are acceptable
`
    : ""
}
${
  errors > 0
    ? `
- Fix test errors before proceeding
- Check server is running and accessible
- Verify test configuration
`
    : ""
}
${
  baselineCreated > 0
    ? `
- Review newly created baselines
- Commit new baselines to version control
- Ensure baselines represent correct state
`
    : ""
}

## Next Steps
1. Review any failed tests
2. Update baselines if changes are expected
3. Fix any errors
4. Re-run tests to verify fixes
    `.trim();

    fs.writeFileSync("test-results/visual-regression/report.md", report);
    logSuccess(
      "Visual regression report generated: test-results/visual-regression/report.md"
    );

    return {
      total: this.testResults.length,
      passed,
      failed,
      errors,
      baselineCreated,
    };
  }

  updateBaseline(testName) {
    const currentPath = path.join(
      this.screenshotDir,
      `${testName}-current.png`
    );
    const baselinePath = path.join(
      this.baselineDir,
      `${testName}-baseline.png`
    );

    if (fs.existsSync(currentPath)) {
      fs.copyFileSync(currentPath, baselinePath);
      logSuccess(`Baseline updated for ${testName}`);
      return true;
    } else {
      logError(`No current screenshot found for ${testName}`);
      return false;
    }
  }

  updateAllBaselines() {
    logInfo("Updating all baselines...");

    const tests = this.testResults.map((r) => r.testName);
    let updated = 0;

    for (const testName of tests) {
      if (this.updateBaseline(testName)) {
        updated++;
      }
    }

    logInfo(`Updated ${updated} baselines`);
    return updated;
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const tester = new VisualRegressionTester();

  switch (command) {
    case "run":
      const testConfigs = args.slice(1).map((arg) => {
        try {
          return JSON.parse(arg);
        } catch {
          return { name: arg };
        }
      });
      tester.runAllTests(testConfigs);
      break;

    case "update-baseline":
      const testName = args[1];
      if (testName) {
        tester.updateBaseline(testName);
      } else {
        tester.updateAllBaselines();
      }
      break;

    default:
      logInfo("Usage:");
      logInfo(
        "  npm run visual:run [testConfig...] - Run visual regression tests"
      );
      logInfo(
        "  npm run visual:update-baseline [testName] - Update baseline(s)"
      );
      logInfo("");
      logInfo("Example test config:");
      logInfo(
        '  npm run visual:run \'{"name":"home","url":"http://localhost:4173","selector":"#app"}\''
      );
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}
