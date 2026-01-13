# Features

**Feature modules - Complete features with UI and logic**

This folder contains complete feature implementations that combine UI components with business logic:

## ND Support (`ndSupport/`)

Split from monolithic `NDSupport.ts` into coordinated feature module:

- **BrainDump** - Thought capture and organization
- **BreakReminders** - Regular break scheduling
- **BodyDouble** - Focus buddy system
- **TextSpacing** - Reading accessibility adjustments
- **AccessibilityPreferences** - UI accessibility settings
- **ColorTheming** - Dynamic color theme adjustments

## Individual Features

Each feature in its own subfolder with barrel exports:

- **focusMode/** - Distraction-free focus environment
- **weeklyReview/** - Weekly goal reflection and planning
- **syncIssues/** - Sync status and conflict resolution
- **appSettings/** - Application preference management
- **quickAdd/** - Rapid goal/intention capture
- **zenFocus/** - Single-goal focus mode
- **garden/** - Living Garden ecosystem visualization

## Feature Module Structure

Each feature follows this pattern:

```
featureName/
├── index.ts          # Public API exports
├── FeatureName.ts    # Main feature implementation
├── types.ts          # Feature-specific types (if needed)
└── utils.ts          # Feature-specific utilities (if needed)
```

## Coordinator Pattern

Features use the coordinator pattern for complex features:

```typescript
// features/ndSupport/index.ts
export class NDSupport {
  brainDump: BrainDump;
  breakReminders: BreakReminders;
  // ... other features

  constructor() {
    this.brainDump = new BrainDump();
    this.breakReminders = new BreakReminders();
  }

  initialize() {
    this.brainDump.initialize();
    this.breakReminders.initialize();
  }
}

export const ndSupport = new NDSupport();
```

## Principles

- **Self-contained**: Features include both UI and logic
- **Composable**: Can be enabled/disabled independently
- **Testable**: Feature logic can be unit tested
- **Accessible**: All features support accessibility needs
- **Mobile-optimized**: Touch-friendly and responsive

## Usage

```typescript
import { ndSupport } from "./ndSupport";
import { FocusMode } from "./focusMode";

// Initialize features
ndSupport.initialize();

// Use individual features
const focusMode = new FocusMode();
focusMode.enable();
```

## Loading Strategy

Features are loaded dynamically to reduce initial bundle size:

```typescript
// features/featureLoaders.ts
export const focusModeLoading = import("./focusMode");
export const weeklyReviewLoading = import("./weeklyReview");
```

## Dependencies

- Can import from: `types`, `config`, `utils`, `core`, `components`, `services`
- Should contain: Complete feature implementation
- Should handle: Feature-specific state, UI, and business logic

## Adding New Features

1. Create feature subfolder: `features/newFeature/`
2. Implement main class: `NewFeature.ts`
3. Add barrel export: `index.ts`
4. Add to feature loaders if needed
5. Update main features index

## Naming Conventions

- **PascalCase** for feature classes and folders
- **camelCase** for instances and exports
- **Descriptive names** that explain feature purpose
- **Consistent structure** across all features
