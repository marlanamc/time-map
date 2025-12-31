// Opt-in CSS purging for production builds.
// Enable with `PURGE_CSS=1 npm run build:purge`.
const purgecssImport = require("@fullhuman/postcss-purgecss");
const purgecss = purgecssImport?.default || purgecssImport;

const isEnabled = process.env.PURGE_CSS === "1";

const extractor = (content) => content.match(/[\w-/:]+(?<!:)/g) || [];

module.exports = isEnabled
  ? {
      plugins: [
        purgecss({
          content: ["index.html", "src/**/*.ts"],
          defaultExtractor: extractor,
          safelist: {
            standard: [
              "dark-mode",
              "light-mode",
              "is-mobile",
              "mobile-home-view",
              "mobile-date-nav-in-header",
              "active",
              "expanded",
              "hidden",
              "unlocked",
              "completed",
              "checked",
              "open",
              "ready",
              "loading",
              "syncing",
              "synced",
              "error",
              "offline",
            ],
            deep: [
              /^time-/,
              /^season-/,
              /^accent-/,
              /^cat-/,
              /^priority-/,
              /^view-/,
              /^modal/,
              /^toast/,
              /^support-panel/,
              /^day-/,
              /^planner-/,
              /^week-/,
              /^month-/,
              /^year-/,
              /^canvas/,
            ],
            greedy: [
              // Keep SVG/icon and animation utility classes
              /icon/,
              /fade/,
              /slide/,
              /pulse/,
            ],
          },
        }),
      ],
    }
  : {};
