// Brain Dump Service
import { getSupabaseClient } from './client';
import { AuthenticationError, DatabaseError } from '../errors';
import { authService } from './AuthService';
import type { BrainDumpEntry } from '../../types';
import type { BrainDumpRow } from '../../types/database';

export class BrainDumpService {
  async getBrainDump(): Promise<BrainDumpEntry[]> {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('brain_dump')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[BrainDumpService] Failed to get brain dump:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to load brain dump: ${error.message}`, error);
      }

      if (!data) {
        console.warn('[BrainDumpService] getBrainDump returned null data');
        return [];
      }

      const entries = data.map((b: BrainDumpRow) => ({
        id: b.id,
        text: b.text,
        createdAt: b.created_at,
        processed: b.processed,
        archived: b.archived,
        processedAction: b.processed_action,
        processedAt: b.processed_at
      }));

      console.log(`✓ Loaded ${entries.length} brain dump entries from database`);
      return entries;
    } catch (err) {
      console.error('[BrainDumpService] Error in getBrainDump:', err);
      throw err;
    }
  }

  async saveBrainDump(entry: BrainDumpEntry): Promise<void> {
    const user = await authService.getUser();
    if (!user) {
      throw new AuthenticationError('Cannot save brain dump: User not authenticated');
    }

    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase
        .from('brain_dump')
        .upsert({
          id: entry.id,
          user_id: user.id,
          text: entry.text,
          created_at: entry.createdAt,
          processed: entry.processed,
          archived: entry.archived,
          processed_action: entry.processedAction,
          processed_at: entry.processedAt
        });

      if (error) {
        console.error('[BrainDumpService] Failed to save brain dump:', {
          entryId: entry.id,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to save brain dump: ${error.message}`, error);
      }

      console.log(`✓ Saved brain dump entry: ${entry.id}`);
    } catch (err) {
      console.error('[BrainDumpService] Error in saveBrainDump:', err);
      throw err;
    }
  }

  async deleteBrainDump(id: string): Promise<void> {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.from('brain_dump').delete().eq('id', id);
      
      if (error) {
        console.error('[BrainDumpService] Failed to delete brain dump:', {
          entryId: id,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to delete brain dump: ${error.message}`, error);
      }

      console.log(`✓ Deleted brain dump entry: ${id}`);
    } catch (err) {
      console.error('[BrainDumpService] Error in deleteBrainDump:', err);
      throw err;
    }
  }

  async saveBrainDumpBatch(entries: BrainDumpEntry[]): Promise<void> {
    const user = await authService.getUser();
    if (!user) {
      throw new AuthenticationError('Cannot save brain dump batch: User not authenticated');
    }

    try {
      const supabase = await getSupabaseClient();
      const entriesData = entries.map(entry => ({
        id: entry.id,
        user_id: user.id,
        text: entry.text,
        created_at: entry.createdAt,
        processed: entry.processed,
        archived: entry.archived,
        processed_action: entry.processedAction,
        processed_at: entry.processedAt
      }));

      const { error } = await supabase
        .from('brain_dump')
        .upsert(entriesData);

      if (error) {
        console.error('[BrainDumpService] Failed to batch save brain dump:', {
          count: entries.length,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to save brain dump batch: ${error.message}`, error);
      }
      console.log(`✓ Batch synced ${entries.length} brain dump entries to cloud`);
    } catch (err) {
      console.error('[BrainDumpService] Error in saveBrainDumpBatch:', err);
      throw err;
    }
  }
}

export const brainDumpService = new BrainDumpService();
