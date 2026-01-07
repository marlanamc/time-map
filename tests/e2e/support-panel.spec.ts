import { test, expect, type Page } from '@playwright/test';
import { parseRgba } from '../utils/colors';

test.use({ colorScheme: 'dark' });

async function openSupportPanel(page: Page) {
  const authModal = page.locator('#auth-modal');
  const authClose = page.locator('#auth-close');

  // Offline-mode auth modal can appear asynchronously; always dismiss if it shows up.
  try {
    await authModal.waitFor({ state: 'attached', timeout: 5_000 });
  } catch {
    // no-op (modal may not be present)
  }

  if (await authModal.isVisible()) {
    await authClose.waitFor({ state: 'visible', timeout: 5_000 });
    await authClose.click();
    await expect(authModal).toBeHidden();
  }

  const desktopBtn = page.locator('#supportPanelToggleBtn');
  const mobileBtn = page.locator('#supportPanelToggleBtnMobile');

  await expect
    .poll(async () => (await desktopBtn.isVisible()) || (await mobileBtn.isVisible()), {
      timeout: 15_000,
    })
    .toBe(true);

  if (await desktopBtn.isVisible()) {
    await desktopBtn.click();
  } else {
    await mobileBtn.click();
  }

  await expect(page.locator('#supportPanelOverlay')).toHaveClass(/active/);
  await expect(page.locator('#supportPanel')).toBeVisible();
}

test('support panel time range selects stay readable in dark-mode + morning theme', async ({
  page,
}) => {
  await page.addInitScript(() => {
    // Force "offline mode" regardless of what `env.js` contains (and avoid needing Supabase creds in CI).
    // Use the new secure approach - mock import.meta.env with VITE_ prefix
    (globalThis as any).importMeta = { env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' } };

    localStorage.setItem('gardenFence.theme', 'night');
    localStorage.removeItem('gardenFence.devTimeOverride');
    sessionStorage.setItem('reviewPromptShown', 'true');
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveClass(/dark-mode/);

  // Wait for app loading overlay to disappear and viewport to be set up
  await page.waitForFunction(() => {
    const loading = document.getElementById("appLoading");
    return !loading || loading.classList.contains("loaded");
  }, { timeout: 20_000 });

  // Wait for mobile detection to be applied
  await page.waitForFunction(() => {
    return document.body.classList.contains("is-mobile") || document.body.classList.contains("is-desktop");
  }, { timeout: 20_000 });

  // Simulate the "problem state": dark-mode enabled, but time-of-day is not night.
  await page.evaluate(() => {
    const root = document.documentElement;
    root.classList.remove('time-dawn', 'time-morning', 'time-afternoon', 'time-evening', 'time-night');
    root.classList.add('time-morning');
  });

  await openSupportPanel(page);

  await expect(page.getByText('Daily Time Range')).toBeVisible();

  const startSelect = page.locator('#timeRangeStart');
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
