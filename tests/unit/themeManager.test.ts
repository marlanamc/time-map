import { ThemeManager } from '../../src/theme/ThemeManager';

function mockSystemTheme(mode: 'light' | 'dark') {
  window.matchMedia = (query: string) => ({
    matches: mode === 'dark' && query.includes('prefers-color-scheme: dark'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

describe('ThemeManager', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.body.className = '';
    localStorage.clear();
    document.head.innerHTML = '<meta name="theme-color" content="#ffffff" />';
    mockSystemTheme('light');
  });

  test('resolveTheme prefers explicit preference', () => {
    expect(ThemeManager.resolveTheme('night')).toBe('night');
    expect(ThemeManager.resolveTheme('dark')).toBe('night');
    expect(ThemeManager.resolveTheme('day')).toBe('day');
    expect(ThemeManager.resolveTheme('light')).toBe('day');
  });

  test('resolveTheme falls back to stored theme', () => {
    localStorage.setItem(ThemeManager.STORAGE_KEY, 'night');
    expect(ThemeManager.resolveTheme(null)).toBe('night');

    localStorage.setItem(ThemeManager.STORAGE_KEY, 'day');
    expect(ThemeManager.resolveTheme(undefined)).toBe('day');
  });

  test('resolveTheme falls back to system theme', () => {
    localStorage.removeItem(ThemeManager.STORAGE_KEY);
    mockSystemTheme('dark');
    expect(ThemeManager.resolveTheme(null)).toBe('night');

    mockSystemTheme('light');
    expect(ThemeManager.resolveTheme(null)).toBe('day');
  });

  test('apply toggles html/body classes and meta theme-color', () => {
    ThemeManager.apply('night');
    expect(document.documentElement.classList.contains('dark-mode')).toBe(true);
    expect(document.body.classList.contains('dark-mode')).toBe(true);

    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    expect(meta?.content).toBe('#0A1A2E');

    ThemeManager.apply('day');
    expect(document.documentElement.classList.contains('light-mode')).toBe(true);
    expect(document.body.classList.contains('light-mode')).toBe(true);
    expect(meta?.content).toBe('#E8F4F8');
  });

  test('applyFromPreference persists resolved theme', () => {
    ThemeManager.applyFromPreference('night');
    expect(localStorage.getItem(ThemeManager.STORAGE_KEY)).toBe('night');
  });
});

