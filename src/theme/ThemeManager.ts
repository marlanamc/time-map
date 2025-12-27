export type ThemeMode = "day" | "night";

export type ThemePreference = string | null | undefined;

const STORAGE_KEY = "gardenFence.theme";

function normalizeThemePreference(value: ThemePreference): ThemeMode | null {
  if (!value) return null;
  if (value === "night" || value === "dark") return "night";
  if (value === "day" || value === "light") return "day";
  return null;
}

function getSystemTheme(): ThemeMode {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "night" : "day";
}

function setMetaThemeColor(color: string): void {
  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) return;
  meta.content = color;
}

export const ThemeManager = {
  STORAGE_KEY,

  readStoredTheme(): ThemeMode | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeThemePreference(raw);
  },

  writeStoredTheme(theme: ThemeMode): void {
    localStorage.setItem(STORAGE_KEY, theme);
  },

  resolveTheme(preference: ThemePreference): ThemeMode {
    return normalizeThemePreference(preference) ?? this.readStoredTheme() ?? getSystemTheme();
  },

  apply(theme: ThemeMode): void {
    const isNight = theme === "night";
    const root = document.documentElement;
    root.classList.toggle("night-garden", isNight);
    root.style.colorScheme = isNight ? "dark" : "light";

    // Match the app's primary surfaces (helps mobile browser chrome).
    setMetaThemeColor(isNight ? "#0A1A0F" : "#E8F4F8");
  },

  applyFromPreference(preference: ThemePreference): ThemeMode {
    const resolved = this.resolveTheme(preference);
    this.apply(resolved);
    this.writeStoredTheme(resolved);
    return resolved;
  },
};
