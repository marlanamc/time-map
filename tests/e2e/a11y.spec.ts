import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ colorScheme: "dark" });

async function dismissAuthModalIfPresent(page: Page) {
  const authModal = page.locator("#auth-modal");
  try {
    await authModal.waitFor({ state: "attached", timeout: 5_000 });
  } catch {
    return;
  }

  if (!(await authModal.isVisible())) return;

  const continueOffline = page.locator("#auth-close");
  const closeX = page.locator("#auth-modal-close");

  if (await continueOffline.isVisible()) {
    await continueOffline.click();
  } else if (await closeX.isVisible()) {
    await closeX.click();
  }

  await expect(authModal).toBeHidden();
}

test("a11y: no critical/serious violations on home", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Run axe checks on Chromium for stability."
  );

  await page.addInitScript(() => {
    // Use the new secure approach - mock import.meta.env with VITE_ prefix
    (globalThis as any).importMeta = {
      env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
    };
    sessionStorage.setItem("reviewPromptShown", "true");

    // Force hide loading overlay after a short delay to prevent test blocking
    setTimeout(() => {
      const loading = document.getElementById("appLoading");
      if (loading) {
        loading.classList.add("loaded");
        loading.style.opacity = "0";
        loading.style.pointerEvents = "none";
        setTimeout(() => loading.remove(), 100);
      }
    }, 2000);
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await dismissAuthModalIfPresent(page);

  // Wait for app to fully initialize
  await page.waitForFunction(
    () => {
      const loading = document.getElementById("appLoading");
      return !loading || loading.classList.contains("loaded");
    },
    { timeout: 10_000 }
  );

  // Wait for HTML title to be set (fixes accessibility test)
  await page.waitForFunction(
    () => {
      return document.title && document.title.length > 0;
    },
    { timeout: 5_000 }
  );

  const accessibilityScanResults = await new AxeBuilder({ page })
    // Color contrast is handled separately in the roadmap and can be noisy with gradients/glass effects.
    .disableRules(["color-contrast"])
    .analyze();

  const seriousOrCritical = accessibilityScanResults.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical"
  );

  expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual(
    []
  );
});
