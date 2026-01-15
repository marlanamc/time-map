import { test, expect, type Page } from "@playwright/test";
import { parseRgba } from "../utils/colors";

test.use({ colorScheme: "dark" });

async function openSupportPanel(page: Page) {
  const authModal = page.locator("#auth-modal");
  const authClose = page.locator("#auth-close");

  // Offline-mode auth modal can appear asynchronously; always dismiss if it shows up.
  try {
    await authModal.waitFor({ state: "attached", timeout: 5_000 });
  } catch {
    // no-op (modal may not be present)
  }

  if (await authModal.isVisible()) {
    await authClose.waitFor({ state: "visible", timeout: 5_000 });
    await authClose.click();
    await expect(authModal).toBeHidden();
  }

  const desktopBtn = page.locator("#supportPanelToggleBtn");
  const mobileBtn = page.locator("#supportPanelToggleBtnMobile");

  // Debug: check which button is visible
  const desktopVisible = await desktopBtn.isVisible();
  const mobileVisible = await mobileBtn.isVisible();
  console.log(
    `Desktop button visible: ${desktopVisible}, Mobile button visible: ${mobileVisible}`
  );

  // Debug: check mobile viewport detection
  const isMobileViewport = await page.evaluate(() => {
    const query =
      "(max-width: 600px), ((max-width: 900px) and (max-height: 500px) and (pointer: coarse))";
    return window.matchMedia(query).matches;
  });
  console.log(`Mobile viewport detected: ${isMobileViewport}`);

  // Debug: check mobile button computed styles
  if (mobileVisible) {
    const mobileStyles = await mobileBtn.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        position: computed.position,
        classList: el.className,
      };
    });
    console.log("Mobile button computed styles:", mobileStyles);
  }

  await expect
    .poll(
      async () =>
        (await desktopBtn.isVisible()) || (await mobileBtn.isVisible()),
      {
        timeout: 15_000,
      }
    )
    .toBe(true);

  // Wait a moment for the button to be ready
  await page.waitForTimeout(1000);

  if (await desktopBtn.isVisible()) {
    console.log("Clicking desktop support panel button");
    await desktopBtn.click();
  } else {
    console.log("Clicking mobile support panel button");
    await mobileBtn.click();
  }

  // Wait a moment for the panel to open
  await page.waitForTimeout(2000);

  // Debug: check panel state
  const overlayClasses = await page
    .locator("#supportPanelOverlay")
    .getAttribute("class");
  const panelVisible = await page.locator("#supportPanel").isVisible();
  console.log(
    `Overlay classes: ${overlayClasses}, Panel visible: ${panelVisible}`
  );

  await expect(page.locator("#supportPanelOverlay")).toHaveClass(/active/);
  await expect(page.locator("#supportPanel")).toBeVisible();
}

test("support panel time range selects stay readable in dark-mode + morning theme", async ({
  page,
}) => {
  await page.addInitScript(() => {
    // Force "offline mode" regardless of what `env.js` contains (and avoid needing Supabase creds in CI).
    // Use the new secure approach - mock import.meta.env with VITE_ prefix
    (globalThis as any).importMeta = {
      env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
    };

    localStorage.setItem("gardenFence.theme", "night");
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

    // Force mobile viewport setup in test environment
    setTimeout(() => {
      const isMobile = window.matchMedia(
        "(max-width: 600px), ((max-width: 900px) and (max-height: 500px) and (pointer: coarse))"
      ).matches;
      if (isMobile) {
        document.body.classList.add("is-mobile");
        document.body.classList.remove("is-desktop");
        // Force mobile home view for testing
        document.body.classList.add("mobile-home-view");
        console.log("Forced mobile classes applied");

        // Force mobile support button to be visible
        const mobileBtn = document.getElementById(
          "supportPanelToggleBtnMobile"
        );
        if (mobileBtn) {
          mobileBtn.style.display = "flex";
          mobileBtn.style.visibility = "visible";
          mobileBtn.style.opacity = "1";
          console.log("Forced mobile support button to be visible");
        }
      }
    }, 3000);
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  // Wait for loading overlay to be hidden
  await page.waitForFunction(
    () => {
      const loading = document.getElementById("appLoading");
      return (
        !loading ||
        loading.classList.contains("loaded") ||
        loading.style.display === "none"
      );
    },
    { timeout: 15_000 }
  );

  // Wait for theme system to initialize
  await page.waitForFunction(
    () => {
      const html = document.documentElement;
      return (
        html.classList.contains("dark-mode") ||
        html.classList.contains("light-mode")
      );
    },
    { timeout: 10_000 }
  );

  await expect(page.locator("html")).toHaveClass(/dark-mode/);

  // Simulate the "problem state": dark-mode enabled, but time-of-day is not night.
  await page.evaluate(() => {
    const root = document.documentElement;
    root.classList.remove(
      "time-dawn",
      "time-morning",
      "time-afternoon",
      "time-evening",
      "time-night"
    );
    root.classList.add("time-morning");
  });

  await openSupportPanel(page);

  await expect(page.getByText("Daily Time Range")).toBeVisible();

  const startSelect = page.locator("#timeRangeStart");
  await expect(startSelect).toBeVisible();

  const styles = await startSelect.evaluate((el) => {
    const computed = window.getComputedStyle(el as HTMLElement);
    return { color: computed.color, backgroundColor: computed.backgroundColor };
  });

  const color = parseRgba(styles.color);
  const background = parseRgba(styles.backgroundColor);

  // Regression check: dark mode should never render dark text on a dark panel.
  expect(color.r).toBeGreaterThanOrEqual(200);
  expect(color.g).toBeGreaterThanOrEqual(200);
  expect(color.b).toBeGreaterThanOrEqual(200);

  // Regression check: support panel selects should not be near-opaque white in dark mode.
  expect(background.a).toBeLessThanOrEqual(0.2);
});
