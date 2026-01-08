import { State } from "../../core/State";

type DateNavigatorCallbacks = {
  onRender: () => void;
};

export const DateNavigator = {
  bindDateNavigation(callbacks: DateNavigatorCallbacks) {
    document
      .getElementById("navPrev")
      ?.addEventListener("click", () => State.navigate(-1));
    document
      .getElementById("navNext")
      ?.addEventListener("click", () => State.navigate(1));
    document.getElementById("navToday")?.addEventListener("click", () => {
      State.goToDate(new Date());
      callbacks.onRender();
    });
  },

  changeYear(delta: number) {
    State.navigate(delta);
  },
};
