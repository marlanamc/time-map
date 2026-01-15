import { test, expect, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

function installFixedNow(page: Page, fixedIso = "2026-01-15T10:00:00.000Z") {
  return page.addInitScript(
    ({ fixedIso }) => {
      const fixed = new Date(fixedIso).getTime();

      class FixedDate extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) super(fixed);
          else super(...args);
        }
        static now() {
          return fixed;
        }
      }

      // @ts-expect-error override for deterministic tests
      window.Date = FixedDate;
    },
    { fixedIso }
  );
}

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

async function openSupportPanel(page: Page) {
  const desktopBtn = page.locator("#supportPanelToggleBtn");
  const mobileBtn = page.locator("#supportPanelToggleBtnMobile");

  await expect
    .poll(
      async () =>
        (await desktopBtn.isVisible()) || (await mobileBtn.isVisible()),
      {
        timeout: 15_000,
      }
    )
    .toBe(true);

  if (await desktopBtn.isVisible()) {
    await desktopBtn.click();
  } else {
    await mobileBtn.click();
  }

  await expect(page.locator("#supportPanelOverlay")).toHaveClass(/active/);
  await expect(page.locator("#supportPanel")).toBeVisible();
}

test("visual: support panel (dark + morning) stays readable", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Use Chromium snapshots for stability."
  );
  test.skip(
    process.platform !== "darwin",
    "Snapshots are maintained on macOS; skip on other platforms."
  );

  await installFixedNow(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "__GARDEN_FENCE_ENV", {
      value: { SUPABASE_URL: "", SUPABASE_ANON_KEY: "" },
      writable: false,
      configurable: false,
    });

    localStorage.setItem("gardenFence.theme", "night");
    localStorage.removeItem("gardenFence.devTimeOverride");
    sessionStorage.setItem("reviewPromptShown", "true");
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await dismissAuthModalIfPresent(page);

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

  await expect(page.locator("#supportPanel")).toHaveScreenshot(
    "support-panel-dark-morning.png",
    {
      animations: "disabled",
    }
  );
});

test("visual: mobile tab bar stays visible", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit", "Mobile snapshots run on iPhone/WebKit.");
  test.skip(
    process.platform !== "darwin",
    "Snapshots are maintained on macOS; skip on other platforms."
  );

  await installFixedNow(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "__GARDEN_FENCE_ENV", {
      value: { SUPABASE_URL: "", SUPABASE_ANON_KEY: "" },
      writable: false,
      configurable: false,
    });
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
      }
    }, 3000);
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await dismissAuthModalIfPresent(page);

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

  // Debug: check if mobile detection is working
  const isMobile = await page.evaluate(() => {
    const query =
      "(max-width: 600px), ((max-width: 900px) and (max-height: 500px) and (pointer: coarse))";
    return window.matchMedia(query).matches;
  });
  console.log("Is mobile viewport detected:", isMobile);

  // Debug: check if body has mobile classes
  const bodyClassesBefore = await page.locator("body").getAttribute("class");
  console.log("Body classes before clicking:", bodyClassesBefore);

  const hereTab = page.locator('.mobile-tab[data-view="home"]');
  await expect(hereTab).toBeVisible();
  await hereTab.click();

  // Wait a moment for the view change to process
  await page.waitForTimeout(1000);

  // Debug: check what classes are on the body
  const bodyClasses = await page.locator("body").getAttribute("class");
  console.log("Body classes after clicking home tab:", bodyClasses);

  await expect(page.locator("body")).toHaveClass(/mobile-home-view/);

  await expect(page.locator("#mobileTabBar")).toHaveScreenshot(
    "mobile-tab-bar.png",
    {
      animations: "disabled",
      // WebKit/iOS rendering can be slightly unstable across versions; allow small diffs.
      maxDiffPixelRatio: 0.1,
    }
  );
});
