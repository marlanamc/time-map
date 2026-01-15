// ===================================
// UI Elements Caching Module
// ===================================
import type { UIElements } from "../../types";

export function cacheElements(): UIElements {
  const calendarGridEl = document.getElementById(
    "calendarGrid"
  ) as HTMLElement | null;
  if (!calendarGridEl) {
    console.error("cacheElements: calendarGrid element not found in DOM!");
  } else {
    console.log("cacheElements: calendarGrid element found");
  }
  return {
    calendarGrid: calendarGridEl,
    canvas: document.getElementById("canvas") as HTMLCanvasElement | null,
    canvasContainer: document.getElementById(
      "canvasContainer"
    ) as HTMLElement | null,
    categoryFilters: document.getElementById(
      "categoryFilters"
    ) as HTMLElement | null,
    upcomingGoals: document.getElementById(
      "upcomingGoals"
    ) as HTMLElement | null,
    levelContextBar: document.getElementById(
      "levelContextBar"
    ) as HTMLElement | null,
    goalModal: document.getElementById("goalModal") as HTMLElement | null,
    goalForm: document.getElementById("goalForm") as HTMLFormElement | null,
    goalMonth: document.getElementById("goalMonth") as HTMLInputElement | null,
    nowDate: document.getElementById("nowDate") as HTMLElement | null,
    nowContext: document.getElementById("nowContext") as HTMLElement | null,
    daysLeft: document.getElementById("daysLeft") as HTMLElement | null,
    daysLeftLabel: document.getElementById(
      "daysLeftLabel"
    ) as HTMLElement | null,
    weeksLeft: document.getElementById("weeksLeft") as HTMLElement | null,
    weeksLeftLabel: document.getElementById(
      "weeksLeftLabel"
    ) as HTMLElement | null,
    timeProgress: document.getElementById("timeProgress") as HTMLElement | null,
    yearProgressFill: document.getElementById(
      "yearProgressFill"
    ) as HTMLElement | null,
    gardenBloom: document.getElementById("gardenBloom") as HTMLElement | null,
    flowerPetals: document.getElementById(
      "flowerPetals"
    ) as unknown as SVGElement | null,
    yearProgressLabel: document.getElementById(
      "yearProgressLabel"
    ) as HTMLElement | null,
    yearProgressValue: document.getElementById(
      "yearProgressValue"
    ) as HTMLElement | null,
    zoomLevel: document.getElementById("zoomLevel") as HTMLElement | null,
    affirmationText: document.getElementById(
      "affirmationText"
    ) as HTMLElement | null,
    yearDisplay: document.getElementById("yearDisplay") as HTMLElement | null,
    streakCount: document.getElementById("streakCount") as HTMLElement | null,
    achievementsGrid: document.getElementById(
      "achievementsGrid"
    ) as HTMLElement | null,
    achievementsPanel: document.querySelector(
      ".achievements-panel"
    ) as HTMLElement | null,
    affirmationPanel: document.getElementById(
      "affirmationPanel"
    ) as HTMLElement | null,
    whatsNextPanel: document.querySelector(".whats-next") as HTMLElement | null,
    toast: document.getElementById("toast") as HTMLElement | null,
    toastMessage: document.getElementById("toastMessage") as HTMLElement | null,
    toastIcon: document.getElementById("toastIcon") as HTMLElement | null,
    celebrationModal: document.getElementById(
      "celebrationModal"
    ) as HTMLElement | null,
    celebrationEmoji: document.getElementById(
      "celebrationEmoji"
    ) as HTMLElement | null,
    celebrationTitle: document.getElementById(
      "celebration-title-label"
    ) as HTMLElement | null,
    celebrationText: document.getElementById(
      "celebrationText"
    ) as HTMLElement | null,
    confettiContainer: document.getElementById(
      "confettiContainer"
    ) as HTMLElement | null,

    // Mobile Home Elements
    mobileHomeView: document.getElementById(
      "mobileHomeView"
    ) as HTMLElement | null,
    mobileDateDisplay: document.getElementById(
      "mobileDateDisplay"
    ) as HTMLElement | null,
    mobileNowContext: document.getElementById(
      "mobileNowContext"
    ) as HTMLElement | null,
    mobileTimeVis: document.getElementById(
      "mobileTimeVis"
    ) as HTMLElement | null,
    mobileTimeStats: document.getElementById(
      "mobileTimeStats"
    ) as HTMLElement | null,
    mobileGardenBloom: document.getElementById(
      "mobileGardenBloom"
    ) as HTMLElement | null,
    mobileBloomText: document.getElementById(
      "mobileBloomText"
    ) as HTMLElement | null,
    mobileAffirmationText: document.getElementById(
      "mobileAffirmationText"
    ) as HTMLElement | null,
    mobileUpcomingList: document.getElementById(
      "mobileUpcomingList"
    ) as HTMLElement | null,
    mobileSurpriseBtn: document.getElementById(
      "mobileSurpriseBtn"
    ) as HTMLButtonElement | null,
    mobileTabHome: document.querySelector(
      '.mobile-tab[data-view="home"]'
    ) as HTMLElement | null,
    mobileGoalsByLevel: document.getElementById(
      "mobileGoalsByLevel"
    ) as HTMLElement | null,
    mobileHereGarden: document.getElementById(
      "mobileHereGarden"
    ) as HTMLElement | null,

    // ND Support elements (may not exist yet)
    brainDumpBtn: document.getElementById("brainDumpBtn") as HTMLElement | null,
    bodyDoubleBtn: document.getElementById(
      "bodyDoubleBtn"
    ) as HTMLElement | null,
    ndSettingsBtn: document.getElementById(
      "ndSettingsBtn"
    ) as HTMLElement | null,
    dopamineMenuBtn: document.getElementById(
      "dopamineMenuBtn"
    ) as HTMLElement | null,
    appearanceBtn: document.getElementById(
      "appearanceBtn"
    ) as HTMLElement | null,
    appSettingsBtn: document.getElementById(
      "appSettingsBtn"
    ) as HTMLElement | null,
  };
}
