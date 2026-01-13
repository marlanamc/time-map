jest.mock('../../../src/ui/UIManager', () => ({
  UI: { showToast: jest.fn() },
}));

import {
  closeCustomizationPanel,
  openCustomizationPanel,
} from "../../../src/components/dayView/CustomizationPanel";

describe("CustomizationPanel", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("open/close toggles panel visibility classes", () => {
    jest.useFakeTimers();

    const container = document.createElement("div");
    container.className = "planner-day-view";
    container.innerHTML = `
      <div class="customization-panel-backdrop" data-panel-visible="false">
        <div class="customization-panel" role="dialog" aria-modal="true">
          <input id="intention-title" type="text" />
        </div>
      </div>
    `;
    document.body.appendChild(container);

    openCustomizationPanel(container);

    const backdrop = container.querySelector(
      ".customization-panel-backdrop"
    ) as HTMLElement;
    const panel = container.querySelector(".customization-panel") as HTMLElement;

    expect(backdrop.dataset.panelVisible).toBe("true");
    expect(backdrop.classList.contains("visible")).toBe(true);
    expect(panel.classList.contains("visible")).toBe(true);

    jest.runAllTimers();
    const firstInput = container.querySelector(
      "#intention-title"
    ) as HTMLInputElement;
    expect(document.activeElement).toBe(firstInput);

    closeCustomizationPanel(container, false);
    expect(backdrop.dataset.panelVisible).toBe("false");
    expect(backdrop.classList.contains("visible")).toBe(false);
    expect(panel.classList.contains("visible")).toBe(false);

    container.remove();
  });
});

