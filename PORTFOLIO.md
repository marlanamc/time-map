# The Garden Fence — Portfolio Entry

## 1. The High-Level Metadata

**Role:** Creator & Full-Stack Developer  
**Status:** Live Product (Production-Ready)  
**The "North Star" Metric:** Zero cognitive overhead for neurodivergent users — designed to reduce time blindness and planning overwhelm without creating maintenance burden  
**Tech Stack:** TypeScript, Vite, Supabase (PostgreSQL + RLS), IndexedDB, CSS3, HTML5, PWA

---

## 2. The Narrative

### The Challenge

**Pre-solution state:** Existing productivity tools assume consistent attention, linear planning, and sustained discipline. For people with ADHD and time blindness, this creates a cycle of:
- Planning optimistically, then losing track of time
- Forgetting longer-term goals when daily tasks pile up
- Feeling guilty when systems collapse under maintenance overhead
- Tools that don't address the core issue: **making time visible and keeping long-term goals present without pressure**

Traditional planners (TickTick, paper planners) fail when time perception stretches or compresses. They don't help users feel where they are in time or maintain connection to yearly visions during daily chaos.

### The Solution

Built a visual time-orientation tool with three key pillars:

#### **Pillar 1: Multi-Scale Time Visualization**
- **Year/Month/Week/Day views** with smooth zooming and panning
- **"You Are Here" panel** that constantly shows current time context (day of year, time remaining today, weeks left in year)
- **Visual time breakdown** showing time remaining in multiple units (days, weeks, weekends, work sessions)
- **Garden metaphor** — goals as plants that grow over time, making progress visible without pressure

#### **Pillar 2: ADHD-Specific Support Features**
- **Focus Mode:** Reduces visual noise for better concentration (no productivity tracking to avoid pressure)
- **Brain Dump:** Quick capture for intrusive thoughts that interrupt focus
- **Body Double Timer:** Focused work sessions with visual accountability
- **Quick Wins:** Low-motivation task suggestions for dopamine-friendly completions
- **Affirmations:** Clickable emotional regulation support
- **"Surprise Me" button:** Random selection to combat decision paralysis

#### **Pillar 3: Hierarchical Goal System**
- **Four-level structure:** Vision (yearly) → Milestone (quarterly) → Focus (monthly) → Intention (daily/weekly)
- **Visual linkage:** See how daily actions connect to longer-term goals
- **No obligation:** System shows relationships but never demands maintenance
- **Category organization:** Career, Health, Finance, Personal, Creative

---

## 3. The "Modern Builder" Perspective

### Speed to Market

- **Prototype to production:** Built as a solo project with modern tooling
- **Vite-powered development:** Instant HMR (Hot Module Replacement) enabled rapid iteration
- **TypeScript-first:** Type safety caught errors early, reducing debugging time
- **Modular architecture:** Clean separation of concerns allowed parallel feature development

### Technical Highlights

#### **Complex State Management**
- Built custom state management system (`State.ts`, `StateController.ts`) without framework overhead
- Event-driven architecture using `EventBus` pattern for decoupled UI ↔ State communication
- Offline-first design with IndexedDB for local persistence
- Optimistic UI updates with background sync queue

#### **Advanced Supabase Implementation**
- **Row Level Security (RLS):** Implemented comprehensive RLS policies across 6+ tables ensuring users can only access their own data
- **Multi-device sync:** Built sync queue system that handles offline changes, conflict resolution, and batch operations
- **Performance optimization:** Added strategic indexes for common query patterns (user_id, date ranges, hierarchical lookups)
- **Graceful degradation:** App works fully offline when Supabase isn't configured

#### **WCAG 2.1 AA Accessibility Focus**
- **Comprehensive ARIA:** All interactive elements have proper roles, labels, and live regions
- **Keyboard navigation:** Full keyboard support with arrow key navigation in grids, focus traps in modals, and logical tab order
- **Screen reader compatibility:** Tested with VoiceOver, NVDA, and JAWS
- **Visual accessibility:** High contrast modes, dyslexia-friendly fonts (Lexend), reduced motion support, colorblind-friendly themes
- **Touch targets:** All mobile targets meet 44x44px minimum
- **Lighthouse scores:** Accessibility 95-100, Performance 85-95

#### **PWA Excellence**
- **Offline-first:** Service worker caches assets, IndexedDB stores all data locally
- **Install prompts:** Native PWA install with home screen shortcuts
- **iOS optimization:** Custom splash screens for multiple device sizes (iPhone 12, 13, 14 Pro)
- **Responsive design:** Mobile-first with swipe navigation, desktop with drag-to-pan

### Orchestration: Full-Stack Implementation

**Database Layer:**
- Designed PostgreSQL schema with hierarchical goal relationships (`parent_id`, `parent_level`)
- Created 12+ migration files with proper RLS policies
- Implemented soft-delete pattern (`archived_at`) for data safety and scalability

**Backend Services:**
- Built Supabase service layer with domain-specific services (GoalsService, PreferencesService, etc.)
- Implemented sync queue with retry logic and conflict resolution
- Created cache service with TTL for performance

**Frontend Architecture:**
- Modular folder structure: `core/` (business logic), `services/` (infrastructure), `components/` (UI), `features/` (complete features), `ui/` (orchestration)
- Class-based component architecture for lifecycle management
- View renderers separated from controllers for testability
- CSS custom properties for theming system (light/dark, time-of-day themes, seasonal themes)

**Testing Infrastructure:**
- Unit tests with Jest (business logic, utilities)
- E2E tests with Playwright (accessibility, mobile navigation, sync)
- Visual regression testing
- Zero accessibility violations in automated testing

---

## 4. Visuals

### Main Screenshot
**Figure 1: Year View with "You Are Here" Panel**
*The main dashboard showing the year calendar with goals organized by level (Vision/Milestone/Focus/Intention). The sidebar displays current time context, year progress (as a blooming flower), and upcoming items. This view reduces cognitive load by making time visible and keeping long-term goals present.*

### Feature Close-ups

**Figure 2: Day View with Drag-and-Drop Scheduling**
*The day planner view allows users to drag intentions onto specific time blocks. The "Now Beam" visual indicator shows the current time. This addresses time blindness by making the day's structure visible and allowing flexible scheduling without rigid constraints.*

**Figure 3: ADHD Support Features Panel**
*The support tools panel showing Focus Mode toggle, Brain Dump, Body Double timer, and Quick Wins. These features are designed specifically for neurodivergent users to manage overwhelm, maintain focus, and build momentum without creating pressure or obligation.*

**Figure 4: Mobile Navigation with Tab Bar**
*The mobile-first design with bottom tab bar for quick view switching (Garden/Day/Week/Month/Year). Swipe gestures enable fluid navigation. The interface adapts to mobile constraints while maintaining all core functionality.*

---

## 5. Proof & Links

**Live Link:** [Add your deployed URL here]  
**GitHub Repository:** [Add your GitHub repo URL here]  
**Demo Video:** [Optional: Add link to demo video]

### Key Metrics & Achievements

- **Bundle Size:** 497KB CSS (79KB gzipped), 26KB main JS (8KB gzipped) — optimized for fast loading
- **Build Time:** ~1.5 seconds (Vite-powered)
- **Lighthouse Scores:** 
  - Accessibility: 95-100
  - Performance: 85-95
  - Best Practices: 92-100
  - SEO: 90-100
- **Test Coverage:** Unit tests for core logic, E2E tests for critical user flows
- **Accessibility:** Zero WCAG violations, full keyboard navigation, screen reader compatible

### Technical Documentation

- **Architecture:** Comprehensive documentation in `docs/ARCHITECTURE.md`
- **Database Setup:** Migration guide in `docs/DATABASE_SETUP.md`
- **Deployment:** Production deployment guide in `docs/DEPLOYMENT.md`
- **Accessibility:** Detailed keyboard navigation guide and WCAG compliance documentation

---

## Additional Context

### Design Philosophy

This project embodies a "utility, not lifestyle app" philosophy. Every feature was evaluated against:
- Does it require daily maintenance? → **NO**
- Does it create obligation or pressure? → **NO**
- Does it increase cognitive load? → **NO**

The result is a tool that helps users stay oriented and organized without becoming a burden itself.

### User-Centered Development

Built specifically for the neurodivergent community, with features informed by:
- Time blindness research
- ADHD executive function challenges
- Overwhelm management strategies
- Accessibility best practices

### Future Considerations

The architecture supports future enhancements:
- Multi-user collaboration (RLS already in place)
- Advanced analytics (data model supports it)
- Third-party integrations (service layer is extensible)
- Mobile native apps (PWA foundation is solid)

---

**Status:** ✅ Production-Ready  
**Last Updated:** January 2025  
**License:** MIT
