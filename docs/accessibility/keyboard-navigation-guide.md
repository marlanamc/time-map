# Keyboard Navigation Testing Guide

## Overview
This guide documents all keyboard navigation patterns in the Liquid Productivity sidebar and provides a checklist for testing keyboard-only accessibility.

## Keyboard Navigation Patterns

### Global Navigation

| Key | Action | Context |
|-----|--------|---------|
| `Tab` | Move focus forward | All interactive elements |
| `Shift + Tab` | Move focus backward | All interactive elements |
| `Enter` | Activate focused element | Buttons, links, collapsible sections |
| `Space` | Activate focused element | Buttons, checkboxes |
| `Escape` | Close modal/panel | Modals, panels, overlays |

### Sidebar Sections

| Key | Action | Context |
|-----|--------|---------|
| `Enter` / `Space` | Expand/collapse section | Section headers |
| `ArrowDown` | Move to next section | When focused on section header |
| `ArrowUp` | Move to previous section | When focused on section header |

**Implementation:**
- Section headers have `role="button"` and `tabindex="0"`
- ARIA attributes: `aria-expanded`, `aria-controls`
- Visual focus indicator (2px solid accent outline)

### Intention Pills (Pill-shaped Buttons)

| Key | Action | Context |
|-----|--------|---------|
| `Tab` | Move to next pill | Intentions grid |
| `ArrowRight` | Move to next pill | Grid navigation (horizontal) |
| `ArrowLeft` | Move to previous pill | Grid navigation (horizontal) |
| `ArrowDown` | Move down one row | Grid navigation (2 columns) |
| `ArrowUp` | Move up one row | Grid navigation (2 columns) |
| `Enter` / `Space` | Select intention | Starts drag or opens schedule modal |
| `Home` | Jump to first pill | Intentions grid |
| `End` | Jump to last pill | Intentions grid |

**Implementation:**
- Pills have `tabindex="0"` for keyboard focus
- Arrow key navigation using `enableArrowNavigation()`
- Drag initiated on `Enter` key
- Visual focus indicator (outline + shimmer effect on focus)

### Task List Items

| Key | Action | Context |
|-----|--------|---------|
| `Enter` / `Space` | Expand/collapse task | Task item |
| `ArrowDown` | Move to next task | Task list |
| `ArrowUp` | Move to previous task | Task list |
| `Tab` | Move through actions in expanded task | Expanded task (Schedule, Delete) |

**Implementation:**
- Task items have `role="button"` and `tabindex="0"`
- ARIA attributes: `aria-expanded` for expanded/collapsed state
- Staggered animation on expand (respects `prefers-reduced-motion`)

### Click-to-Schedule Modal

| Key | Action | Context |
|-----|--------|---------|
| `Tab` | Cycle through form fields | Modal |
| `Shift + Tab` | Cycle backward | Modal (focus trap active) |
| `Escape` | Close modal | Modal |
| `Enter` | Submit form | When focused on "Schedule" button |
| `ArrowUp` / `ArrowDown` | Change time selection | Time select dropdown |
| `+` / `-` | Adjust duration | Duration input (when focused) |

**Focus Trap:**
- Focus is trapped within modal when open
- Tab wraps from last to first focusable element
- Escape key closes modal and restores focus
- Initial focus on date input

**Form Fields (Tab Order):**
1. Date input
2. Time select dropdown
3. Duration decrease button (−)
4. Duration input
5. Duration increase button (+)
6. Cancel button
7. Schedule button

### Customization Panel (Future Phase 7)

| Key | Action | Context |
|-----|--------|---------|
| `Tab` | Cycle through form fields | Panel |
| `Escape` | Close panel | Panel |
| `Enter` | Save changes | When focused on "Save" button |
| `ArrowUp` / `ArrowDown` | Reorder intentions | When focused on drag handle |
| `Space` | Start/stop drag reorder | Drag handle |

## Testing Checklist

### ✅ Basic Keyboard Navigation

**Instructions:** Unplug mouse, use only keyboard.

- [ ] Tab through all interactive elements in the sidebar
- [ ] Tab order is logical (top to bottom, left to right)
- [ ] Focus indicator is visible on all elements (2px solid outline)
- [ ] No focus traps (except in modals where expected)
- [ ] Shift+Tab moves backward correctly

### ✅ Section Collapsing/Expanding

- [ ] Tab to section header shows focus indicator
- [ ] Enter key expands/collapses section
- [ ] Space key expands/collapses section
- [ ] Screen reader announces "expanded" or "collapsed" state
- [ ] Collapsed sections hide content visually and from screen readers

### ✅ Intention Pills

- [ ] Tab moves focus to first pill
- [ ] Arrow keys navigate between pills (left/right, up/down)
- [ ] Home/End keys jump to first/last pill
- [ ] Focus indicator (outline + shimmer) is visible
- [ ] Enter key selects intention (starts drag or opens modal)
- [ ] Grid wraps correctly (end of row → start of next row)

### ✅ Task List

- [ ] Tab moves focus through tasks
- [ ] Arrow keys navigate between tasks
- [ ] Enter/Space expands/collapses task
- [ ] Expanded task shows actions (Schedule, Delete)
- [ ] Tab moves through actions in expanded task
- [ ] Collapsing task doesn't lose keyboard focus

### ✅ Click-to-Schedule Modal

**Instructions:** Open modal using keyboard (Enter on pill).

- [ ] Modal opens and focus moves to date input
- [ ] Tab cycles through all form fields in order
- [ ] Shift+Tab cycles backward
- [ ] Tab wraps from last to first element (focus trap)
- [ ] Cannot tab to elements behind modal
- [ ] Escape key closes modal
- [ ] Focus returns to triggering element after close
- [ ] +/- buttons adjust duration
- [ ] Enter key on "Schedule" button submits form
- [ ] Screen reader announces form changes (time, duration)

### ✅ Visual Focus Indicators

**Instructions:** Tab through all elements and verify focus visibility.

- [ ] All buttons have 2px solid outline on focus
- [ ] Focus color contrasts with background (3:1 minimum)
- [ ] Outline offset (2px) prevents overlap
- [ ] Intention pills show outline + shimmer on focus
- [ ] Custom inputs have visible focus ring
- [ ] Focus indicators respect `prefers-reduced-motion`

### ✅ Reduced Motion

**Instructions:** Enable "Reduce motion" in OS settings.

- [ ] All animations are disabled or minimal
- [ ] Shimmer effect is disabled
- [ ] Ripple effect is disabled
- [ ] Transitions reduced to instant or <100ms
- [ ] Essential transitions (collapse/expand) still work
- [ ] No vestibular motion triggers

### ✅ Screen Reader Compatibility

**Recommended:** VoiceOver (macOS), NVDA (Windows), JAWS (Windows)

- [ ] All interactive elements have labels
- [ ] ARIA roles are correctly assigned (`button`, `dialog`, `region`)
- [ ] ARIA states update dynamically (`aria-expanded`, `aria-selected`)
- [ ] Live regions announce important changes
- [ ] Decorative elements have `aria-hidden="true"`
- [ ] Form labels are associated with inputs
- [ ] Error messages are announced

### ✅ Error States & Edge Cases

- [ ] Empty intentions grid shows "No intentions" message
- [ ] Empty task list shows "No tasks" message
- [ ] Form validation errors are keyboard accessible
- [ ] Required fields marked with `aria-required="true"`
- [ ] Invalid inputs announced to screen readers
- [ ] Loading states announced (`aria-busy="true"`)

## Known Issues & Limitations

### Current Limitations
1. **Intention reordering:** Not yet implemented - planned for Phase 7
2. **Customization panel:** Not yet implemented - planned for Phase 7
3. **Drag-and-drop via keyboard:** Not supported - use Click-to-Schedule modal as alternative

### Future Enhancements
1. **Global keyboard shortcuts:**
   - `Ctrl/Cmd + K`: Quick add intention
   - `Ctrl/Cmd + /`: Open keyboard shortcuts help
   - `Ctrl/Cmd + B`: Toggle sidebar visibility

2. **Advanced navigation:**
   - Type-ahead search in intentions grid
   - Jump to section by pressing first letter
   - Breadcrumb navigation for nested views

## Accessibility Tools

### Browser Extensions
- **axe DevTools** (Chrome, Firefox, Edge)
- **WAVE** (Chrome, Firefox, Edge)
- **Lighthouse** (Chrome DevTools built-in)

### Screen Readers
- **VoiceOver** (macOS): `Cmd + F5` to toggle
- **NVDA** (Windows): Free, open-source
- **JAWS** (Windows): Commercial, industry standard
- **TalkBack** (Android): Mobile testing

### Testing Commands

**VoiceOver (macOS):**
```bash
# Start VoiceOver
Cmd + F5

# Navigate
VO + Arrow keys

# Interact with element
VO + Space

# Read next item
VO + Right Arrow
```

**NVDA (Windows):**
```bash
# Start NVDA
Ctrl + Alt + N

# Browse mode
Arrow keys

# Forms mode
Enter (on form field)

# Read next line
Down Arrow
```

## Quick Test Script

**Time estimate: 10 minutes**

1. **Tab Navigation** (2 min)
   - Tab from top to bottom of sidebar
   - Verify all interactive elements are reachable
   - Check focus indicators are visible

2. **Section Interaction** (2 min)
   - Collapse/expand each section with Enter
   - Verify ARIA states update
   - Check content visibility

3. **Intention Pills** (2 min)
   - Navigate grid with arrow keys
   - Verify grid wrapping works
   - Test Home/End keys

4. **Modal Navigation** (3 min)
   - Open Click-to-Schedule modal
   - Tab through all fields
   - Test Escape to close
   - Verify focus return

5. **Screen Reader** (1 min)
   - Turn on VoiceOver/NVDA
   - Tab through sidebar
   - Listen for announcements

## Reporting Issues

When reporting keyboard navigation issues, include:

1. **Steps to reproduce:**
   - Starting state
   - Key presses (exact sequence)
   - Expected behavior
   - Actual behavior

2. **Environment:**
   - Browser + version
   - OS + version
   - Screen reader (if applicable)
   - Assistive technology settings

3. **Screenshots/video:**
   - Show focus indicator (or lack thereof)
   - Highlight problematic element

**Example:**
```markdown
## Issue: Cannot reach "Schedule" button with Tab

**Steps:**
1. Open Click-to-Schedule modal (Enter on intention pill)
2. Press Tab repeatedly
3. Tab cycles through date, time, duration, cancel
4. "Schedule" button is skipped

**Expected:** Tab should reach "Schedule" button after "Cancel"
**Actual:** Tab wraps back to date input, skipping "Schedule"

**Environment:**
- Chrome 120, macOS 14.2
- No screen reader

**Fix:** Add `tabindex="0"` to Schedule button
```

---

**Last Updated:** 2026-01-02
**Next Review:** After Phase 7 (Integration & Testing)
**WCAG Level:** AA (Target: AAA for keyboard navigation)
