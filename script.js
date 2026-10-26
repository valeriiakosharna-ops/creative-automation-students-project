"use strict";
const button = document.querySelector(".menu-toggle");
const nav = document.querySelector("#main-nav");
function setMenu(open) {
  button.setAttribute("aria-expanded", String(open));
  button.setAttribute(
    "aria-label",
    open ? "Close navigation" : "Open navigation",
  );
  nav.classList.toggle("is-open", open);
}
button.addEventListener("click", () =>
  setMenu(button.getAttribute("aria-expanded") !== "true"),
);
nav.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenu(false);
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    button.getAttribute("aria-expanded") === "true"
  ) {
    setMenu(false);
    button.focus();
  }
});
window
  .matchMedia("(max-width: 960px)")
  .addEventListener("change", () => setMenu(false));
