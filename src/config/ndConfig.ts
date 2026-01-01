// ===================================
// Neurodivergent Accessibility Config
// ===================================
export const ND_CONFIG = {
  // Accent color themes - Using day mode colors for picker preview
  // Ordered in rainbow spectrum: red → orange → yellow → green → blue → indigo → violet
  ACCENT_THEMES: {
    rose: { label: "Rose Petal", emoji: "🌹", color: "#E11D48" },
    coral: { label: "Warm Earth", emoji: "🏺", color: "#B8472F" },
    amber: { label: "Sunlight", emoji: "☀️", color: "#D96320" },
    mint: { label: "Mint Fresh", emoji: "🌱", color: "#10B981" },
    sage: { label: "Garden Green", emoji: "🌿", color: "#3B7057" },
    sky: { label: "Sky Blue", emoji: "☁️", color: "#0EA5E9" },
    teal: { label: "Daylight Blue", emoji: "🌊", color: "#1E6FB8" },
    indigo: { label: "Deep Indigo", emoji: "🌌", color: "#4F46E5" },
    violet: { label: "Violet", emoji: "💜", color: "#6D28D9" },
    rainbow: { label: "Rainbow", emoji: "🌈", color: "linear-gradient(90deg, #E11D48, #D96320, #F4A460, #10B981, #0EA5E9, #4F46E5, #6D28D9)" },
  },

  // Body doubling / coworking timer options
  BODY_DOUBLE_DURATIONS: [15, 25, 45, 60, 90],

  // Break reminder intervals (minutes)
  BREAK_INTERVALS: {
    pomodoro: 25,
    gentle: 45,
    hyperfocus: 90,
    off: null,
  },

  // Task initiation prompts - helps with executive dysfunction
  INITIATION_PROMPTS: [
    "Just open the file/app. That's it.",
    "Set a 2-minute timer. You only have to try for 2 minutes.",
    "What's the tiniest first step? Do only that.",
    "Text a friend you're starting. Accountability helps!",
    "Put on your 'work' playlist first. Transition ritual.",
    "Can you do the easiest part first? Skip the hard stuff.",
    "Pretend you're showing someone else how to start.",
    "What would make this feel like play instead of work?",
  ],

  // Text spacing options for accessibility
  TEXT_SPACING: {
    compact: { lineHeight: "1.4", letterSpacing: "-0.01em", wordSpacing: "0" },
    normal: { lineHeight: "1.6", letterSpacing: "0", wordSpacing: "0" },
    relaxed: {
      lineHeight: "1.8",
      letterSpacing: "0.02em",
      wordSpacing: "0.05em",
    },
    dyslexia: {
      lineHeight: "2",
      letterSpacing: "0.05em",
      wordSpacing: "0.1em",
    },
  },

  // "What's blocking you?" prompts for stuck moments
  BLOCKER_PROMPTS: [
    { label: "I don't know where to start", action: "break_down" },
    { label: "It feels too big", action: "simplify" },
    { label: "I'm waiting on something", action: "mark_blocked" },
    { label: "I don't have energy", action: "defer" },
    { label: "I keep getting distracted", action: "focus_mode" },
    { label: "I'm not sure it matters", action: "clarify_why" },
    { label: "I'm scared to mess up", action: "permission_slip" },
    { label: "Something else is on my mind", action: "brain_dump" },
  ],

  // Permission slips for perfectionism paralysis
  PERMISSION_SLIPS: [
    "You have permission to do this badly.",
    "Done is better than perfect. Ship it ugly.",
    "This is a draft. Drafts are supposed to be messy.",
    "You can always fix it later. Future you is capable.",
    "Good enough IS good enough.",
    "Progress over perfection. Always.",
    "Your first pancake is allowed to be weird.",
    "Mistakes are data, not disasters.",
  ],

  // Dopamine menu - quick wins when motivation is low
  DOPAMINE_MENU: [
    { icon: "check", label: "Check off a tiny task", time: "2 min" },
    { icon: "target", label: "Pick one intention for today", time: "1 min" },
    { icon: "cloud", label: "Brain dump for 5 minutes", time: "5 min" },
    { icon: "refresh", label: "Update progress on something", time: "2 min" },
    { icon: "edit", label: "Add a note to any intention", time: "1 min" },
    { icon: "award", label: "Celebrate a past win", time: "1 min" },
    { icon: "shuffle", label: "Let the app pick a task", time: "0 min" },
    {
      icon: "clock",
      label: "Set a 15-min body double timer",
      time: "15 min",
    },
  ],

  // Sensory feedback options
  FEEDBACK_STYLES: {
    subtle: { confetti: false, sound: false, shake: false, glow: true },
    moderate: { confetti: true, sound: false, shake: false, glow: true },
    celebration: { confetti: true, sound: true, shake: true, glow: true },
    minimal: { confetti: false, sound: false, shake: false, glow: false },
  },

  // Overwhelm thresholds
  MAX_VISIBLE_TASKS: {
    overwhelmed: 1,
    low_energy: 3,
    normal: 10,
    high_energy: 999,
  },

  // Transition warning times (minutes before deadline)
  TRANSITION_WARNINGS: [60, 30, 15, 5],

  // Font options for dyslexia/reading preferences
  FONT_OPTIONS: {
    default: "'Inter', sans-serif",
    dyslexia: "'OpenDyslexic', 'Comic Sans MS', sans-serif",
    mono: "'JetBrains Mono', monospace",
    large: "'Inter', sans-serif", // Same font, larger size
  },
};
