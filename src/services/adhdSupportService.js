import DB from '../db';
import { errorHandler, DatabaseError } from '../utils/errorHandler';
import { dirtyTracker } from './DirtyTracker';

class ADHDSupportService {
  constructor() {
    this.bodyDoubleTimer = null;
    this.focusSessions = [];
    this.currentFocusSession = null;
    this.breakReminderInterval = null;
  }

  // Body Doubling
  async startBodyDoubleSession(duration, options = {}) {
    try {
      if (this.bodyDoubleTimer) {
        this.stopBodyDoubleSession();
      }

      const session = {
        id: `bd_${Date.now()}`,
        startTime: new Date(),
        duration,
        type: options.type || 'solo', // 'solo' or 'with_partner'
        partner: options.partner || null,
        goalId: options.goalId || null,
        status: 'active'
      };

      // Save session to database
      await DB.add('bodyDoubleSessions', session);
      
      // Set timer to end session
      this.bodyDoubleTimer = setTimeout(() => {
        this.completeBodyDoubleSession(session.id);
      }, duration * 60 * 1000);

      // Start break reminders if enabled
      this.setupBreakReminders(duration);

      return session;
    } catch (error) {
      throw new DatabaseError('Failed to start body double session', { error });
    }
  }

  async completeBodyDoubleSession(sessionId) {
    try {
      if (this.bodyDoubleTimer) {
        clearTimeout(this.bodyDoubleTimer);
        this.bodyDoubleTimer = null;
      }
      
      if (this.breakReminderInterval) {
        clearInterval(this.breakReminderInterval);
        this.breakReminderInterval = null;
      }

      const session = await DB.get('bodyDoubleSessions', sessionId);
      if (session) {
        session.endTime = new Date();
        session.status = 'completed';
        await DB.update('bodyDoubleSessions', session);
        
        // Trigger celebration if session was successful
        if (session.duration >= 15) { // Minimum 15 minutes for celebration
          this.triggerCelebration('bodyDoubleComplete', {
            duration: session.duration,
            type: session.type
          });
        }
      }

      return true;
    } catch (error) {
      throw new DatabaseError('Failed to complete body double session', { error });
    }
  }

  // Focus Sessions
  async startFocusSession(goalId, options = {}) {
    try {
      const session = {
        id: `fs_${Date.now()}`,
        startTime: new Date(),
        goalId,
        status: 'active',
        distractions: [],
        ...options
      };

      this.currentFocusSession = session;
      this.focusSessions.push(session);

      // Auto-save the session every 60 seconds (optimized from 30s)
      this.autoSaveInterval = setInterval(() => {
        this.saveFocusSessions();
      }, 60000);

      return session;
    } catch (error) {
      throw new DatabaseError('Failed to start focus session', { error });
    }
  }

  async endFocusSession(sessionId, notes = '') {
    try {
      const session = this.focusSessions.find(s => s.id === sessionId);
      if (!session) return null;

      session.endTime = new Date();
      session.status = 'completed';
      session.notes = notes;
      session.duration = (session.endTime - session.startTime) / 1000 / 60; // in minutes

      // Save to database
      await DB.add('focusSessions', session);
      
      // Clear auto-save interval
      if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = null;
      }

      // Remove from active sessions
      this.focusSessions = this.focusSessions.filter(s => s.id !== sessionId);
      if (this.currentFocusSession?.id === sessionId) {
        this.currentFocusSession = null;
      }

      // Trigger celebration if session was productive
      if (session.duration >= 25) {
        this.triggerCelebration('focusSessionComplete', {
          duration: session.duration,
          distractions: session.distractions?.length || 0
        });
      }

      return session;
    } catch (error) {
      throw new DatabaseError('Failed to end focus session', { error });
    }
  }

  // Break Management
  setupBreakReminders(sessionDuration) {
    if (this.breakReminderInterval) {
      clearInterval(this.breakReminderInterval);
    }

    // Default to 5-minute break every 25 minutes (Pomodoro style)
    const workInterval = 25 * 60 * 1000; // 25 minutes
    const breakDuration = 5 * 60 * 1000; // 5 minutes

    this.breakReminderInterval = setInterval(() => {
      this.promptBreak(breakDuration);
    }, workInterval);
  }

  async promptBreak(duration) {
    // This would trigger a UI notification
    const notification = new Notification('Time for a break!', {
      body: `You've been working hard. Take a ${duration / 60000} minute break.`,
      icon: '/icons/notification-icon.png',
      requireInteraction: true
    });

    // Add click handler to start break timer
    notification.onclick = () => {
      this.startBreakTimer(duration);
    };
  }

  async startBreakTimer(duration) {
    // This would update the UI to show a break timer
    console.log(`Starting ${duration / 60000} minute break`);
    
    // You could add break activities here, like breathing exercises or stretches
    return new Promise(resolve => {
      setTimeout(() => {
        this.endBreak();
        resolve();
      }, duration);
    });
  }

  endBreak() {
    // This would update the UI to end the break
    console.log('Break ended');
    
    // Ask if user is ready to return to work
    const notification = new Notification('Break time is over!', {
      body: 'Ready to get back to work?',
      icon: '/icons/notification-icon.png'
    });
  }

  // Brain Dump
  async addBrainDumpItem(content, category = 'general', priority = 'medium') {
    try {
      const item = {
        id: `bd_${Date.now()}`,
        content,
        category,
        priority,
        createdAt: new Date(),
        status: 'new',
        tags: []
      };

      await DB.add('brainDump', item);
      return item;
    } catch (error) {
      throw new DatabaseError('Failed to add brain dump item', { error });
    }
  }

  async processBrainDumpItem(itemId, action, options = {}) {
    try {
      const item = await DB.get('brainDump', itemId);
      if (!item) throw new Error('Brain dump item not found');

      switch (action) {
        case 'convertToTask':
          // Convert to a task/goal
          const goal = await this.convertToGoal(item, options);
          item.status = 'converted_to_task';
          item.linkedItemId = goal.id;
          break;
          
        case 'schedule':
          // Schedule for later
          item.status = 'scheduled';
          item.scheduledFor = options.when;
          break;
          
        case 'archive':
          // Archive the item
          item.status = 'archived';
          break;
          
        case 'delete':
          // Delete the item
          await DB.delete('brainDump', itemId);
          return null;
      }

      await DB.update('brainDump', item);
      return item;
    } catch (error) {
      throw new DatabaseError(`Failed to process brain dump item: ${action}`, { 
        error,
        itemId,
        action 
      });
    }
  }

  // Helper Methods
  async convertToGoal(brainDumpItem, options = {}) {
    // This would create a goal from a brain dump item
    const goal = {
      id: `goal_${Date.now()}`,
      title: brainDumpItem.content,
      description: options.description || '',
      category: brainDumpItem.category || 'personal',
      priority: brainDumpItem.priority || 'medium',
      status: 'not-started',
      createdAt: new Date(),
      tags: [...(brainDumpItem.tags || []), 'from-brain-dump']
    };

    await DB.add('goals', goal);
    return goal;
  }

  triggerCelebration(type, data = {}) {
    // This would trigger a celebration in the UI
    const event = new CustomEvent('celebration', {
      detail: { type, ...data }
    });
    
    window.dispatchEvent(event);
  }

  async saveFocusSessions() {
    try {
      // Only save sessions that are dirty (modified)
      const sessionsToSave = this.focusSessions.filter(s =>
        s.status === 'active' && dirtyTracker.isDirty('focusSession', s.id)
      );

      if (sessionsToSave.length === 0) {
        // Nothing to save, skip this interval
        return;
      }

      // Batch update in IndexedDB
      if (sessionsToSave.length > 1) {
        await DB.bulkUpdate('focusSessions', sessionsToSave);
      } else {
        await DB.update('focusSessions', sessionsToSave[0]);
      }

      // Mark all as clean after successful save
      sessionsToSave.forEach(s => {
        dirtyTracker.markClean('focusSession', s.id);
      });

      console.log(`Auto-saved ${sessionsToSave.length} focus sessions`);
    } catch (error) {
      console.error('Failed to auto-save focus sessions:', error);
    }
  }

  recordDistraction(sessionId) {
    const session = this.focusSessions.find(s => s.id === sessionId);
    if (session) {
      session.distractions.push(new Date());
      // Mark session as dirty when modified
      dirtyTracker.markDirty('focusSession', sessionId);
    }
  }
}

export default new ADHDSupportService();
