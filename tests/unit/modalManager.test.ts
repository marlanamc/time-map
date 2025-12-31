import { ModalManager, createModal } from "../../src/utils/modalManager";

describe("ModalManager", () => {
  test("create appends modal to document", () => {
    const manager = new ModalManager();
    const modal = manager.create("modal-overlay active", "<div id=\"x\">Hi</div>");
    expect(document.body.contains(modal)).toBe(true);
    expect(manager.getModal()?.querySelector("#x")?.textContent).toBe("Hi");
    manager.remove();
  });

  test("addEventListener tracks and cleanup removes listeners", () => {
    const manager = new ModalManager();
    const el = document.createElement("button");
    document.body.appendChild(el);

    const handler = jest.fn();
    manager.addEventListener(el, "click", handler);
    el.click();
    expect(handler).toHaveBeenCalledTimes(1);

    manager.cleanup();
    el.click();
    expect(handler).toHaveBeenCalledTimes(1);
    el.remove();
  });

  test("remove cleans up listeners and removes modal", () => {
    const manager = createModal("modal-overlay active", "<button id=\"btn\">Ok</button>");
    const btn = manager.getModal()!.querySelector("#btn") as HTMLButtonElement;
    const handler = jest.fn();
    manager.addEventListener(btn, "click", handler);
    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);

    manager.remove();
    expect(manager.getModal()).toBeNull();
  });

  test("addModalListeners attaches to multiple nodes", () => {
    const manager = createModal(
      "modal-overlay active",
      "<button class=\"x\">A</button><button class=\"x\">B</button>",
    );
    const handler = jest.fn();
    manager.addModalListeners(".x", "click", (e) => {
      handler((e.target as HTMLElement).textContent);
    });

    const modal = manager.getModal()!;
    (modal.querySelectorAll(".x")[0] as HTMLButtonElement).click();
    (modal.querySelectorAll(".x")[1] as HTMLButtonElement).click();
    expect(handler).toHaveBeenCalledWith("A");
    expect(handler).toHaveBeenCalledWith("B");
    manager.remove();
  });
});
