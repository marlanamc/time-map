// ===================================
// ADHD Enhancement Components Index
// ===================================

export { TimeAnchors } from './TimeAnchors';
export { ExecutiveFunctionSupport } from './ExecutiveFunctionSupport';
export { FlowStateSupport } from './FlowStateSupport';
export { EmotionalRegulation } from './EmotionalRegulation';
export { DopamineDrivenFeatures } from './DopamineDrivenFeatures';
export { DataInsights } from '../DataInsights';
export { IOSPWAFixes } from '../../services/adhd/ios-pwa-fixes';

// Type exports
export type { 
  TimeAnchor, 
  DurationIndicator 
} from './TimeAnchors';

export type {
  QuickMode,
  DecisionTemplate,
  DecisionOption,
  TimeBlock
} from './ExecutiveFunctionSupport';

export type {
  HapticPattern,
  GestureConfig,
  FocusMode,
  VoiceCommand
} from './FlowStateSupport';

export type {
  CalmMode,
  AnxietyReductionTechnique,
  SelfCompassionMessage,
  OverwhelmPrevention
} from './EmotionalRegulation';

export type {
  Achievement,
  StreakData,
  Reward,
  InstantFeedback
} from './DopamineDrivenFeatures';

export type {
  ProductivityPattern,
  PersonalInsight,
  LearningMetrics,
  PersonalizationProfile
} from '../DataInsights';
