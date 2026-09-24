type Theme = "light" | "dark";
const STORAGE_KEY = "piggy.theme.v1";

export function initTheme(toggle: HTMLButtonElement): void {
  let theme: Theme = "dark";
  try {
    if (localStorage.getItem(STORAGE_KEY) === "light") theme = "light";
  } catch {
    // A blocked storage area should not prevent switching themes.
  }

  const apply = (): void => {
    document.documentElement.dataset.theme = theme;
    const action = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
    toggle.setAttribute("aria-label", action);
    toggle.title = action;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#07060e" : "#faf8fb");
  };
  apply();
  toggle.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    apply();
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The current page still works without persisted preferences.
    }
  });
}
