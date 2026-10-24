const tabs = document.querySelectorAll<HTMLButtonElement>(".tab");
const modes = document.querySelectorAll<HTMLElement>(".mode");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const mode = tab.dataset.mode;
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    modes.forEach((m) => m.classList.toggle("hidden", m.id !== `mode-${mode}`));
  });
});