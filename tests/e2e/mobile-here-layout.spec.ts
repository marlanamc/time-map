import { test, expect, type Page } from '@playwright/test';

async function dismissAuthModalIfPresent(page: Page) {
  const authModal = page.locator('#auth-modal');
  try {
    await authModal.waitFor({ state: 'attached', timeout: 5_000 });
  } catch {
    return;
  }

  if (!(await authModal.isVisible())) return;

  const continueOffline = page.locator('#auth-close');
  const closeX = page.locator('#auth-modal-close');

  if (await continueOffline.isVisible()) {
    await continueOffline.click();
  } else if (await closeX.isVisible()) {
    await closeX.click();
  }

  await expect(authModal).toBeHidden();
}

test('mobile Here view: tab bar fixed and content padded above it', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'Mobile layout regression check runs only on iPhone/WebKit.');

  await page.addInitScript(() => {
    // Use the new secure approach - mock import.meta.env with VITE_ prefix
    (globalThis as any).importMeta = { env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' } };
    sessionStorage.setItem('reviewPromptShown', 'true');
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await dismissAuthModalIfPresent(page);

  // Wait for app loading overlay to disappear and viewport to be set up
  await page.waitForFunction(() => {
    const loading = document.getElementById("appLoading");
    return !loading || loading.classList.contains("loaded");
  }, { timeout: 10_000 });

  // Wait for mobile detection to be applied
  await page.waitForFunction(() => {
    return document.body.classList.contains("is-mobile") || document.body.classList.contains("is-desktop");
  }, { timeout: 10_000 });

  await expect(page.locator('body')).toHaveClass(/is-mobile/);

  // Ensure we're on the "Here" (home) tab.
  const hereTab = page.locator('.mobile-tab[data-view="home"]');
  await expect(hereTab).toBeVisible();
  await hereTab.click();

  await expect(page.locator('body')).toHaveClass(/mobile-home-view/);

  const tabBar = page.locator('#mobileTabBar');
  await expect(tabBar).toBeVisible();

  const sidebar = page.locator('#sidebar');
  await expect(sidebar).toBeVisible();

  // "You Are Here" panel should be visible and not positioned off-screen.
  const nowPanel = page.locator('.now-panel');
  await expect(nowPanel).toBeVisible();

  // Section toggles should be comfortable to tap.
  const toggles = page.locator('.section-toggle');
  if (await toggles.count()) {
    const firstToggleHeight = await toggles.first().evaluate((el) => el.getBoundingClientRect().height);
    expect(firstToggleHeight).toBeGreaterThanOrEqual(44);
  }

  const { nowRect, sidebarRect } = await page.evaluate(() => {
    const now = document.querySelector('.now-panel') as HTMLElement | null;
    const sidebarEl = document.getElementById('sidebar') as HTMLElement | null;
    if (!now || !sidebarEl) throw new Error('Missing expected elements');
    const nr = now.getBoundingClientRect();
    const sr = sidebarEl.getBoundingClientRect();
    return {
      nowRect: { top: nr.top, left: nr.left, bottom: nr.bottom, right: nr.right },
      sidebarRect: { top: sr.top, left: sr.left, bottom: sr.bottom, right: sr.right },
    };
  });

  expect(nowRect.top).toBeGreaterThanOrEqual(sidebarRect.top);
  expect(nowRect.top).toBeGreaterThanOrEqual(0);
  expect(nowRect.left).toBeGreaterThanOrEqual(sidebarRect.left);
  expect(nowRect.right).toBeLessThanOrEqual(sidebarRect.right + 1);

  const { tabBarBottom, viewportHeight } = await page.evaluate(() => {
    const tab = document.getElementById('mobileTabBar');
    if (!tab) throw new Error('Missing mobile tab bar');
    const rect = tab.getBoundingClientRect();
    return { tabBarBottom: rect.bottom, viewportHeight: window.innerHeight };
  });

  // Tab bar should sit at the bottom of the viewport.
  expect(Math.abs(tabBarBottom - viewportHeight)).toBeLessThanOrEqual(2);

  const { paddingBottomPx, tabBarHeightPx, cssVarHeightPx } = await page.evaluate(() => {
    const sidebarEl = document.getElementById('sidebar') as HTMLElement | null;
    const tab = document.getElementById('mobileTabBar') as HTMLElement | null;
    if (!sidebarEl || !tab) throw new Error('Missing expected elements');
    const style = window.getComputedStyle(sidebarEl);
    const paddingBottomPx = parseFloat(style.paddingBottom || '0') || 0;
    const tabBarHeightPx = Math.round(tab.getBoundingClientRect().height);
    const cssVarHeightPx = parseFloat(
      window.getComputedStyle(document.documentElement).getPropertyValue('--mobile-tab-bar-height') || '0',
    ) || 0;
    return { paddingBottomPx, tabBarHeightPx, cssVarHeightPx };
  });

  // Sidebar should pad its scroll content so the tab bar doesn't cover it.
  expect(paddingBottomPx).toBeGreaterThanOrEqual(tabBarHeightPx);
  // JS should sync the CSS var to the measured tab bar height.
  expect(Math.abs(cssVarHeightPx - tabBarHeightPx)).toBeLessThanOrEqual(2);
});
