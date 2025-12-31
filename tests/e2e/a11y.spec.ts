import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ reducedMotion: 'reduce' });

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

test('a11y: no critical/serious violations on home', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Run axe checks on Chromium for stability.');

  await page.addInitScript(() => {
    Object.defineProperty(window, '__GARDEN_FENCE_ENV', {
      value: { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' },
      writable: false,
      configurable: false,
    });
    sessionStorage.setItem('reviewPromptShown', 'true');
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await dismissAuthModalIfPresent(page);

  const accessibilityScanResults = await new AxeBuilder({ page })
    // Color contrast is handled separately in the roadmap and can be noisy with gradients/glass effects.
    .disableRules(['color-contrast'])
    .analyze();

  const seriousOrCritical = accessibilityScanResults.violations.filter((v) =>
    v.impact === 'serious' || v.impact === 'critical'
  );

  expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
});

