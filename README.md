# Time Map

A neurodivergent-friendly time orientation tool designed to help with time blindness, planning, and overwhelm management. Time Map provides a visual calendar system with goals and built-in ADHD support features.

## Features

### 🗓️ Visual Time Orientation
- **Multiple Views**: Year, Month, Week, and Day views with smooth zooming
- **Time Blindness Support**: "You Are Here" panel showing current time context
- **Time Breakdown**: Visual breakdown of time remaining until goals (days, weeks, weekends, work sessions)
- **Progress Tracking**: Year progress indicator and time remaining statistics

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
- **Offline Support**: Data stored locally using IndexedDB
- **Responsive Design**: Works on desktop and mobile devices
- **Day Planner**: Advanced day view with drag-and-drop time scheduling

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/marlanamc/time-map.git
cd time-map
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The app will open in your browser at `http://127.0.0.1:8080`

## Available Scripts

- `npm run dev` - Start development server with live reload
- `npm run build` - Build production version (minifies JS and CSS)
- `npm run minify-js` - Minify JavaScript
- `npm run minify-css` - Minify CSS
- `npm run optimize-html` - Optimize HTML
- `npm test` / `npm run test:unit` - Run unit tests (Jest)
- `npm run test:e2e` - Run end-to-end tests (Playwright)
- `npm run test:all` - Run unit + end-to-end tests
- `npm run lint` - Run ESLint
- `npm run backup` - Backup data
- `npm run deploy` - Build and backup

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
- Click and drag to pan around the calendar

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
- **IndexedDB** (via idb library) - Local data storage
- **CSS3** - Modern styling with gradients and animations
- **HTML5** - Semantic markup with accessibility features
- **esbuild** - Fast bundling and compilation

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
├── core/                      # Base styles and variables
├── layout/                    # Layout components
├── components/                # Reusable component styles
├── views/                     # View-specific styles
├── features/                  # Feature-specific styles
├── themes/                    # Theme and accent colors
├── accessibility/             # Accessibility features
├── animations/                # Animation keyframes
├── responsive/                # Mobile-responsive styles
└── utilities/                 # Utility classes
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

The build process uses:
1. **esbuild** - Bundles TypeScript into a single JavaScript file
2. **terser** - Minifies the bundled JavaScript
3. **cleancss** - Concatenates and minifies 53 CSS files
4. **html-minifier** - Optimizes the HTML file

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








