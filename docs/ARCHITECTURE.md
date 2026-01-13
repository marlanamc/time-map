# Architecture Overview

## 📁 Folder Structure & Responsibilities

This document explains the codebase organization, import patterns, and development guidelines.

### Core Principles

1. **Separation of Concerns**: Each folder has a specific responsibility
2. **Dependency Direction**: Lower-level folders don't import from higher-level ones
3. **Single Responsibility**: Files and modules do one thing well
4. **Testability**: Code organized for easy unit testing
5. **Maintainability**: Clear patterns and consistent structure

---

## 📂 `src/` - Source Code Organization

### `core/` - Business Logic Layer
```
core/
├── Goals.ts          # Goal CRUD, validation, business rules
├── Events.ts         # Calendar event management
├── Planning.ts       # Task planning and scheduling
├── Analytics.ts      # User behavior analytics
├── Streaks.ts        # Achievement and streak logic
├── State.ts          # Application state management
├── StateController.ts # State orchestration
├── WeekReflections.ts # Weekly review functionality
├── IntentionsManager.ts # Intention tracking
├── DataStore.ts      # Local data persistence
├── EventBus.ts       # Application-wide events
└── ErrorHandling.ts  # Centralized error management
```

**Responsibilities:**
- Pure business logic, NO UI, NO DOM
- Framework-agnostic domain logic
- All functions testable without UI
- No CSS classes, no DOM manipulation

**Dependencies:** Can import from `types`, `config`, other `core` modules

---

### `services/` - Infrastructure Services
```
services/
├── database/         # Local storage (IndexedDB)
├── supabase/         # Cloud services (split from monolithic service)
├── sync/            # Data synchronization
├── cache/           # Application caching
├── pwa/             # PWA-specific services
└── errors.ts        # Error handling
```

**Responsibilities:**
- External API integrations
- Data persistence and retrieval
- Background synchronization
- Service worker management
- Error reporting and handling

**Dependencies:** Can import from `types`, `config`, `core`, `utils`

---

### `components/` - UI Components
```
components/
├── modals/          # Modal dialogs (class-based)
│   ├── BaseModal.ts
│   ├── GoalModal/   # Modular goal creation modal
│   └── [other modals]
├── dayView/         # Day view components
│   ├── DayViewController.ts
│   ├── DayViewRenderer.ts    # NEW: Extracted rendering
│   ├── DayViewEvents.ts      # NEW: Extracted events
│   ├── DayViewTimeline.ts    # NEW: Extracted timeline
│   └── [supporting components]
└── feedback/        # User feedback components
```

**Responsibilities:**
- Reusable UI components
- Class-based component architecture
- Single responsibility per component
- Accessible and mobile-optimized

**Dependencies:** Can import from `types`, `config`, `utils`, `core`

---

### `features/` - Feature Modules
```
features/
├── ndSupport/       # ADHD support tools (split from monolithic)
├── focusMode/       # Distraction-free mode
├── weeklyReview/    # Weekly planning
├── appSettings/     # Application preferences
├── quickAdd/        # Rapid goal capture
├── zenFocus/        # Single-goal focus
└── garden/          # Living Garden ecosystem
```

**Responsibilities:**
- Complete feature implementations
- Combine UI components with logic
- Self-contained and testable
- Can be enabled/disabled independently

**Dependencies:** Can import from all other folders

---

### `ui/` - UI Orchestration
```
ui/
├── UIManager.ts     # Main UI orchestrator (being slimmed)
├── rendering/       # View rendering coordination
├── navigation/      # Navigation logic
├── interactions/    # User interaction handling
├── panels/          # UI panels
├── state/           # UI state management
├── renderers/       # View-specific renderers
├── viewport/        # Responsive utilities
├── gestures/        # Touch gestures
└── elements/        # DOM element caching
```

**Responsibilities:**
- UI coordination and orchestration
- View switching and rendering
- User interaction handling
- Responsive design management
- Accessibility coordination

**Dependencies:** Can import from all folders (orchestration layer)

---

### `utils/` - Pure Utilities
```
utils/
├── goalLinkage.ts   # Goal relationship utilities
├── haptics.ts       # Haptic feedback utilities
├── modalManager.ts  # Modal coordination
├── recurrence.ts    # Recurrence pattern handling
└── TimeBreakdown.ts # Time calculation utilities
```

**Responsibilities:**
- Pure utility functions
- No side effects
- Framework-agnostic
- Easily testable

**Dependencies:** Minimal, mostly `types` and `config`

---

### `types.ts` & `config/` - Shared Definitions
```
types.ts            # Main type definitions
config/
├── constants.ts    # Application constants
├── ndConfig.ts     # ADHD-specific configuration
└── views.ts        # View configuration
```

**Responsibilities:**
- Type definitions and interfaces
- Configuration constants
- Shared enums and constants

**Dependencies:** None (imported by all)

---

## 🔄 Import Patterns & Rules

### Dependency Flow
```
types/config ← core ← utils ← services
                    ↗        ↗
              components ← features ← ui
```

**Allowed imports:**
- `types` → everywhere
- `config` → everywhere
- `core` → `services`, `components`, `features`, `ui`
- `utils` → `services`, `components`, `features`, `ui`
- `services` → `components`, `features`, `ui`
- `components` → `features`, `ui`
- `features` → `ui`

**Forbidden imports:**
- Higher-level folders importing from lower-level ones
- `ui` importing from `core` (except through services)
- Circular dependencies

### Import Style Guidelines

```typescript
// Barrel exports (preferred)
import { Goals, Events } from '../core';

// Named imports
import { createGoal } from '../core/Goals';
import type { Goal } from '../types';

// Dynamic imports for features
const focusMode = await import('../features/focusMode');
```

---

## 🏗️ Adding New Features

### 1. Choose Appropriate Folder

| Feature Type | Folder | Example |
|-------------|--------|---------|
| Business Logic | `core/` | New goal validation rules |
| Data/API Service | `services/` | New cloud integration |
| UI Component | `components/` | New modal or widget |
| Complete Feature | `features/` | New ADHD support tool |
| UI Coordination | `ui/` | New view or interaction |
| Utility Function | `utils/` | New date helper |

### 2. Follow Naming Conventions

**Files & Classes:**
- **PascalCase** for components, classes, and main exports
- **camelCase** for utilities, functions, and instances

**Folders:**
- **camelCase** for feature folders (`focusMode/`, `weeklyReview/`)
- **lowercase** for organizational folders (`core/`, `services/`)

**Examples:**
```typescript
// ✅ Correct
class GoalModal extends BaseModal {}
export const goalModal = new GoalModal();
function calculateTimeBreakdown() {}

// ❌ Incorrect
class goalModal extends BaseModal {}
export const GoalModal = new GoalModal();
function CalculateTimeBreakdown() {}
```

### 3. Implement with Proper Structure

**Components:**
```typescript
// components/newFeature/NewFeature.ts
export class NewFeature {
  constructor(options: NewFeatureOptions) { /* ... */ }
  render() { /* ... */ }
  destroy() { /* ... */ }
}
```

**Features:**
```typescript
// features/newFeature/NewFeature.ts
export class NewFeature {
  initialize() { /* ... */ }
  enable() { /* ... */ }
  disable() { /* ... */ }
}

// features/newFeature/index.ts
export { NewFeature } from './NewFeature';
```

**Services:**
```typescript
// services/newService.ts
export class NewService {
  async operation(): Promise<Result> { /* ... */ }
}
export const newService = new NewService();
```

---

## 🧪 Testing Guidelines

### Unit Tests (`tests/unit/`)
- Test business logic in `core/`
- Test utilities in `utils/`
- Test services with mocked dependencies
- Test components with DOM mocking

### Integration Tests (`tests/integration/`)
- Test feature interactions
- Test service integrations
- Test UI component assemblies

### E2E Tests (`tests/e2e/`)
- Test complete user workflows
- Test cross-device synchronization
- Test PWA functionality

---

## 🚀 Development Workflow

### Adding a New Goal Type

1. **Define types** in `types.ts`
2. **Add business logic** in `core/Goals.ts`
3. **Create UI component** in `components/modals/`
4. **Add to services** in `services/supabase/GoalsService.ts`
5. **Integrate in UI** via `UIManager.ts`

### Adding a New Feature

1. **Create feature folder** `features/newFeature/`
2. **Implement feature class** `NewFeature.ts`
3. **Add barrel export** `index.ts`
4. **Add to feature loaders** `featureLoaders.ts`
5. **Integrate in UI** via `UIManager.ts`

---

## 🔧 Maintenance Notes

### Recent Major Changes
- ✅ **UIManager breakdown**: Rendering logic moved to `RenderCoordinator`
- ✅ **GoalModal migration**: Converted to class-based component with submodules
- ✅ **NDSupport split**: Broken into coordinated feature module
- ✅ **SupabaseService split**: Domain-specific services created
- ✅ **Folder reorganization**: Clear responsibilities established
- ✅ **DayViewController split**: Modular components created
- ✅ **Code deduplication**: `upsertInternalTag()` consolidated
- ✅ **Feature reorganization**: All UIs moved to proper subfolders

### Performance Considerations
- Features loaded dynamically to reduce bundle size
- Services handle offline/sync scenarios
- UI rendering optimized with `RenderCoordinator`
- Components follow mobile-first responsive design

### Accessibility Requirements
- All components support keyboard navigation
- Screen reader compatibility maintained
- Touch targets meet minimum size requirements
- High contrast modes supported
- Reduced motion preferences respected