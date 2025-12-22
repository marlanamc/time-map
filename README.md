# Time Map

A neurodivergent-friendly time orientation tool designed to help with time blindness, planning, and overwhelm management. Time Map provides a visual calendar system with "anchors" (goals/events) and built-in ADHD support features.

## Features

### 🗓️ Visual Time Orientation
- **Multiple Views**: Year, Month, Week, and Day views with smooth zooming
- **Time Blindness Support**: "You Are Here" panel showing current time context
- **Time Breakdown**: Visual breakdown of time remaining until anchors (days, weeks, weekends, work sessions)
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

### 📍 Anchor System
- **Visual Anchors**: Place goals and events on the calendar
- **Categories**: Organize by Career, Health, Finance, Personal, Creative
- **Priority Levels**: Low, Medium, High, Urgent
- **Achievements**: Track completed anchors with celebration
- **Coming Up**: See upcoming anchors to reduce decision paralysis

### ✨ Additional Features
- **Affirmations**: Clickable affirmations for emotional regulation
- **Surprise Me**: Random anchor selection when you can't decide
- **Confetti Celebrations**: Visual rewards for completing anchors
- **Offline Support**: Data stored locally using IndexedDB
- **Responsive Design**: Works on desktop and mobile devices

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
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run backup` - Backup data
- `npm run deploy` - Build and backup

## Usage

### Adding an Anchor
1. Click the "+" button (FAB) in the bottom right
2. Enter what you'd like to place on the calendar
3. Select the month and year
4. Optionally add a category and priority
5. Click "Save Anchor"

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

### Managing Anchors
- Click an anchor on the calendar to view details
- Click "Surprise me" in the Coming Up section for random selection
- Filter anchors by category using the Scope filters
- Mark anchors as complete to celebrate achievements

## Technology Stack

- **Vanilla JavaScript** - No framework dependencies
- **IndexedDB** (via idb library) - Local data storage
- **CSS3** - Modern styling with gradients and animations
- **HTML5** - Semantic markup with accessibility features

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
