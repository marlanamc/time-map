# Components

**Reusable UI components - ALL user interface elements**

This folder contains all reusable UI components, organized by feature and type:

## Modal Components (`modals/`)

Class-based modal components extending `BaseModal`:

- **GoalModal** - Multi-tab goal creation/editing modal

  - `GoalModal.ts` - Main modal class
  - `timeContext.ts` - Time-based goal suggestions
  - `domHelpers.ts` - DOM manipulation utilities
  - `dateUtils.ts` - Date formatting and parsing
  - `renderers.ts` - Modal section rendering
  - `linkageHelpers.ts` - Goal relationship management
  - `suggestions.ts` - AI-assisted goal suggestions

- **GoalDetailModal** - Goal viewing/editing modal
- **EventModal** - Calendar event creation/editing
- **MonthDetailModal** - Month overview modal
- **BaseModal** - Abstract base class for all modals

## Day View Components (`dayView/`)

Day view implementation (flattened from nested structure):

- **DayViewController** - Main day view orchestrator (312 lines)
- **DayViewRenderer** - Rendering logic extraction
- **DayViewEvents** - Event handling extraction
- **DayViewTimeline** - Timeline coordination
- **DayViewState** - View state management

Supporting components:

- **PlannerDayViewRenderer** - Day view layout rendering
- **DragDropManager** - Drag and drop functionality
- **CustomizationPanel** - Day view customization UI
- **CardComponent** - Individual goal cards
- **TimelineGrid** - Timeline visual grid
- And 15+ specialized day view components

## Feedback Components (`feedback/`)

User feedback and notifications:

- **Toast** - Non-intrusive notifications
- **Celebration** - Achievement celebrations (currently disabled)

## Principles

- **Class-based**: Components are classes, not functions
- **Single responsibility**: Each component does one thing well
- **Composable**: Components can be nested and combined
- **Accessible**: ARIA labels, keyboard navigation, screen reader support
- **Mobile-first**: Touch-friendly interactions and responsive design

## Usage

```typescript
import { GoalModal } from "./modals";
import { DayViewController } from "./dayView";

// Create component instances
const goalModal = new GoalModal();
const dayView = new DayViewController(container, callbacks, config);

// Use components
goalModal.open({ level: "intention" });
dayView.mount();
```

## File Structure

```
components/
├── modals/           # All modal dialogs
│   ├── BaseModal.ts
│   ├── GoalModal/    # Modular goal modal
│   └── [other modals]
├── dayView/          # Day view components (flattened)
│   ├── DayViewController.ts
│   ├── DayViewRenderer.ts    # NEW: Extracted rendering
│   ├── DayViewEvents.ts      # NEW: Extracted events
│   ├── DayViewTimeline.ts    # NEW: Extracted timeline
│   └── [supporting components]
├── feedback/         # User feedback components
└── index.ts          # Barrel exports
```

## Naming Conventions

- **PascalCase** for component classes and files
- **camelCase** for utility functions
- **Descriptive names** that explain component purpose
- **Suffix conventions**:
  - `Modal` for modal dialogs
  - `Controller` for main component orchestrators
  - `Renderer` for rendering logic
  - `Manager` for coordination logic

## Dependencies

- Can import from: `types`, `config`, `utils`, `core` (business logic)
- Should NOT import from: `services` (infrastructure), `features` (feature modules)
- Can reference: DOM APIs, CSS classes, other components
