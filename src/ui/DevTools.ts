export function clearServiceWorkersAndReload() {
  const anyWindow = window as Window & {
    unregisterGardenFenceServiceWorkers?: () => Promise<void>;
  };
  const fn = anyWindow.unregisterGardenFenceServiceWorkers;

  if (typeof fn !== "function") {
    alert(
      "No service workers helper found. You may not be in production or the helper is not wired.",
    );
    return;
  }

  Promise.resolve(fn())
    .catch(() => {
      alert("Tried to clear service workers, but something went wrong.");
    })
    .then(() => {
      const shouldReload = confirm(
        "Service workers cleared. Reload this page now?",
      );
      if (shouldReload) {
        window.location.reload();
      }
    });
}
