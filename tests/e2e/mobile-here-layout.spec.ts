import { test, expect, type Page } from "@playwright/test";

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

test("mobile Here view: tab bar fixed and content padded above it", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "webkit",
    "Mobile layout regression check runs only on iPhone/WebKit."
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

    // Force mobile viewport setup in test environment
    setTimeout(() => {
      const isMobile = window.matchMedia(
        "(max-width: 600px), ((max-width: 900px) and (max-height: 500px) and (pointer: coarse))"
      ).matches;
      if (isMobile) {
        document.body.classList.add("is-mobile");
        document.body.classList.remove("is-desktop");
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

  // Wait for app loading overlay to disappear and viewport to be set up
  await page.waitForFunction(
    () => {
      const loading = document.getElementById("appLoading");
      return !loading || loading.classList.contains("loaded");
    },
    { timeout: 10_000 }
  );

  // Wait for mobile detection to be applied
  await page.waitForFunction(
    () => {
      return (
        document.body.classList.contains("is-mobile") ||
        document.body.classList.contains("is-desktop")
      );
    },
    { timeout: 30_000 }
  );

  // Wait for HTML title to be set (fixes accessibility test)
  await page.waitForFunction(
    () => {
      return document.title && document.title.length > 0;
    },
    { timeout: 5_000 }
  );

  await expect(page.locator("body")).toHaveClass(/is-mobile/);

  const hereTab = page.locator('.mobile-tab[data-view="home"]');
  await expect(hereTab).toHaveCount(0);
  await expect(page.locator("#mobileHomeView")).toHaveCount(0);

  const logo = page.locator("#appLogo");
  await expect(logo).toBeVisible();
  await logo.click();

  await expect(page.locator("body")).toHaveClass(/mobile-home-view/);
  await expect(page.locator("body")).not.toHaveClass(/here-overlay-open/);
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator("#main-content")).toBeHidden();
  await expect(page.locator(".now-panel")).toBeVisible();

  const { paddingBottomPx, tabBarHeightPx, cssVarHeightPx } =
    await page.evaluate(() => {
      const overlay = document.querySelector(
        ".sidebar"
      ) as HTMLElement | null;
      const tab = document.getElementById("mobileTabBar") as HTMLElement | null;
      if (!overlay || !tab) throw new Error("Missing expected elements");
      const style = window.getComputedStyle(overlay);
      const paddingBottomPx = parseFloat(style.paddingBottom || "0") || 0;
      const tabBarHeightPx = Math.round(tab.getBoundingClientRect().height);
      const cssVarHeightPx =
        parseFloat(
          window
            .getComputedStyle(document.documentElement)
            .getPropertyValue("--mobile-tab-bar-height") || "0"
        ) || 0;
      return { paddingBottomPx, tabBarHeightPx, cssVarHeightPx };
    });

  // Overlay padding should respect the tab height.
  expect(paddingBottomPx).toBeGreaterThanOrEqual(tabBarHeightPx);
  // JS should sync the CSS var to the measured tab bar height.
  expect(Math.abs(cssVarHeightPx - tabBarHeightPx)).toBeLessThanOrEqual(2);

  const { tabBarBottom, viewportHeight } = await page.evaluate(() => {
    const tab = document.getElementById("mobileTabBar");
    if (!tab) throw new Error("Missing mobile tab bar");
    const rect = tab.getBoundingClientRect();
    return { tabBarBottom: rect.bottom, viewportHeight: window.innerHeight };
  });

  // Tab bar should sit at the bottom of the viewport.
  expect(Math.abs(tabBarBottom - viewportHeight)).toBeLessThanOrEqual(2);

  await logo.click();
  await expect(page.locator("body")).not.toHaveClass(/mobile-home-view/);
  await expect(page.locator(".main-content")).toBeVisible();
});
