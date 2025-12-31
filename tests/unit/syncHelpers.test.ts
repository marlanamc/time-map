jest.mock("../../src/services/SupabaseService", () => ({
  SupabaseService: {
    saveGoal: jest.fn(),
    savePreferences: jest.fn(),
    saveBrainDump: jest.fn(),
  },
}));

jest.mock("../../src/services/DirtyTracker", () => ({
  dirtyTracker: {
    markClean: jest.fn(),
  },
}));

jest.mock("../../src/services/SyncQueue", () => ({
  syncQueue: {
    enqueue: jest.fn(),
  },
}));

import {
  debounce,
  throttle,
  debouncedGoalSync,
  debouncedBrainDumpSync,
  throttledPreferencesSync,
  forceGoalSync,
} from "../../src/utils/syncHelpers";
import { SupabaseService } from "../../src/services/SupabaseService";
import { dirtyTracker } from "../../src/services/DirtyTracker";
import { syncQueue } from "../../src/services/SyncQueue";

describe("syncHelpers", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.restoreAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("debounce delays execution until quiet period", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 200);

    debounced("a");
    debounced("b");
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("b");
  });

  test("throttle runs immediately and then at most once per window", () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 200);

    throttled("a");
    throttled("b");
    throttled("c");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a");

    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("c");
  });

  test("debouncedGoalSync calls Supabase save and marks clean", async () => {
    (SupabaseService.saveGoal as jest.Mock).mockResolvedValue(undefined);

    const goal = { id: "g1", title: "Do thing" } as any;
    debouncedGoalSync(goal);

    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(SupabaseService.saveGoal).toHaveBeenCalledWith(goal);
    expect(dirtyTracker.markClean).toHaveBeenCalledWith("goal", "g1");
  });

  test("debouncedGoalSync enqueues when save fails", async () => {
    (SupabaseService.saveGoal as jest.Mock).mockRejectedValue(new Error("fail"));

    const goal = { id: "g2", title: "Another" } as any;
    debouncedGoalSync(goal);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(syncQueue.enqueue).toHaveBeenCalledWith({
      type: "update",
      entity: "goal",
      data: goal,
    });
  });

  test("throttledPreferencesSync throttles repeated saves", async () => {
    (SupabaseService.savePreferences as jest.Mock).mockResolvedValue(undefined);

    const prefs1 = { theme: "day" } as any;
    const prefs2 = { theme: "night" } as any;

    throttledPreferencesSync(prefs1);
    throttledPreferencesSync(prefs2);

    await Promise.resolve();
    expect(SupabaseService.savePreferences).toHaveBeenCalledTimes(1);
    expect(SupabaseService.savePreferences).toHaveBeenCalledWith(prefs1);

    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(SupabaseService.savePreferences).toHaveBeenCalledTimes(2);
    expect(SupabaseService.savePreferences).toHaveBeenLastCalledWith(prefs2);
  });

  test("debouncedBrainDumpSync calls save and marks clean", async () => {
    (SupabaseService.saveBrainDump as jest.Mock).mockResolvedValue(undefined);

    const entry = { id: "b1" } as any;
    debouncedBrainDumpSync(entry);
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(SupabaseService.saveBrainDump).toHaveBeenCalledWith(entry);
    expect(dirtyTracker.markClean).toHaveBeenCalledWith("brainDump", "b1");
  });

  test("forceGoalSync throws on save failure", async () => {
    (SupabaseService.saveGoal as jest.Mock).mockRejectedValue(new Error("fail"));

    await expect(forceGoalSync({ id: "g3" } as any)).rejects.toThrow("fail");
  });
});
