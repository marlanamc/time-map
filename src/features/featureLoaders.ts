export type NDSupportApi = typeof import("./ndSupport")["NDSupport"];
export type AppSettingsApi = typeof import("./appSettings")["AppSettings"];
export type ZenFocusApi = typeof import("./zenFocus")["ZenFocus"];
export type QuickAddApi = typeof import("./quickAdd")["QuickAdd"];

type ToastFn = (iconOrMessage: string, messageOrType?: string) => void;

export type FeatureLoaders = ReturnType<typeof createFeatureLoaders>;

type AppSettingsCallbacks = {
  onShowToast?: (message: string, type?: string) => void;
  onScheduleRender?: () => void;
  onShowKeyboardShortcuts?: () => void;
  onSetFocusMode?: (
    enabled: boolean,
    options?: { silent?: boolean; persist?: boolean },
  ) => void;
  onApplyLayoutVisibility?: () => void;
  onApplySidebarVisibility?: () => void;
  onSyncViewButtons?: () => void;
};

export function createFeatureLoaders(opts: {
  toast: ToastFn;
  appSettingsCallbacks?: AppSettingsCallbacks;
}) {
  let ndSupport: NDSupportApi | null = null;
  let ndSupportLoading: Promise<NDSupportApi> | null = null;

  let appSettings: AppSettingsApi | null = null;
  let appSettingsLoading: Promise<AppSettingsApi> | null = null;

  let zenFocus: ZenFocusApi | null = null;
  let zenFocusLoading: Promise<ZenFocusApi | null> | null = null;

  let quickAdd: QuickAddApi | null = null;
  let quickAddLoading: Promise<QuickAddApi | null> | null = null;

  const ensureNDSupport = async (): Promise<NDSupportApi> => {
    if (ndSupport) return ndSupport;
    if (ndSupportLoading) return ndSupportLoading;

    ndSupportLoading = import("./ndSupport")
      .then((mod) => {
        ndSupport = mod.NDSupport;
        return mod.NDSupport;
      })
      .catch((err) => {
        console.error("Failed to load NDSupport:", err);
        opts.toast("⚠️", "Support tools failed to load");
        throw err;
      })
      .finally(() => {
        ndSupportLoading = null;
      });

    return ndSupportLoading;
  };

  const ensureAppSettings = async (): Promise<AppSettingsApi> => {
    if (appSettings) return appSettings;
    if (appSettingsLoading) return appSettingsLoading;

    appSettingsLoading = import("./appSettings")
      .then((mod) => {
        if (opts.appSettingsCallbacks) {
          mod.AppSettings.setCallbacks(opts.appSettingsCallbacks);
        }
        appSettings = mod.AppSettings;
        return mod.AppSettings;
      })
      .catch((err) => {
        console.error("Failed to load AppSettings:", err);
        opts.toast("⚠️", "Settings failed to load");
        throw err;
      })
      .finally(() => {
        appSettingsLoading = null;
      });

    return appSettingsLoading;
  };

  const ensureZenFocus = async (): Promise<ZenFocusApi | null> => {
    if (zenFocus) return zenFocus;
    if (zenFocusLoading) return zenFocusLoading;

      zenFocusLoading = import("./zenFocus")
      .then((mod) => {
        zenFocus = mod.zenFocus;
        return mod.zenFocus;
      })
      .catch((err) => {
        console.error("Failed to load ZenFocus:", err);
        opts.toast("⚠️", "Focus mode failed to load");
        return null;
      })
      .finally(() => {
        zenFocusLoading = null;
      });

    return zenFocusLoading;
  };

  const ensureQuickAdd = async (): Promise<QuickAddApi | null> => {
    if (quickAdd) return quickAdd;
    if (quickAddLoading) return quickAddLoading;

      quickAddLoading = import("./quickAdd")
      .then((mod) => {
        quickAdd = mod.quickAdd;
        return mod.quickAdd;
      })
      .catch((err) => {
        console.error("Failed to load QuickAdd:", err);
        opts.toast("⚠️", "Quick add failed to load");
        return null;
      })
      .finally(() => {
        quickAddLoading = null;
      });

    return quickAddLoading;
  };

  const getNDSupportIfLoaded = () => ndSupport;

  const deferNDSupportInit = () => {
    const run = () => {
      void ensureNDSupport()
        .then((nd) => nd.init())
        .catch(() => {
          // ignore
        });
    };

    const win = window as any;
    if (typeof win.requestIdleCallback === "function") {
      win.requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 250);
    }
  };

  const applyAccessibilityPreferences = async () => {
    try {
      const nd = await ensureNDSupport();
      nd.applyAccessibilityPreferences();
    } catch {
      // ignore
    }
  };

  return {
    ensureNDSupport,
    ensureAppSettings,
    ensureZenFocus,
    ensureQuickAdd,
    getNDSupportIfLoaded,
    deferNDSupportInit,
    applyAccessibilityPreferences,
  };
}
