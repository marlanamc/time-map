import { test, expect, type Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

function installFixedNow(page: Page, fixedIso = '2026-01-15T10:00:00.000Z') {
  return page.addInitScript(({ fixedIso }) => {
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
  }, { fixedIso });
}

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

async function openSupportPanel(page: Page) {
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

test('visual: support panel (dark + morning) stays readable', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Use Chromium snapshots for stability.');

  await installFixedNow(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, '__GARDEN_FENCE_ENV', {
      value: { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' },
      writable: false,
      configurable: false,
    });

    localStorage.setItem('gardenFence.theme', 'night');
    localStorage.removeItem('gardenFence.devTimeOverride');
    sessionStorage.setItem('reviewPromptShown', 'true');
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await dismissAuthModalIfPresent(page);

  await page.evaluate(() => {
    const root = document.documentElement;
    root.classList.remove('time-dawn', 'time-morning', 'time-afternoon', 'time-evening', 'time-night');
    root.classList.add('time-morning');
  });

  await openSupportPanel(page);

  await expect(page.locator('#supportPanel')).toHaveScreenshot('support-panel-dark-morning.png', {
    animations: 'disabled',
  });
});

test('visual: mobile tab bar stays visible', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'Mobile snapshots run on iPhone/WebKit.');

  await installFixedNow(page);
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

  const hereTab = page.locator('.mobile-tab[data-view="home"]');
  await expect(hereTab).toBeVisible();
  await hereTab.click();

  await expect(page.locator('body')).toHaveClass(/mobile-home-view/);

  await expect(page.locator('#mobileTabBar')).toHaveScreenshot('mobile-tab-bar.png', {
    animations: 'disabled',
    // WebKit/iOS rendering can be slightly unstable across versions; allow small diffs.
    maxDiffPixelRatio: 0.1,
  });
});
