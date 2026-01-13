/**
 * Sync Helpers - Debounce and throttle utilities for optimized cloud sync
 *
 * These utilities prevent excessive API calls by batching rapid changes
 * and limiting sync frequency, crucial for ADHD-friendly instant UI feedback.
 */

import type { Analytics, BrainDumpEntry, CalendarEvent, Goal, Preferences, Streak } from '../types';
import { SupabaseService } from '../services/supabase';
import { dirtyTracker } from '../services/DirtyTracker';
import { syncQueue } from '../services/SyncQueue';

type DebouncedFunction<T extends any[] = any[]> = (...args: T) => void;

/**
 * Debounce - Wait for quiet period before executing
 *
 * Use when: You want to wait until user stops making changes
 * Example: Save goal after 2s of no edits
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends any[]>(
  fn: (...args: T) => void,
  delay: number
): DebouncedFunction<T> {
  let timeoutId: number | null = null;

  return function (this: unknown, ...args: T) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttle - Limit execution frequency
 *
 * Use when: You want to limit how often a function runs
 * Example: Save preferences max once per 5 seconds
 *
 * @param fn - Function to throttle
 * @param limit - Minimum time between executions in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends any[]>(
  fn: (...args: T) => void,
  limit: number
): DebouncedFunction<T> {
  let inThrottle = false;
  let lastArgs: T | null = null;

  return function (this: unknown, ...args: T) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

/**
 * Debounced Goal Sync - Waits 2 seconds after last edit before syncing to cloud
 *
 * This is the key to instant UI feedback:
 * 1. User edits goal → saves to IndexedDB immediately (10ms)
 * 2. UI updates instantly
 * 3. After 2s of no edits → syncs to Supabase in background
 *
 * @param goal - Goal to sync
 */
export const debouncedGoalSync = debounce(async (goal: Goal) => {
  try {
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'syncing' } }));
    await SupabaseService.saveGoal(goal);
    dirtyTracker.markClean('goal', goal.id);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'synced' } }));

    console.log(`✓ Goal "${goal.title}" synced to cloud`);
  } catch (error) {
    console.error('Failed to sync goal to cloud:', error);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'error' } }));

    // Add to sync queue if available
    try {
      syncQueue.enqueue({
        type: 'update',
        entity: 'goal',
        data: goal
      });
    } catch (queueError) {
      console.warn('Sync queue not available:', queueError);
    }
  }
}, 2000); // Wait 2 seconds after last edit

/**
 * Throttled Preferences Sync - Max once per 5 seconds
 *
 * Preferences change frequently (theme, settings, etc.) but don't need
 * immediate cloud sync. Throttle to prevent excessive API calls.
 *
 * @param prefs - Preferences to sync
 */
export const throttledPreferencesSync = throttle(async (prefs: Preferences) => {
  try {
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'syncing' } }));
    await SupabaseService.savePreferences(prefs);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'synced' } }));
    console.log('✓ Preferences synced to cloud');
  } catch (error) {
    console.error('Failed to sync preferences:', error);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'error' } }));
  }
}, 5000); // Max once per 5 seconds

export const throttledPreferencesAndAnalyticsSync = throttle(
  async (prefs: Preferences, analytics?: Analytics) => {
    try {
      window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'syncing' } }));
      await SupabaseService.savePreferences(prefs, analytics);
      window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'synced' } }));
      console.log('✓ Preferences + analytics synced to cloud');
    } catch (error) {
      console.error('Failed to sync preferences + analytics:', error);
      window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'error' } }));
    }
  },
  5000
); // Max once per 5 seconds

export const throttledStreakSync = throttle(async (streak: Streak, bestStreak?: number) => {
  try {
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'syncing' } }));
    await SupabaseService.saveStreak(streak, bestStreak);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'synced' } }));
    console.log('✓ Streak synced to cloud');
  } catch (error) {
    console.error('Failed to sync streak:', error);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'error' } }));
  }
}, 5000); // Max once per 5 seconds

/**
 * Debounced Brain Dump Sync - Waits 1 second after last edit
 *
 * Brain dump items are quick thoughts that change rapidly.
 * Use shorter delay than goals but still debounce.
 *
 * @param entry - Brain dump entry to sync
 */
export const debouncedBrainDumpSync = debounce(async (entry: BrainDumpEntry) => {
  try {
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'syncing' } }));
    await SupabaseService.saveBrainDump(entry);
    dirtyTracker.markClean('brainDump', entry.id);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'synced' } }));

    console.log('✓ Brain dump entry synced to cloud');
  } catch (error) {
    console.error('Failed to sync brain dump:', error);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'error' } }));

    try {
      syncQueue.enqueue({
        type: 'update',
        entity: 'brainDump',
        data: entry
      });
    } catch (queueError) {
      console.warn('Sync queue not available:', queueError);
    }
  }
}, 1000); // Wait 1 second after last edit

/**
 * Debounced Event Sync - Waits 1 second after last edit before syncing to cloud
 *
 * Events are lightweight and may be edited quickly; keep delay short.
 */
export const debouncedEventSync = debounce(async (event: CalendarEvent) => {
  try {
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'syncing' } }));
    await SupabaseService.saveEvent(event);
    dirtyTracker.markClean('event', event.id);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'synced' } }));
  } catch (error) {
    console.error('Failed to sync event to cloud:', error);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'error' } }));

    try {
      syncQueue.enqueue({
        type: 'update',
        entity: 'event',
        data: event
      });
    } catch (queueError) {
      console.warn('Sync queue not available:', queueError);
    }
  }
}, 1000);

/**
 * Cancel all pending debounced syncs
 *
 * Use when: User logs out or navigates away
 */
export function cancelPendingSyncs(): void {
  // Note: Individual debounced functions would need to expose their
  // timeout IDs for cancellation. For now, pending syncs will complete.
  console.log('Pending syncs will complete in background');
}

/**
 * Force immediate sync of a goal (bypass debounce)
 *
 * Use when: User explicitly clicks "Save" or before critical actions
 *
 * @param goal - Goal to sync immediately
 */
export async function forceGoalSync(goal: Goal): Promise<void> {
  try {
    await SupabaseService.saveGoal(goal);
    dirtyTracker.markClean('goal', goal.id);

    console.log(`✓ Goal "${goal.title}" force-synced to cloud`);
  } catch (error) {
    console.error('Failed to force-sync goal:', error);
    throw error;
  }
}
