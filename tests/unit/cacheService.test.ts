import { CacheService } from "../../src/services/CacheService";

describe("CacheService", () => {
  test("set/get returns cached values within TTL", () => {
    const cache = new CacheService();
    cache.set("k", { ok: true }, 1000);
    expect(cache.get("k")).toEqual({ ok: true });
  });

  test("get returns null after TTL expiry", () => {
    const cache = new CacheService();
    const nowSpy = jest.spyOn(Date, "now");
    nowSpy.mockReturnValue(1000);
    cache.set("k", "v", 100);
    expect(cache.get("k")).toBe("v");

    nowSpy.mockReturnValue(1201);
    expect(cache.get("k")).toBeNull();
    nowSpy.mockRestore();
  });

  test("invalidate supports exact and regex patterns", () => {
    const cache = new CacheService();
    cache.set("goals:all", [1], 1000);
    cache.set("goals:1", [2], 1000);
    cache.set("prefs", { a: 1 }, 1000);

    cache.invalidate(/^goals:/);
    expect(cache.get("goals:all")).toBeNull();
    expect(cache.get("goals:1")).toBeNull();
    expect(cache.get("prefs")).toEqual({ a: 1 });

    cache.invalidate("prefs");
    expect(cache.get("prefs")).toBeNull();
  });

  test("refresh extends entry lifetime", () => {
    const cache = new CacheService();
    const nowSpy = jest.spyOn(Date, "now");
    nowSpy.mockReturnValue(1000);
    cache.set("k", "v", 100);

    nowSpy.mockReturnValue(1099);
    expect(cache.refresh("k")).toBe(true);

    nowSpy.mockReturnValue(1199);
    expect(cache.get("k")).toBe("v");
    nowSpy.mockRestore();
  });

  test("getStats reflects hits/misses/invalidations", () => {
    const cache = new CacheService();
    cache.resetStats();

    cache.set("a", 1, 1000);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("missing")).toBeNull();
    cache.invalidate("a");

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.invalidations).toBeGreaterThanOrEqual(1);
    expect(stats.hitRate).toBeGreaterThan(0);
  });

  test("has/getAge/clear behave as expected", () => {
    const cache = new CacheService();
    const nowSpy = jest.spyOn(Date, "now");
    nowSpy.mockReturnValue(1000);
    cache.set("k", "v", 500);
    expect(cache.has("k")).toBe(true);
    expect(cache.getAge("k")).toBe(0);

    nowSpy.mockReturnValue(1300);
    expect(cache.getAge("k")).toBe(300);
    cache.clear();
    expect(cache.has("k")).toBe(false);
    nowSpy.mockRestore();
  });
});
