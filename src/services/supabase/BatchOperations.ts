// Batch Operations Service - For cross-entity batch operations
// Individual services already have batch methods, this is for any cross-entity operations if needed
import { goalsService } from './GoalsService';
import { eventsService } from './EventsService';
import { brainDumpService } from './BrainDumpService';
import type { Goal, CalendarEvent, BrainDumpEntry } from '../../types';

export class BatchOperationsService {
  // These methods delegate to individual services
  // Keeping them here for any future cross-entity batch logic

  async saveGoals(goals: Goal[]): Promise<void> {
    return goalsService.saveGoals(goals);
  }

  async saveEvents(events: CalendarEvent[]): Promise<void> {
    return eventsService.saveEvents(events);
  }

  async saveBrainDumpBatch(entries: BrainDumpEntry[]): Promise<void> {
    return brainDumpService.saveBrainDumpBatch(entries);
  }
}

export const batchOperationsService = new BatchOperationsService();
