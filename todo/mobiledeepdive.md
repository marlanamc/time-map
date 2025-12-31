# Mobile & PWA Deep Dive Analysis

A comprehensive analysis of The Garden Fence's mobile implementation, touch interactions, and PWA functionality with detailed recommendations for production readiness.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Mobile Implementation Analysis](#mobile-implementation-analysis)
3. [View-by-View Analysis](#view-by-view-analysis)
4. [Touch Interaction Audit](#touch-interaction-audit)
5. [PWA Analysis](#pwa-analysis)
6. [Safe Area & Notch Handling](#safe-area--notch-handling)
7. [Recommendations](#recommendations)
8. [Implementation Priority](#implementation-priority)

---

## Architecture Overview

### Mobile Detection System

```
┌─────────────────────────────────────────────────────────────┐
│  VIEWPORT DETECTION (ViewportManager.ts)                     │
│  Primary: max-width: 600px                                   │
│  Secondary: (max-width: 900px) AND (max-height: 500px)       │
│             AND (pointer: coarse)                            │
├─────────────────────────────────────────────────────────────┤
│  MOBILE VIEWS                                                │
│  Home | Day | Week | Month | Year                            │
│  (Home repurposes sidebar as main content)                   │
├─────────────────────────────────────────────────────────────┤
│  NAVIGATION LAYER                                            │
│  Bottom Tab Bar (5 tabs, fixed position)                     │
│  Header Date Navigation (prev/today/next)                    │
├─────────────────────────────────────────────────────────────┤
│  PWA INFRASTRUCTURE                                          │
│  Service Worker (network-first for HTML/CSS/JS)              │
│  Web App Manifest (standalone display)                       │
│  iOS Meta Tags (status bar, touch icons)                     │
└─────────────────────────────────────────────────────────────┘
```

### CSS File Organization

| File | Lines | Purpose |
|------|-------|---------|
| `styles/responsive/mobile.css` | ~937 | Primary mobile styles, all breakpoints |
| `styles/responsive/mobile-tabs.css` | ~101 | Bottom tab bar component |
| `styles/mobile/home.css` | ~331 | Mobile home view card layout |
| `styles/dayView/responsive.css` | ~569 | Day view responsive breakpoints |

### Body Class System

```javascript
// Applied by ViewportManager based on viewport
document.body.classList.toggle("is-mobile", isMobile);
document.body.classList.toggle("mobile-home-view", isHomeTab);
document.body.classList.toggle("mobile-date-nav-in-header", !isHomeView);
```

---

## Mobile Implementation Analysis

### What Works Well

1. **Viewport Detection** - Clean media query approach with tablet/landscape fallbacks
2. **Safe Area Handling** - 41 usages of `env(safe-area-inset-*)` across 11 files
3. **Touch Target Sizing** - Most buttons meet 44px minimum (verified)
4. **Tab Bar** - Fixed positioning with proper safe area padding
5. **Glass Effects** - Beautiful blur effects preserved on mobile

### Critical Issues Identified

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| No swipe navigation | High | Between views | Users expect swipe gestures |
| Week view horizontal scroll | High | Week view | Unusable on phones <600px |
| No pull-to-refresh | Medium | All views | Missing expected mobile pattern |
| Day view drag awkward | High | Time scheduling | Hard to reschedule tasks |
| Month cells too small | Medium | Month grid | 60px cells hard to tap |
| No haptic feedback | Low | All interactions | Missing native feel |
| No offline indicator | High | PWA | Users confused when offline |

---

## View-by-View Analysis

### Home View (Mobile Sidebar)

**Current Implementation:**
- Sidebar content displayed as main content area
- "You Are Here" panel with time stats
- Collapsible sections (Context, Goals, etc.)
- Garden bloom visualization

**Strengths:**
- Clean card-based layout
- Proper padding for safe areas
- Touch-friendly section toggles (44px min-height)

**Issues:**
1. **Section toggles are bulky** - Fixed in recent update, but could use refinement
2. **No quick-add action** - Must navigate to Day view to add tasks
3. **Garden bloom not interactive** - Tapping cycles scope, but not obvious
4. **Affirmation/Upcoming sections hidden** - `display: none` on mobile

**Current CSS:**
```css
body.mobile-home-view .sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    padding-top: calc(var(--space-4) + env(safe-area-inset-top, 0px));
    padding-bottom: calc(var(--mobile-tab-bar-height) + var(--space-4));
}
```

**Recommendations:**
- Add FAB for quick task creation
- Make garden bloom interaction more discoverable (tooltip/hint)
- Consider showing condensed upcoming tasks

---

### Day View

**Current Implementation:**
- Timeline-based schedule (seed tray, day bed, compost)
- Drag-and-drop for scheduling
- Resize handles for duration adjustment

**Strengths:**
- Responsive breakpoints (5 defined)
- Touch-optimized card sizing
- Larger resize handles on touch devices (24px)

**Issues:**

1. **Drag-and-drop requires long-press (500ms)** - Too slow for quick rescheduling
   ```javascript
   // Current: src/garden/gardenEngine.ts
   const LONG_PRESS_DURATION = 500; // ms - feels sluggish
   ```

2. **Time gutter too wide on small phones**
   ```css
   /* 56px on mobile, could be 48px */
   --time-gutter: 56px;
   ```

3. **No swipe-to-complete gesture** - Must tap tiny checkbox

4. **Planter cards hide description on mobile** - Loses context
   ```css
   .day-goal-card.day-goal-variant-planter .day-goal-desc {
       display: none; /* Information loss */
   }
   ```

**Recommendations:**
- Reduce long-press to 300ms
- Add swipe-to-complete gesture
- Show truncated description (1 line)
- Consider bottom sheet for task details on tap

---

### Week View

**Current Implementation:**
- 7-column grid (one per day)
- Horizontal scroll on mobile
- Minimum 90px per column

**Critical Problem:**

The week view is **fundamentally broken on mobile phones**. Current behavior:

```css
@media (max-width: 900px) {
    .week-grid {
        min-width: 700px; /* Forces horizontal scroll */
        grid-template-columns: repeat(7, minmax(90px, 1fr));
    }
}

@media (max-width: 600px) {
    .week-grid {
        grid-template-columns: 1fr; /* Switches to 1 column */
        min-width: 0;
    }
}
```

**The Problem:** At 600px breakpoint, it switches to single-column stacked days, which is correct. However:
- No visual indication of which day is "today"
- Very long scroll for 7 days
- No week summary/overview

**Issues:**
1. Users lose week-at-a-glance context
2. Navigation between days requires excessive scrolling
3. No way to quickly jump to a specific day

**Recommendations:**
- Add "today" indicator/highlight
- Add day selector pills at top (Mon Tue Wed...)
- Consider horizontal swipe between days (carousel)
- Add week summary card at top

---

### Month View

**Current Implementation:**
- Calendar grid (7 columns)
- Day cells with goal indicators
- Click to navigate to day

**Issues:**

1. **Day cells too small**
   ```css
   .month-day {
       min-height: 60px; /* Updated from 70px, still cramped */
       padding: var(--space-2);
   }
   ```

2. **Goal indicators unreadable** - Dots/flowers too small at mobile scale

3. **No haptic feedback on selection**

4. **No pinch-to-zoom** - Can't zoom into a week

**Current Touch Handling:**
```css
.month-day {
    touch-action: manipulation; /* Good - prevents double-tap zoom */
}
```

**Recommendations:**
- Increase cell height to 80px minimum
- Larger goal indicators (emoji or colored bars)
- Add week row highlighting on touch
- Consider agenda view alternative for mobile

---

### Year View

**Current Implementation:**
- 12 month cards in responsive grid
- Mini calendar in each card
- Progress indicators

**Strengths:**
- Grid adapts well (`grid-template-columns: 1fr` at 600px)
- Cards have good touch feedback
- Adequate sizing

**Issues:**
1. **Mini calendars unreadable** - 4px text inside month cards
2. **No quick navigation** - Must scroll through all months
3. **Hover effects don't translate to touch**
   ```css
   .month-card:hover {
       transform: none; /* Correctly disabled on mobile */
       box-shadow: var(--shadow-sm);
   }
   ```

**Recommendations:**
- Hide mini calendars on mobile, show progress bar instead
- Add month quick-jump (sticky header or floating pills)
- Add pull-to-refresh for data sync

---

## Touch Interaction Audit

### Current Touch Handling

**1. Long-press for Drag (gardenEngine.ts)**
```javascript
document.addEventListener('touchstart', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('goal-card') || target.classList.contains('day-planter')) {
        const touch = e.touches[0];
        touchStartTime = Date.now();
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
    }
}, { passive: true });

document.addEventListener('touchend', (e) => {
    const touchDuration = Date.now() - touchStartTime;
    const moveDistance = Math.hypot(
        touch.clientX - touchStartX,
        touch.clientY - touchStartY
    );
    
    // Only spawn petals if long-press and minimal movement
    if (touchDuration >= LONG_PRESS_DURATION && moveDistance < MOVE_THRESHOLD) {
        this.spawnPetals(touch.clientX, touch.clientY);
    }
}, { passive: true });
```

**2. Pointer Events for Drag-Drop (DragDropManager.ts)**
```javascript
private addPointerDrag(element: HTMLElement, data: DragData): void {
    const onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0 && e.button !== -1) return;
        if (this.dragState) return;
        const target = e.target as HTMLElement;
        if (this.isInteractiveElement(target)) return;
        this.startLongPress(e, element, data);
    };
    element.addEventListener("pointerdown", onPointerDown as EventListener);
}
```

### Missing Touch Interactions

| Gesture | Expected Behavior | Current State |
|---------|-------------------|---------------|
| Swipe left/right | Navigate views | Not implemented |
| Pull down | Refresh data | Not implemented |
| Pinch | Zoom canvas | Partially (canvas only) |
| Long-press | Context menu | Only triggers drag |
| Swipe on task | Complete/delete | Not implemented |
| Double-tap | Zoom to element | Not implemented |

### Touch Target Compliance

| Element | Current Size | Minimum | Status |
|---------|-------------|---------|--------|
| Nav buttons | 44x44px | 44px | Pass |
| Tab bar items | 48px height | 44px | Pass |
| View buttons | 44x44px | 44px | Pass |
| Theme swatches | 48x48px | 44px | Pass |
| Goal checkboxes | 28x28px | 44px | **FAIL** |
| Section toggles | 44px height | 44px | Pass |
| Date display | Variable | 44px | Pass |
| Modal close | 40x40px | 44px | Near-miss |

**Critical:** Goal checkboxes at 28px are too small for reliable touch targeting.

---

## PWA Analysis

### Manifest Completeness

**Current manifest.webmanifest:**
```json
{
  "name": "The Garden Fence",
  "short_name": "Garden Fence",
  "description": "An ADHD-friendly focus tool...",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#FDFBF7",
  "theme_color": "#6F9B86",
  "icons": [
    { "src": "icons/ios/192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/ios/512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/ios/1024.png", "sizes": "1024x1024", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "icons/maskable-icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "maskable" }
  ]
}
```

**Missing from Manifest:**

| Property | Purpose | Recommendation |
|----------|---------|----------------|
| `id` | Unique app identifier | Add `"id": "/"` |
| `categories` | App store categorization | `["productivity", "lifestyle"]` |
| `screenshots` | Install prompt preview | Add 2-3 screenshots |
| `shortcuts` | Quick actions from icon | Add "New Task", "Today" |
| `related_applications` | Link to native apps | Not needed |
| `prefer_related_applications` | Native app preference | Not needed |

### iOS-Specific Issues

**Current Meta Tags:**
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Garden Fence" />
<link rel="apple-touch-icon" href="icons/ios/180.png" sizes="180x180" />
```

**Missing:**

1. **Splash Screens** - No `apple-touch-startup-image` defined
   ```html
   <!-- Missing: -->
   <link rel="apple-touch-startup-image" 
         href="splash/iphone12.png"
         media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)">
   ```
   Result: White flash on iOS app launch

2. **Additional Touch Icons** - Only 180px provided
   ```html
   <!-- Recommended additions: -->
   <link rel="apple-touch-icon" href="icons/ios/152.png" sizes="152x152" />
   <link rel="apple-touch-icon" href="icons/ios/167.png" sizes="167x167" />
   ```

### Service Worker Strategy

**Current (sw.js):**
- Network-first for HTML, CSS, JS
- Cache-first for static assets (icons)
- Version-based cache invalidation (v6)
- Message passing for updates

**Strengths:**
- Proper cache busting
- Update notification system
- SKIP_WAITING support

**Issues:**

1. **No Offline Indicator** - Users don't know when they're offline
   ```javascript
   // Missing in app.ts:
   window.addEventListener('online', () => showOnlineIndicator());
   window.addEventListener('offline', () => showOfflineIndicator());
   ```

2. **No Background Sync** - Edits made offline may conflict
   ```javascript
   // Missing registration:
   registration.sync.register('sync-tasks');
   ```

3. **No Install Prompt Capture**
   ```javascript
   // Missing:
   let deferredPrompt;
   window.addEventListener('beforeinstallprompt', (e) => {
       e.preventDefault();
       deferredPrompt = e;
       showInstallButton();
   });
   ```

### PWA Checklist

| Feature | Status | Priority |
|---------|--------|----------|
| Valid manifest | Pass | - |
| Service worker registered | Pass | - |
| HTTPS | Assumed (Vercel) | - |
| Offline support | Partial | High |
| Install prompt | Pass (custom) | Medium |
| Splash screens (iOS) | Missing | Medium |
| Offline indicator | Pass | High |
| Background sync | Missing | Low |
| Push notifications | Not needed | - |
| Screenshots in manifest | Missing | Low |
| Shortcuts in manifest | Missing | Low |

---

## Safe Area & Notch Handling

### Current Implementation

**41 usages across 11 files** - Good coverage

**Example patterns:**
```css
/* Header padding */
.header {
    padding: calc(var(--space-3) + env(safe-area-inset-top, 0px)) 
             calc(var(--space-4) + env(safe-area-inset-right, 0px)) 
             var(--space-3) 
             calc(var(--space-4) + env(safe-area-inset-left, 0px));
}

/* Tab bar height */
--mobile-tab-bar-height: calc(68px + env(safe-area-inset-bottom, 0px));

/* Modal spacing */
.modal {
    max-height: calc(100dvh - var(--space-8) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
}
```

### Dynamic Island Considerations

**Current:** No specific Dynamic Island handling

**Issue:** On iPhone 14 Pro+, the Dynamic Island requires additional top inset consideration for:
- Toasts/notifications
- Floating action buttons
- Status indicators

**Recommendation:**
```css
/* Add to mobile.css */
@supports (padding: max(0px, env(safe-area-inset-top))) {
    .toast,
    .floating-indicator {
        top: max(var(--space-4), calc(env(safe-area-inset-top) + var(--space-2)));
    }
}
```

### Landscape Mode Issues

**Current handling in dayView/responsive.css:**
```css
@media (max-height: 600px) and (orientation: landscape) {
    .day-view { padding: 1rem; }
    .day-bed-canvas { height: clamp(320px, 50vh, 480px); }
    .day-goal-desc { display: none; }
}
```

**Issues:**
1. No landscape handling for other views
2. Tab bar may occlude content in landscape
3. No orientation lock option

---

## Recommendations

### Priority 1: Critical UX Fixes

#### 1.1 Redesign Week View for Mobile

**Problem:** 7-column layout unusable on phones

**Solution:** Implement horizontal day carousel

```css
/* Proposed approach */
@media (max-width: 600px) {
    .week-view {
        display: flex;
        flex-direction: column;
    }
    
    .week-day-selector {
        display: flex;
        gap: var(--space-1);
        overflow-x: auto;
        padding: var(--space-3);
        position: sticky;
        top: 0;
        background: var(--bg-surface);
    }
    
    .week-day-selector-btn {
        min-width: 44px;
        padding: var(--space-2);
        border-radius: var(--radius-md);
    }
    
    .week-day-selector-btn.active {
        background: var(--accent);
        color: white;
    }
    
    .week-grid {
        /* Show only selected day */
        display: block;
    }
    
    .week-day-column {
        display: none;
    }
    
    .week-day-column.active {
        display: block;
    }
}
```

**Effort:** 4-6 hours (CSS + JS for selector)

#### 1.2 Add Swipe Navigation

**Status:** ✅ Implemented (`src/ui/gestures/SwipeNavigator.ts`, `src/ui/UIManager.ts`)

**Problem:** No gesture navigation between views

**Solution:** Implement horizontal swipe detection

```typescript
// Proposed: src/ui/gestures/SwipeNavigator.ts
class SwipeNavigator {
    private startX: number = 0;
    private startY: number = 0;
    private readonly THRESHOLD = 50; // px
    private readonly VELOCITY_THRESHOLD = 0.3; // px/ms
    
    attach(element: HTMLElement) {
        element.addEventListener('touchstart', this.onTouchStart, { passive: true });
        element.addEventListener('touchend', this.onTouchEnd, { passive: true });
    }
    
    private onTouchEnd(e: TouchEvent) {
        const deltaX = e.changedTouches[0].clientX - this.startX;
        const deltaY = e.changedTouches[0].clientY - this.startY;
        
        // Only trigger if horizontal swipe dominates
        if (Math.abs(deltaX) > Math.abs(deltaY) * 2 && Math.abs(deltaX) > this.THRESHOLD) {
            if (deltaX > 0) {
                this.navigatePrevious();
            } else {
                this.navigateNext();
            }
        }
    }
}
```

**Effort:** 3-4 hours

#### 1.3 Add Offline Status Indicator

**Status:** ✅ Implemented (`index.html`, `src/app.ts`)

**Problem:** Users don't know when offline

**Solution:** Add connection status to header

```html
<!-- Add to index.html header -->
<span class="connection-status" id="connectionStatus" hidden>
    <span class="status-dot"></span>
    <span class="status-text">Offline</span>
</span>
```

```css
.connection-status {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 4px 8px;
    border-radius: var(--radius-full);
    background: rgba(239, 68, 68, 0.15);
    color: #dc2626;
    font-size: var(--text-xs);
    font-weight: 600;
}

.status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    animation: pulse 2s infinite;
}
```

```javascript
// Add to app.ts
window.addEventListener('online', () => {
    document.getElementById('connectionStatus')?.setAttribute('hidden', '');
});

window.addEventListener('offline', () => {
    document.getElementById('connectionStatus')?.removeAttribute('hidden');
});
```

**Effort:** 1-2 hours

#### 1.4 Improve Goal Checkbox Touch Targets

**Status:** ✅ Implemented (`styles/dayView/cards.css`)

**Problem:** 28px checkboxes too small

**Solution:** Increase touch target without increasing visual size

```css
.day-goal-checkbox {
    width: 24px;
    height: 24px;
    position: relative;
}

/* Invisible touch target expansion */
.day-goal-checkbox::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 44px;
    height: 44px;
    /* No visible change, but touch target is 44px */
}
```

**Effort:** 30 minutes

---

### Priority 2: PWA Improvements

#### 2.1 Add iOS Splash Screens

**Status:** ✅ Implemented (`index.html`, `splash/*.png`, `scripts/generate-ios-splashes.py`)

**Problem:** White flash on iOS PWA launch

**Solution:** Generate and link splash images

```html
<!-- Add to index.html head -->
<!-- iPhone 14 Pro Max -->
<link rel="apple-touch-startup-image"
      href="splash/1290x2796.png"
      media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)">

<!-- iPhone 14 Pro -->
<link rel="apple-touch-startup-image"
      href="splash/1179x2556.png"
      media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)">

<!-- iPhone 13/14 -->
<link rel="apple-touch-startup-image"
      href="splash/1170x2532.png"
      media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)">

<!-- Add more for iPad, older iPhones -->
```

**Effort:** 2-3 hours (design + implementation)

#### 2.2 Implement Install Prompt

**Status:** ✅ Implemented (Support Tools “Install App” action via `index.html`, `src/ui/UIManager.ts`)

**Problem:** Users miss installation opportunity

**Solution:** Capture and show custom install prompt

```typescript
// src/features/InstallPrompt.ts
let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    showInstallBanner();
});

function showInstallBanner() {
    const banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.innerHTML = `
        <span>Add Garden Fence to your home screen</span>
        <button class="btn btn-primary btn-sm" id="installBtn">Install</button>
        <button class="btn btn-ghost btn-sm" id="dismissInstall">Not now</button>
    `;
    document.body.appendChild(banner);
    
    document.getElementById('installBtn')?.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            console.log('Install result:', result.outcome);
            deferredPrompt = null;
        }
        banner.remove();
    });
}
```

**Effort:** 2-3 hours

#### 2.3 Add Manifest Shortcuts

**Status:** ✅ Implemented (`manifest.webmanifest`, `src/app.ts`, `src/ui/UIManager.ts`)

**Problem:** No quick actions from home screen icon

**Solution:** Add shortcuts to manifest

```json
{
  "shortcuts": [
    {
      "name": "New Task",
      "short_name": "New",
      "description": "Create a new task",
      "url": "/?action=new-task",
      "icons": [{ "src": "icons/shortcut-add.png", "sizes": "96x96" }]
    },
    {
      "name": "Today",
      "short_name": "Today",
      "description": "View today's schedule",
      "url": "/?view=day",
      "icons": [{ "src": "icons/shortcut-today.png", "sizes": "96x96" }]
    }
  ]
}
```

**Effort:** 1-2 hours

---

### Priority 3: Polish

#### 3.1 Add Haptic Feedback

**Problem:** Interactions feel flat

**Solution:** Add vibration API calls

```typescript
// src/utils/haptics.ts
export function hapticLight() {
    if ('vibrate' in navigator) {
        navigator.vibrate(10);
    }
}

export function hapticMedium() {
    if ('vibrate' in navigator) {
        navigator.vibrate(20);
    }
}

export function hapticSuccess() {
    if ('vibrate' in navigator) {
        navigator.vibrate([10, 50, 10]);
    }
}

// Usage in event handlers:
button.addEventListener('click', () => {
    hapticLight();
    // ... rest of handler
});
```

**Effort:** 1-2 hours

#### 3.2 Implement Pull-to-Refresh

**Problem:** No refresh gesture

**Solution:** Add pull-to-refresh library or custom implementation

```typescript
// Using overscroll detection
let touchStartY = 0;
let isPulling = false;

container.addEventListener('touchstart', (e) => {
    if (container.scrollTop === 0) {
        touchStartY = e.touches[0].clientY;
    }
});

container.addEventListener('touchmove', (e) => {
    if (container.scrollTop === 0) {
        const pullDistance = e.touches[0].clientY - touchStartY;
        if (pullDistance > 0) {
            isPulling = true;
            updatePullIndicator(pullDistance);
        }
    }
});

container.addEventListener('touchend', () => {
    if (isPulling && pullDistance > 80) {
        triggerRefresh();
    }
    resetPullIndicator();
    isPulling = false;
});
```

**Effort:** 3-4 hours

#### 3.3 Add Loading Skeletons

**Problem:** Content pops in abruptly

**Solution:** Add skeleton placeholders

```css
.skeleton {
    background: linear-gradient(
        90deg,
        var(--bg-surface) 25%,
        var(--bg-hover) 50%,
        var(--bg-surface) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s infinite;
    border-radius: var(--radius-md);
}

@keyframes skeleton-loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

.skeleton-card {
    height: 80px;
    margin-bottom: var(--space-3);
}

.skeleton-line {
    height: 1em;
    margin-bottom: var(--space-2);
}
```

**Effort:** 2-3 hours

---

## Implementation Priority

### Phase 1: Critical (Before Production)

| Task | Effort | Files |
|------|--------|-------|
| [x] Offline indicator | 1-2h | `app.ts`, `index.html`, `mobile.css` |
| [x] Checkbox touch targets | 30m | `mobile.css` |
| [x] Week view redesign | 4-6h | `week.css`, `WeekView.ts` |

### Phase 2: Important (First Update)

| Task | Effort | Files |
|------|--------|-------|
| [x] Swipe navigation | 3-4h | New: `SwipeNavigator.ts` |
| [x] iOS splash screens | 2-3h | `index.html`, new images |
| [x] Install prompt | 2-3h | New: `InstallPrompt.ts` |
| [x] Manifest shortcuts | 1-2h | `manifest.webmanifest` |

### Phase 3: Polish (Subsequent Updates)

| Task | Effort | Files |
|------|--------|-------|
| [ ] Haptic feedback | 1-2h | New: `haptics.ts`, various |
| [ ] Pull-to-refresh | 3-4h | Various views |
| [ ] Loading skeletons | 2-3h | Various components |
| [ ] Swipe-to-complete | 2-3h | Day view components |

---

## Summary

### The Core Problem

The Garden Fence has a solid foundation for mobile, but it was clearly designed desktop-first. The responsive CSS is comprehensive, but the interaction patterns don't fully embrace mobile-native expectations.

### Key Wins Already in Place

- Proper safe area handling
- Touch target sizing (mostly)
- Beautiful visual design preserved
- PWA infrastructure exists

### Critical Gaps

1. **Week view is broken** on phones - needs complete redesign
2. **No gesture navigation** - swipe is expected
3. **No offline awareness** - users will think app is broken
4. **Checkbox targets too small** - frustrating interaction

### Recommended Action

Focus on Phase 1 items before production launch. The offline indicator and week view fixes are the most impactful for user experience. Touch target fixes are quick wins.

---

*Document created: December 2024*
*For: The Garden Fence / Time Map*
