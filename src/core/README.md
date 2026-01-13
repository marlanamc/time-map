# Core

**Business logic layer - NO UI, NO DOM**

This folder contains pure domain logic for:

- **Goals management** (`Goals.ts`) - Goal CRUD, validation, business rules
- **Event handling** (`Events.ts`) - Calendar event management
- **Planning logic** (`Planning.ts`) - Task planning and scheduling
- **Analytics tracking** (`Analytics.ts`) - User behavior analytics
- **Streak management** (`Streaks.ts`) - Achievement and streak logic
- **State management** (`State.ts`, `StateController.ts`) - Application state
- **Week reflections** (`WeekReflections.ts`) - Weekly review functionality
- **Intentions system** (`IntentionsManager.ts`) - Intention tracking
- **Data storage** (`DataStore.ts`) - Local data persistence
- **Event bus** (`EventBus.ts`) - Application-wide event communication
- **Error handling** (`ErrorHandling.ts`) - Centralized error management

## Principles

- **Framework-agnostic**: No UI, no DOM manipulation, no CSS classes
- **Pure functions**: Side-effect free where possible
- **Testable**: All logic can be unit tested without UI
- **Domain-focused**: Business rules and data transformations only

## Usage

```typescript
import { Goals } from "../core/Goals";
import { State } from "../core/State";

// Business logic only - no UI concerns
const goal = Goals.create({ title: "Learn TypeScript" });
State.updateCurrentGoal(goal);
```

## File Naming

- **PascalCase** for classes and main exports
- **camelCase** for utility functions and helpers
- **Clear, descriptive names** that explain purpose

## Dependencies

- Can import from: `types`, `config`, other core modules
- Should NOT import from: `ui`, `components`, `features`, DOM APIs
