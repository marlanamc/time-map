jest.mock("../../../src/ui/UIManager", () => ({
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
      <div class="intentions-modal-overlay" data-panel-visible="false">
        <div class="intentions-modal" role="dialog" aria-modal="true">
          <div class="customization-panel">
            <input id="intention-title" type="text" />
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    openCustomizationPanel(container);

    const backdrop = container.querySelector(
      ".intentions-modal-overlay"
    ) as HTMLElement;
    const modal = container.querySelector(".intentions-modal") as HTMLElement;

    expect(backdrop.dataset.panelVisible).toBe("true");
    expect(backdrop.classList.contains("active")).toBe(true);
    expect(modal.classList.contains("active")).toBe(true);

    jest.runAllTimers();
    const firstInput = container.querySelector(
      "#intention-title"
    ) as HTMLInputElement;
    expect(document.activeElement).toBe(firstInput);

    closeCustomizationPanel(container, false);
    expect(backdrop.dataset.panelVisible).toBe("false");
    expect(backdrop.classList.contains("active")).toBe(false);
    expect(modal.classList.contains("active")).toBe(false);

    container.remove();
  });
});
