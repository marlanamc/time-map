/**
 * Integration tests for sync conflict detection and resolution
 */

import { conflictDetector, type ConflictInfo } from '../../src/services/sync/ConflictDetector';

describe('Conflict Resolution', () => {
  beforeEach(() => {
    conflictDetector.clearConflicts();
  });

  describe('ConflictDetector.hasConflict', () => {
    it('should detect no conflict when timestamps are identical', () => {
      const timestamp = '2024-01-25T10:00:00Z';
      const hasConflict = conflictDetector.hasConflict(timestamp, timestamp);
      expect(hasConflict).toBe(false);
    });

    it('should detect no conflict when times are within 1 second (clock skew tolerance)', () => {
      const time1 = '2024-01-25T10:00:00.000Z';
      const time2 = '2024-01-25T10:00:00.500Z'; // 500ms apart
      const hasConflict = conflictDetector.hasConflict(time1, time2);
      expect(hasConflict).toBe(false);
    });

    it('should detect conflict when remote is newer than local', () => {
      const localTime = '2024-01-25T10:00:00Z';
      const remoteTime = '2024-01-25T10:00:05Z'; // 5 seconds later
      const hasConflict = conflictDetector.hasConflict(localTime, remoteTime);
      expect(hasConflict).toBe(true);
    });

    it('should not detect conflict when local is newer than remote', () => {
      const localTime = '2024-01-25T10:00:05Z';
      const remoteTime = '2024-01-25T10:00:00Z'; // 5 seconds earlier
      const hasConflict = conflictDetector.hasConflict(localTime, remoteTime);
      expect(hasConflict).toBe(false);
    });

    it('should return false when timestamps are missing', () => {
      expect(conflictDetector.hasConflict(null, '2024-01-25T10:00:00Z')).toBe(false);
      expect(conflictDetector.hasConflict('2024-01-25T10:00:00Z', null)).toBe(false);
      expect(conflictDetector.hasConflict(undefined, '2024-01-25T10:00:00Z')).toBe(false);
    });
  });

  describe('ConflictDetector.detectConflict', () => {
    it('should return null when there is no conflict', () => {
      const localTime = '2024-01-25T10:00:00Z';
      const remoteTime = '2024-01-25T10:00:00.500Z';

      const conflict = conflictDetector.detectConflict(
        'goal',
        'goal-123',
        localTime,
        remoteTime,
        'My Goal'
      );

      expect(conflict).toBeNull();
    });

    it('should detect conflict and use last-write-wins resolution', () => {
      const localTime = '2024-01-25T10:00:00Z';
      const remoteTime = '2024-01-25T10:00:05Z'; // Remote is newer

      const conflict = conflictDetector.detectConflict(
        'goal',
        'goal-123',
        localTime,
        remoteTime,
        'My Goal'
      );

      expect(conflict).not.toBeNull();
      expect(conflict?.entityType).toBe('goal');
      expect(conflict?.entityId).toBe('goal-123');
      expect(conflict?.resolution).toBe('remote_wins'); // Remote is newer
    });

    it('should record conflict for history', () => {
      const localTime = '2024-01-25T10:00:00Z';
      const remoteTime = '2024-01-25T10:00:05Z';

      conflictDetector.detectConflict('event', 'event-456', localTime, remoteTime);

      const recent = conflictDetector.getRecentConflicts();
      expect(recent).toHaveLength(1);
      expect(recent[0].entityId).toBe('event-456');
    });

    it('should notify subscribers of conflicts', () => {
      const callback = jest.fn();
      conflictDetector.onConflict(callback);

      const localTime = '2024-01-25T10:00:00Z';
      const remoteTime = '2024-01-25T10:00:05Z';

      conflictDetector.detectConflict('brainDump', 'dump-789', localTime, remoteTime);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        entityType: 'brainDump',
        entityId: 'dump-789',
        resolution: 'remote_wins',
      }));
    });

    it('should unsubscribe callback from conflict notifications', () => {
      const callback = jest.fn();
      const unsubscribe = conflictDetector.onConflict(callback);

      const localTime = '2024-01-25T10:00:00Z';
      const remoteTime = '2024-01-25T10:00:05Z';

      conflictDetector.detectConflict('goal', 'goal-1', localTime, remoteTime);
      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Detect another conflict
      conflictDetector.detectConflict('goal', 'goal-2', localTime, remoteTime);

      // Callback should not be called again
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple entity types', () => {
      const localTime = '2024-01-25T10:00:00Z';
      const remoteTime = '2024-01-25T10:00:05Z';

      const types: Array<'goal' | 'event' | 'brainDump' | 'weeklyReview'> = [
        'goal',
        'event',
        'brainDump',
        'weeklyReview',
      ];

      types.forEach((type, index) => {
        conflictDetector.detectConflict(type, `id-${index}`, localTime, remoteTime);
      });

      const recent = conflictDetector.getRecentConflicts();
      expect(recent).toHaveLength(4);
      // Conflicts are stored most-recent-first
      const entityTypes = recent.map((c) => c.entityType);
      expect(entityTypes).toContain('goal');
      expect(entityTypes).toContain('event');
      expect(entityTypes).toContain('brainDump');
      expect(entityTypes).toContain('weeklyReview');
    });

    it('should maintain max of 50 stored conflicts', () => {
      const localTime = '2024-01-25T10:00:00Z';
      const remoteTime = '2024-01-25T10:00:05Z';

      // Create 60 conflicts
      for (let i = 0; i < 60; i++) {
        conflictDetector.detectConflict('goal', `goal-${i}`, localTime, remoteTime);
      }

      const recent = conflictDetector.getRecentConflicts();
      expect(recent.length).toBeLessThanOrEqual(50);
      // Should keep most recent ones
      expect(recent[0].entityId).toBe('goal-59');
    });
  });

  describe('ConflictDetector.formatConflictMessage', () => {
    it('should format remote-wins message', () => {
      const conflict: ConflictInfo = {
        entityType: 'goal',
        entityId: 'goal-123',
        entityTitle: 'My Goal',
        localUpdatedAt: '2024-01-25T10:00:00Z',
        remoteUpdatedAt: '2024-01-25T10:00:05Z',
        resolution: 'remote_wins',
      };

      const message = conflictDetector.formatConflictMessage(conflict);
      expect(message).toContain('My Goal');
      expect(message).toContain('updated on another device');
      expect(message).toContain('overwritten');
    });

    it('should format local-wins message', () => {
      const conflict: ConflictInfo = {
        entityType: 'event',
        entityId: 'event-456',
        entityTitle: 'Team Meeting',
        localUpdatedAt: '2024-01-25T10:00:05Z',
        remoteUpdatedAt: '2024-01-25T10:00:00Z',
        resolution: 'local_wins',
      };

      const message = conflictDetector.formatConflictMessage(conflict);
      expect(message).toContain('Team Meeting');
      expect(message).toContain('synced');
      expect(message).toContain('version kept');
    });

    it('should use entity ID as fallback when title is missing', () => {
      const conflict: ConflictInfo = {
        entityType: 'brainDump',
        entityId: 'dump-789',
        localUpdatedAt: '2024-01-25T10:00:00Z',
        remoteUpdatedAt: '2024-01-25T10:00:05Z',
        resolution: 'remote_wins',
      };

      const message = conflictDetector.formatConflictMessage(conflict);
      expect(message).toContain('dump-789');
    });

    it('should include proper entity labels', () => {
      const types: Array<'goal' | 'event' | 'brainDump' | 'weeklyReview'> = [
        'goal',
        'event',
        'brainDump',
        'weeklyReview',
      ];

      types.forEach((type) => {
        const conflict: ConflictInfo = {
          entityType: type,
          entityId: `${type}-1`,
          localUpdatedAt: '2024-01-25T10:00:00Z',
          remoteUpdatedAt: '2024-01-25T10:00:05Z',
          resolution: 'remote_wins',
        };

        const message = conflictDetector.formatConflictMessage(conflict);
        expect(message).toBeTruthy();
      });
    });
  });

  describe('ConflictDetector.clearConflicts', () => {
    it('should clear conflict history', () => {
      const localTime = '2024-01-25T10:00:00Z';
      const remoteTime = '2024-01-25T10:00:05Z';

      conflictDetector.detectConflict('goal', 'goal-1', localTime, remoteTime);
      conflictDetector.detectConflict('goal', 'goal-2', localTime, remoteTime);

      expect(conflictDetector.getRecentConflicts()).toHaveLength(2);

      conflictDetector.clearConflicts();
      expect(conflictDetector.getRecentConflicts()).toHaveLength(0);
    });
  });
});
