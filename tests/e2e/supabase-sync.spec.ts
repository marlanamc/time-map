import { expect, test, type Page } from '@playwright/test';

const supabaseUrl = process.env.E2E_SUPABASE_URL;
const supabaseAnonKey = process.env.E2E_SUPABASE_ANON_KEY;
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

const hasCredentials = Boolean(supabaseUrl && supabaseAnonKey && email && password);

async function configureSupabaseEnv(page: Page) {
  await page.addInitScript(
    ({ url, anonKey }) => {
      (window as any).__GARDEN_FENCE_ENV = {
        ...(window as any).__GARDEN_FENCE_ENV,
        SUPABASE_URL: url,
        SUPABASE_ANON_KEY: anonKey,
      };
    },
    { url: supabaseUrl, anonKey: supabaseAnonKey },
  );
}

async function loginIfNeeded(page: Page) {
  const authModal = page.locator('#auth-modal');
  await authModal.waitFor({ state: 'attached', timeout: 15_000 });
  if (!(await authModal.isVisible())) return;

  await page.locator('#auth-email').fill(email!);
  await page.locator('#auth-password').fill(password!);
  await page.locator('#auth-form button[type="submit"]').click();

  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#auth-modal')).toBeHidden({ timeout: 20_000 });
}

async function waitForAppReady(page: Page) {
  await page.waitForFunction(() => Boolean((window as any).VisionBoard?.State), undefined, {
    timeout: 20_000,
  });
  await page.waitForFunction(() => Boolean((window as any).VisionBoard?.State?.data), undefined, {
    timeout: 20_000,
  });
}

test.describe('Supabase sync smoke tests', () => {
  test.skip(!hasCredentials, 'Set E2E_SUPABASE_URL/E2E_SUPABASE_ANON_KEY/E2E_EMAIL/E2E_PASSWORD to run.');

  test('creates + syncs a hierarchical goal across sessions', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await configureSupabaseEnv(pageA);
    await pageA.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(pageA);
    await waitForAppReady(pageA);

    const created = await pageA.evaluate(() => {
      const vb = (window as any).VisionBoard;
      const parent = vb.Goals.create({
        title: `E2E Parent ${Date.now()}`,
        level: 'milestone',
        description: 'parent',
      });
      const child = vb.Goals.create({
        title: `E2E Child ${Date.now()}`,
        level: 'focus',
        description: 'child',
      });
      vb.Goals.update(child.id, { parentId: parent.id, parentLevel: parent.level });
      return { parentId: parent.id, childId: child.id };
    });

    await pageA.waitForTimeout(6_000); // debounce + batch + network slack

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await configureSupabaseEnv(pageB);
    await pageB.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(pageB);
    await waitForAppReady(pageB);

    const loaded = await pageB.evaluate(({ parentId, childId }) => {
      const vb = (window as any).VisionBoard;
      const goals = vb.State.data?.goals ?? [];
      const parent = goals.find((g: any) => g.id === parentId);
      const child = goals.find((g: any) => g.id === childId);
      return {
        parentFound: Boolean(parent),
        childFound: Boolean(child),
        childParentId: child?.parentId ?? null,
        childParentLevel: child?.parentLevel ?? null,
      };
    }, created);

    expect(loaded.parentFound).toBe(true);
    expect(loaded.childFound).toBe(true);
    expect(loaded.childParentId).toBe(created.parentId);

    await pageA.evaluate(({ parentId, childId }) => {
      const vb = (window as any).VisionBoard;
      vb.Goals.delete(childId);
      vb.Goals.delete(parentId);
    }, created);
  });

  test('persists session across refresh', async ({ page }) => {
    await configureSupabaseEnv(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await waitForAppReady(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#auth-modal')).toBeHidden({ timeout: 20_000 });
    await waitForAppReady(page);
  });
});
