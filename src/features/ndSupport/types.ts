// Shared types for ND Support features
import type {
  BrainDumpEntry,
  BodyDoubleSession,
  TextSpacing,
  FontChoice,
  ColorBlindMode,
  BreakReminder,
  MaxVisibleTasks,
  FeedbackStyle,
  AccentTheme,
  Goal,
  Priority,
} from '../../types';

export interface NDSupportCallbacks {
  onShowToast?: (message: string, type?: string) => void;
  onScheduleRender?: () => void;
  onSetFocusMode?: (enabled: boolean) => void;
  onEscapeHtml?: (text: string) => string;
  onOpenGoalModal?: (level: string, month: number, year: number) => void;
  onShowKeyboardShortcuts?: () => void;
  onPickRandomGoal?: () => void;
}

export type {
  BrainDumpEntry,
  BodyDoubleSession,
  TextSpacing,
  FontChoice,
  ColorBlindMode,
  BreakReminder,
  MaxVisibleTasks,
  FeedbackStyle,
  AccentTheme,
  Goal,
  Priority,
};
