# UI

**UI orchestration layer - View rendering and coordination**

This folder contains UI orchestration, rendering coordination, and view management:

## UIManager (`UIManager.ts`)

**Slimmed down orchestrator** (target: ~500 lines, currently ~2,643)

Main responsibilities:

- Application initialization
- View switching coordination
- Feature integration
- UI state management
- Event delegation

**No longer contains**: Direct rendering logic (moved to RenderCoordinator)

## Rendering (`rendering/`)

**RenderCoordinator** - View rendering orchestration:

- `RenderCoordinator.ts` - Main rendering coordinator
- `RenderCoordinator` callbacks for UI-specific rendering
- View transition management
- Scroll position handling
- Performance optimization

## Navigation (`navigation/`)

Navigation and date switching logic:

- `ViewNavigator.ts` - View switching (Year/Month/Week/Day)
- `DateNavigator.ts` - Date navigation and calendar logic

## Interactions (`interactions/`)

User interaction handling:

- `KeyboardHandler.ts` - Keyboard shortcuts and accessibility
- `TouchHandler.ts` - Touch gestures and mobile interactions
- `InstallPromptHandler.ts` - PWA install prompt management

## Panels (`panels/`)

UI panel components:

- `SupportPanel.ts` - ADHD support tools and settings access
- `SettingsPanel.ts` - Application settings (when implemented)

## State (`state/`)

UI state management:

- `UIStateManager.ts` - Transient UI state (filters, scopes, focus)

## Renderers (`renderers/`)

View-specific rendering logic:

- `YearRenderer.ts` - Year view calendar grid
- `MonthRenderer.ts` - Month view calendar
- `WeekRenderer.ts` - Week view layout
- `HomeRenderer.ts` - Mobile home dashboard
- `LivingGardenRenderer.ts` - Garden ecosystem visualization

## Viewport (`viewport/`)

Responsive design and viewport management:

- `ViewportManager.ts` - Mobile/desktop detection and breakpoints

## Gestures (`gestures/`)

Touch and gesture handling:

- `SwipeNavigator.ts` - Swipe navigation between views

## Elements (`elements/`)

DOM element caching and management:

- `UIElements.ts` - Cached DOM element references

## Principles

- **Orchestration only**: No business logic, no data manipulation
- **Coordination**: Delegates to appropriate modules
- **Performance-focused**: Optimized rendering and interactions
- **Accessibility-first**: Keyboard navigation, screen readers, touch targets
- **Mobile-optimized**: Touch interactions, responsive design

## Architecture

UI layer follows the **facade pattern**:

```typescript
// UIManager provides clean API
export const UI = {
  render: () => renderCoordinator.render(),
  navigateToView: (view) => viewNavigator.navigateToView(view),
  handleKeyboard: (e) => keyboardHandler.handleKey(e),
  // ... other UI operations
};
```

## File Structure

```
ui/
├── UIManager.ts              # Main orchestrator (being slimmed)
├── UIBridge.ts               # Legacy compatibility layer
├── rendering/                # Rendering coordination
│   └── RenderCoordinator.ts  # NEW: Moved from UIManager
├── navigation/               # Navigation logic
│   ├── ViewNavigator.ts
│   └── DateNavigator.ts
├── interactions/             # User interactions
│   ├── KeyboardHandler.ts
│   ├── TouchHandler.ts
│   └── InstallPromptHandler.ts
├── panels/                   # UI panels
│   ├── SupportPanel.ts
│   └── SettingsPanel.ts
├── state/                    # UI state
│   └── UIStateManager.ts
├── renderers/                # View renderers
├── viewport/                 # Responsive utilities
├── gestures/                 # Touch gestures
└── elements/                 # DOM element cache
```

## Dependencies

- Can import from: `types`, `config`, `utils`, `core`, `components`, `features`, `services`
- Should coordinate: View rendering, user interactions, state updates
- Should NOT contain: Business logic, data persistence, complex calculations
