# The Garden Fence (Time Map)

A neurodivergent-friendly time orientation tool designed to help with time blindness, planning, and overwhelm management. The Garden Fence provides a visual calendar system with goals (“anchors”) plus ADHD-friendly support features, and works well on mobile + as a PWA.

## Features

### 🗓️ Visual Time Orientation
- **Multiple Views**: Year, Month, Week, and Day views with smooth zooming
- **Time Blindness Support**: "You Are Here" panel showing current time context
- **Time Breakdown**: Visual breakdown of time remaining until goals (days, weeks, weekends, work sessions)
- **Progress Tracking**: Year progress indicator and time remaining statistics
- **Mobile-first Navigation**: Swipe between views on mobile (Home ⇄ Day ⇄ Week ⇄ Month ⇄ Year)

### 🧠 ADHD Support Features

#### Focus Mode
- Reduces visual noise for better concentration
- Minimal UI with essential controls only
- No productivity tracking to reduce pressure

#### Brain Dump
- Park intrusive thoughts that interrupt focus
- Quick capture for later processing
- Helps manage overwhelm

#### Body Double Timer
- Focused work sessions with timer
- Visual timer display
- Helps maintain accountability and focus

#### Quick Wins
- Low-motivation task suggestions
- Dopamine-friendly quick completions
- Helps build momentum

#### Accessibility & Overwhelm Settings
- Customizable visual noise reduction
- Calming interface options
- Neurodivergent-friendly design

### 📍 Goal System

Time Map uses a hierarchical goal system designed to help you break down big dreams into actionable steps:

#### Four Goal Levels

1. **Vision** (Yearly) - Your big-picture aspirations and yearly outcomes
   - Long-term direction and major life goals
   - Helps anchor your year with meaningful purpose

2. **Milestone** (Quarterly) - Concrete achievements that move you toward your visions
   - 3-month checkpoints that feel achievable
   - Bridges the gap between dreams and daily actions

3. **Focus** (Monthly) - Specific projects and targets for the current month
   - Monthly themes and priorities
   - Keeps you oriented on what matters this month

4. **Intention** (Daily/Weekly) - Small, immediate actions you can do today or this week
   - Low-barrier tasks that build momentum
   - Reduces overwhelm by breaking work into tiny steps

#### Additional Features

- **Categories**: Organize by Career, Health, Finance, Personal, Creative
- **Priority Levels**: Low, Medium, High, Urgent
- **Time Blocks**: Schedule specific start and end times for goals in Day view
- **Achievements**: Track completed goals with celebration
- **Coming Up**: See upcoming goals to reduce decision paralysis

### ✨ Additional Features
- **Affirmations**: Clickable affirmations for emotional regulation
- **Surprise Me**: Random goal selection when you can't decide
- **Confetti Celebrations**: Visual rewards for completing goals
- **Offline Support**: Data is stored locally (IndexedDB) and the UI shows an offline indicator when you lose connection
- **Responsive Design**: Works on desktop and mobile devices
- **Day Planner**: Advanced day view with drag-and-drop time scheduling
- **PWA Install + Shortcuts**: Install button in Support Tools when available; home-screen shortcuts for “New intention” and “Today”

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm
- Python 3 (optional, only for generating iOS splash screens)

### Installation

1. Clone the repository (or your fork):
```bash
git clone <your-repo-url>
cd visionboard
```

2. Install dependencies:
```bash
npm install
```

3. (Optional) Configure Supabase for login + cloud sync:
   - Copy `.env.example` → `.env.local`
   - Fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY`

4. Start the development server:
```bash
npm run dev
```

The app will auto-open in your browser at `http://localhost:4173`.

If Supabase is not configured, the app runs in local-only mode (no login/cloud sync).

## PWA (Install / Offline / iOS)

- **Install**: Open the Support Tools menu → “Install App” (only shows when the browser fires `beforeinstallprompt`).
- **Offline indicator**: Shows in the header when you go offline and the sync badge switches to “Offline”.
- **Home screen shortcuts**:
  - `./?action=new-task` → opens Day view + Quick Add
  - `./?view=day` → opens Day view

### iOS Splash Screens

Splash images live in `splash/`. To (re)generate them:
```bash
python3 scripts/generate-ios-splashes.py
```

## Available Scripts

### Development
- `npm run dev` - Start Vite dev server with instant Hot Module Replacement (HMR)
- `npm run preview` - Preview production build locally
- `npm run serve` - Serve the app with the static server (mainly for legacy/test flows)

### Build
- `npm run build` - Build production version with Vite (outputs to `dist/`)
- `npm run build:legacy` - Legacy build process (esbuild + terser + cleancss)

### Testing
- `npm test` / `npm run test:unit` - Run unit tests (Jest)
- `npm run test:e2e` - Run end-to-end tests (Playwright)
- `npm run test:all` - Run unit + end-to-end tests
- `npm run test:serve` - Build + serve a deterministic bundle for Playwright

### Other
- `npm run lint` - Run ESLint
- `npm run backup` - Backup data
- `npm run deploy` - Build and backup

## Development Workflow

This project uses **Vite** for an incredibly fast development experience:

1. **Start developing:** `npm run dev`
2. **Make changes** to CSS/TypeScript → Changes appear instantly (HMR!)
3. **No manual refresh needed** - Vite handles everything automatically
4. **Build for production:** `npm run build`

### Key Development Features
- ⚡ **Instant HMR** - See changes in milliseconds, not seconds
- 🔥 **Native TypeScript** - No separate compile step
- 📦 **CSS Bundling** - All styles imported via `styles/main.css`
- 🚀 **Fast Builds** - Production builds in ~1.5 seconds

## Usage

### Adding a Goal

1. Click the "+" button (FAB) in the bottom right
2. Enter your goal title
3. Select the goal level (Vision, Milestone, Focus, or Intention)
4. Select the month and year
5. Optionally add a category, priority, and time blocks
6. Click "Save"

### Navigating Time
- Use the view switcher (Year/Month/Week/Day) to change zoom level
- Use arrow buttons or "Today" to navigate dates
- Use zoom controls (+/-) to zoom in/out on the calendar
- Desktop: click and drag to pan around the calendar
- Mobile: swipe between views; use native scrolling (no click-drag panning)

### Using ADHD Support Features
- **Focus Mode**: Toggle the Focus switch in the header to reduce visual noise
- **Brain Dump**: Click "Brain Dump" in the menu (⋯) to park intrusive thoughts
- **Body Double**: Click "Body Double" to start a focused work session timer
- **Quick Wins**: Click "Quick Wins" for low-motivation task suggestions
- **Settings**: Click "Accessibility & Overwhelm" to customize the interface

### Managing Goals

- Click a goal on the calendar to view details and edit
- Click "Surprise me" in the Coming Up section for random selection
- Filter goals by category using the Scope filters
- Mark goals as complete to celebrate achievements
- Drag and drop goals in Day view to schedule specific times

## Technology Stack

- **TypeScript** - Type-safe JavaScript with modern ES6+ features
- **Vite** - Next-generation frontend tooling with instant HMR
- **IndexedDB** (via idb library) - Local data storage
- **Supabase** (optional) - Cloud sync and authentication
- **CSS3** - Modern styling with CSS custom properties and animations
- **HTML5** - Semantic markup with accessibility features

## Project Structure

The codebase is organized into a modular architecture for better maintainability and type safety:

```
src/
├── app.ts                      # Application entry point and bootstrap
├── types.ts                    # Shared TypeScript type definitions
│
├── components/                 # Reusable UI components
│   └── dayView/               # Day view planner components
│       ├── DayViewController.ts
│       ├── PlannerDayViewRenderer.ts
│       ├── SimpleDayViewRenderer.ts
│       └── types.ts
│
├── config/                     # Application configuration
│   ├── constants.ts           # Global constants (CONFIG)
│   ├── views.ts               # View type definitions (VIEWS)
│   ├── ndConfig.ts            # Neurodivergent support config
│   └── index.ts               # Configuration exports
│
├── core/                       # Core business logic
│   ├── State.ts               # Application state management
│   ├── Goals.ts               # Goal/anchor CRUD operations
│   ├── Planning.ts            # Weekly reviews & planning
│   ├── Analytics.ts           # Goal analytics and tracking
│   ├── Streaks.ts             # Streak tracking logic
│   └── index.ts               # Core module exports
│
├── features/                   # Feature modules
│   ├── NDSupport.ts           # ADHD/neurodivergent support features
│   ├── AppSettings.ts         # Settings panel and preferences
│   └── index.ts               # Feature exports
│
├── garden/                     # Garden visualization engine
│   ├── gardenEngine.ts        # Animated background system
│   └── timeSystem.ts          # Time-based garden calculations
│
├── services/                   # External services and utilities
│   ├── SupabaseService.ts     # Cloud sync (optional)
│   ├── DirtyTracker.ts        # Change tracking for sync
│   └── storage.ts             # IndexedDB wrapper
│
├── theme/                      # Theming system
│   └── ThemeManager.ts        # Theme and accent color management
│
├── ui/                         # UI orchestration and rendering
│   ├── UIManager.ts           # Main UI controller
│   ├── gestures/
│   │   └── SwipeNavigator.ts   # Mobile swipe navigation
│   ├── elements/
│   │   └── UIElements.ts      # DOM element caching
│   ├── feedback/
│   │   ├── Toast.ts           # Toast notifications
│   │   └── Celebration.ts     # Celebration animations
│   └── renderers/
│       ├── YearRenderer.ts    # Year view rendering
│       ├── MonthRenderer.ts   # Month view rendering
│       ├── WeekRenderer.ts    # Week view rendering
│       ├── DayRenderer.ts     # Day view rendering
│       ├── HomeRenderer.ts    # Mobile home view
│       └── index.ts           # Renderer exports
│
└── utils/                      # Utility functions
    ├── TimeBreakdown.ts       # Time calculation utilities
    ├── modalManager.ts        # Modal dialog management
    └── syncHelpers.ts         # Sync debouncing helpers

styles/                         # CSS organization
├── main.css                   # 📍 CSS entry point (imports all others)
├── core/                      # Base styles, variables, and reset
├── background/                # Garden background effects
├── layout/                    # App layout and header
├── components/                # Buttons, modals, sidebar
├── views/                     # Year, month, week, day views
├── dayView/                   # Day planner specific styles
├── features/                  # Feature-specific styles (focus mode, etc.)
├── themes/                    # Theme and accent colors
├── accessibility/             # WCAG, dyslexia, high contrast
├── animations/                # Animation keyframes
├── responsive/                # Mobile-responsive styles
├── mobile/                    # Mobile-specific overrides
├── utilities/                 # Print styles, utilities
└── custom/                    # Custom component styles
```

### Architecture Principles

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Type Safety**: TypeScript types defined in `types.ts` ensure consistency across modules
3. **Dependency Injection**: Modules accept callbacks to avoid circular dependencies
4. **Progressive Enhancement**: Core features work independently, advanced features layer on top

### Key Modules

- **State Management** (`core/State.ts`): Centralized state with IndexedDB persistence
- **UI Manager** (`ui/UIManager.ts`): Coordinates all UI rendering and user interactions
- **ND Support** (`features/NDSupport.ts`): ADHD-specific features (brain dump, body double, etc.)
- **Day View Controller** (`components/dayView/`): Advanced day planner with drag-and-drop

### Build Process

The build process uses **Vite** for modern, optimized production builds:

1. **Vite** - Bundles TypeScript and CSS with tree-shaking and code splitting
2. **esbuild** - Fast minification (used by Vite internally)
3. **Rollup** - Production bundling with optimal chunk splitting

**Output Structure:**
```
dist/
├── index.html           # Optimized HTML
├── assets/
│   ├── main-[hash].js   # Bundled JavaScript (~450KB, ~114KB gzipped)
│   ├── main-[hash].css  # Bundled CSS (~240KB, ~40KB gzipped)
│   └── [assets]         # Icons and other assets
├── env.js               # Environment configuration
├── sw.js                # Service worker
├── icons/               # App icons
└── manifest.webmanifest # PWA manifest
```

All source TypeScript files compile without errors and maintain strict type safety.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Accessibility

Time Map is designed with accessibility in mind:
- ARIA labels and roles throughout
- Keyboard navigation support
- Screen reader friendly
- High contrast options
- Dyslexia-friendly font options (Lexend)
- Reduced motion support

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

Designed specifically for neurodivergent individuals, especially those with ADHD, to help manage time blindness and overwhelm.

---

Made with ❤️ for the neurodivergent community






