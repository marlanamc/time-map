# Next Steps: The Garden Fence Improvement Roadmap

This document outlines recommended improvements to enhance the app's performance, maintainability, user experience, and accessibility.

---

## 🔴 High Priority (Do First)

### 1. Fix Mobile "Here" Page Layout Issues
**Status:** Completed  
**Effort:** 2-4 hours

The mobile "Here" tab has some layout issues that were addressed in recent CSS changes. Verify and test:
- [x] "You are here" container displays fully without clipping
- [x] Section toggles are appropriately sized (not too bulky)
- [x] Bottom tab bar is properly positioned with safe area insets
- [x] Content doesn't overlap with the tab bar

**Notes:** Added safe-area-aware padding to the mobile Here/Home view to reduce top clipping risk.

**Files to check:**
- `styles/responsive/mobile.css`
- `styles/responsive/mobile-tabs.css`
- `styles/mobile/home.css`

---

### 2. Add Skip/Dismiss to Login Modal
**Status:** Completed  
**Effort:** 1-2 hours

The login modal appears on every page load and has no way to dismiss it without logging in. Add:
- [x] "Continue as Guest" or "Skip for now" button
- [x] Option to "Don't show again" (save preference in localStorage)
- [x] Close button (×) in corner

**Files to modify:**
- `src/components/Auth.ts`
- `styles/features/auth-modal.css`

---

### 3. Service Worker Update Strategy
**Status:** Completed  
**Effort:** 2-3 hours

The service worker can cause stale content issues. Implement:
- [x] "New version available" toast notification
- [x] Automatic reload prompt when updates are ready
- [x] Clear cache button in settings
- [x] Version number display in app

**Files to modify:**
- `sw.js`
- `src/app.ts` (service worker registration)

---

## 🟡 Medium Priority (Quality of Life)

### 4. Performance Optimization
**Status:** Good baseline, room for improvement  
**Effort:** 4-8 hours

Current bundle is ~450KB JS, ~240KB CSS. Optimizations:

- [x] **Code Splitting (Started)** - Split/lazy-load heavy features:
  - [x] Day planner module (lazy-loaded on first Day view open)
  - [x] Garden effects/animations (deferred load after first paint)
  - [x] Supabase client (lazy-loaded only when Supabase is configured and first used)
  - [x] Support features (ND tools / quick add / zen focus) lazy-loaded

- [x] **CSS Purging (Opt-in)** - Remove unused CSS (potential 40-60% reduction)
  - Added PurgeCSS via PostCSS with a conservative safelist
  - Run `npm run build:purge` to enable (default build remains unchanged)

- [x] **Image Optimization**
  - Lossless-compressed PNG icons + iOS splash screens (`npm run images:optimize`)
  - Keep PWA icons as PNG (required by iOS / manifest); if we add bitmap garden assets later: use WebP/AVIF + PNG fallback + `loading="lazy"`

**Expected Impact:** 30-50% bundle size reduction

---

### 5. Consolidate CSS Files
**Status:** Completed  
**Effort:** 4-6 hours

Introduced grouped entrypoint files so `styles/main.css` imports ~12 bundles (core/background/layout/components/views/day-planner/features/themes/accessibility/animations/responsive/utilities), while keeping existing files intact.

| Current | Proposed |
|---------|----------|
| `core/variables.css` + `core/reset.css` | `core.css` |
| `background/*.css` (3 files) | `background.css` |
| `layout/*.css` (2 files) | `layout.css` |
| `components/*.css` (4 files) | `components.css` |
| `views/*.css` (5 files) | `views.css` |
| `dayView/*.css` (6 files) | `day-planner.css` |
| `features/*.css` (11 files) | `features.css` |
| `themes/*.css` (3 files) | `themes.css` |
| `accessibility/*.css` (10 files) | `accessibility.css` |
| `animations/*.css` | `animations.css` |
| `responsive/*.css` + `mobile/*.css` | `responsive.css` |
| `utilities/*.css` + `custom/*.css` | `utilities.css` |

**Benefits:**
- Fewer HTTP requests in dev
- Easier to maintain and find styles
- Better IDE autocomplete

---

### 6. Improve TypeScript Architecture
**Status:** Good structure, some anti-patterns  
**Effort:** 6-10 hours

Current issues identified:
- [x] Dynamic imports mixed with static imports (Vite warnings)
- [x] Some circular dependency patterns
- [ ] Large single files (UIManager.ts is likely very large)

**Recommendations:**
- [x] Consolidate Supabase imports to single entry point (lazy-loaded client via `getSupabaseClient()`)
- [x] Create barrel exports for each module directory
- [x] Split large files (>500 lines) into smaller focused modules (started by extracting feature loaders into `src/ui/featureLoaders.ts`)
- [ ] Consider using a state management pattern (Zustand or similar)

---

### 7. Testing Improvements
**Status:** Tests exist, coverage unknown  
**Effort:** 8-16 hours

- [x] Add test coverage reporting
- [ ] Increase unit test coverage (target: 70%+)
- [x] Add visual regression tests for key UI states
- [x] Add mobile-specific E2E tests
- [x] Set up CI/CD pipeline with automated testing

---

## 🟢 Lower Priority (Nice to Have)

### 8. PWA Improvements
**Status:** Basic PWA support  
**Effort:** 4-6 hours

- [ ] Background sync for offline changes
- [ ] Push notifications for reminders
- [ ] Better install prompt UX
- [x] Offline indicator in UI
- [ ] Sync conflict resolution UI

---

### 9. Accessibility Audit
**Status:** Good foundation  
**Effort:** 4-8 hours

- [x] Run automated accessibility tests (axe-core)


---

### 10. Animation Performance
**Status:** Works but could be optimized  
**Effort:** 2-4 hours

- [ ] Use `will-change` property judiciously
- [ ] Move animations to compositor (transform/opacity only)
- [ ] Reduce paint areas for animated elements
- [ ] Add `prefers-reduced-motion` checks throughout
- [ ] Consider using CSS containment

---

### 11. Developer Experience
**Status:** Much improved with Vite  
**Effort:** 2-4 hours

- [x] Add TypeScript path aliases to tsconfig.json
- [ ] Set up Storybook for component development
- [ ] Add pre-commit hooks (husky + lint-staged)
- [x] Create VS Code workspace settings
- [x] Add debugging configurations

---

## 🔮 Future Features

### 12. Data Export/Import
- [ ] Export goals to JSON/CSV
- [ ] Import from other planning apps
- [ ] Backup to file system
- [ ] Share goals via link

### 13. Widgets & Shortcuts
- [ ] iOS/Android home screen widgets
- [ ] Quick actions from notification shade
- [ ] Siri/Google Assistant shortcuts

### 14. Collaboration Features
- [ ] Share goals with accountability partners
- [ ] Family/team planning boards
- [ ] Body double matchmaking

### 15. Analytics Dashboard
- [ ] Goal completion trends
- [ ] Productivity patterns
- [ ] Time of day insights
- [ ] Streak statistics

---

## 📊 Priority Matrix

| Task | Impact | Effort | Priority Score |
|------|--------|--------|----------------|
| Fix Mobile Layout | High | Low | ⭐⭐⭐⭐⭐ |
| Skip Login Modal | High | Low | ⭐⭐⭐⭐⭐ |
| Service Worker Fix | High | Medium | ⭐⭐⭐⭐ |
| Performance Optimization | High | High | ⭐⭐⭐ |
| CSS Consolidation | Medium | Medium | ⭐⭐⭐ |
| TypeScript Refactor | Medium | High | ⭐⭐ |
| Testing | Medium | High | ⭐⭐ |
| PWA Improvements | Low | Medium | ⭐⭐ |
| Accessibility Audit | Medium | Medium | ⭐⭐⭐ |

---

## 🚀 Quick Wins (< 1 hour each)

1. [x] Add "Continue as Guest" to login modal
2. [x] Add version number to settings
3. [x] Add "Clear Cache" button in settings
4. [ ] Fix any remaining CSS truncation issues
5. [x] Add basic loading states for async operations (startup skeleton + pull-to-refresh)
6. [x] Improve error messages for failed syncs

---

## 📁 Files Changed Recently

For reference, these files were modified in the recent Vite migration:

| File | Change |
|------|--------|
| `vite.config.ts` | Created - Vite configuration |
| `package.json` | Updated scripts for Vite |
| `index.html` | Removed CSS links, updated script tags |
| `src/app.ts` | Added CSS import |
| `styles/main.css` | Created - CSS entry point |
| `styles/core/variables.css` | Added common pattern utilities |
| `styles/core/reset.css` | Fixed @import issue |
| `styles/background/pollen.css` | Fixed truncated CSS |
| `styles/background/fireflies.css` | Fixed truncated CSS |
| `vercel.json` | Updated output directory to `dist/` |

---

## 💡 Architecture Recommendations

### Current State
```
index.html → app.ts → imports everything
```

### Recommended Future State
```
index.html
    → app.ts (minimal bootstrap)
        → core/ (state, goals, planning)
        → ui/ (lazy loaded views)
        → features/ (lazy loaded as needed)
        → services/ (lazy loaded when online)
```

### Key Principles
1. **Lazy load heavy features** - Day planner, garden effects
2. **Code split by route** - Each view as separate chunk
3. **Defer non-critical CSS** - Animations, themes
4. **Progressive enhancement** - Core works without JS animations

---

*Last updated: December 2025*
