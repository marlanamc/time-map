import { haptics } from "../../src/utils/haptics";

describe("haptics", () => {
  beforeEach(() => {
    (globalThis as any).navigator = { vibrate: jest.fn() };
    (window as any).matchMedia = jest.fn().mockReturnValue({ matches: false });
  });

  test("vibrates when supported and not reduced motion", () => {
    haptics.impact("medium");
    expect((navigator as any).vibrate).toHaveBeenCalledWith(18);
  });

  test("does nothing when prefers-reduced-motion is enabled", () => {
    (window as any).matchMedia = jest.fn().mockReturnValue({ matches: true });
    haptics.impact("heavy");
    expect((navigator as any).vibrate).not.toHaveBeenCalled();
  });
});

