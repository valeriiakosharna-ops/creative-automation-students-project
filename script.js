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

// Small, local illustrations of the requirements. No network or persistence.
const framesControl = document.querySelector("#demo-frames");
const languagesControl = document.querySelector("#demo-languages");
const photosControl = document.querySelector("#demo-photos");
function updateCountDemo() {
  const frames = Number(framesControl.value);
  const languages = Number(languagesControl.value);
  const total = frames * languages;
  const photoFrames = Math.min(Number(photosControl.value), total);
  document.querySelector("#demo-frames-value").textContent = frames;
  document.querySelector("#demo-photos-value").textContent =
    photosControl.value;
  document.querySelector("#demo-count-summary").textContent =
    `${total} visuals · ${languages} shared caption${languages === 1 ? "" : "s"} · ${photoFrames} photo frames · ${total - photoFrames} information-only`;
  const list = document.querySelector("#demo-frame-list");
  list.replaceChildren();
  for (let languageIndex = 0; languageIndex < languages; languageIndex++) {
    const group = document.createElement("div");
    group.className = "demo-language-group";
    const title = document.createElement("strong");
    title.textContent = `${languageIndex === 0 ? "English" : "Ukrainian"} — one shared caption`;
    const strip = document.createElement("div");
    strip.className = "demo-frame-strip";
    for (let frame = 0; frame < frames; frame++) {
      const index = languageIndex * frames + frame;
      const tile = document.createElement("div");
      tile.className = `demo-frame ${index < photoFrames ? "has-photo" : ""}`;
      const position = document.createElement("strong");
      position.textContent = `Frame ${frame + 1}`;
      const source = document.createElement("span");
      source.textContent =
        index < photoFrames ? `Photo ${index + 1}` : "Information";
      const logos = document.createElement("small");
      logos.textContent = "All logos";
      tile.append(position, source, logos);
      strip.append(tile);
    }
    group.append(title, strip);
    list.append(group);
  }
}
[framesControl, languagesControl, photosControl].forEach((input) =>
  input.addEventListener("input", updateCountDemo),
);
updateCountDemo();

const runDemo = document.querySelector("#demo-run");
runDemo.addEventListener("click", () => {
  runDemo.disabled = true;
  document.querySelector("#demo-plan-output").hidden = true;
  document.querySelector("#demo-plan-status").textContent = "Planning…";
  document.querySelector("#demo-copy-status").textContent = "Writing…";
  document.querySelector("#demo-image-status").textContent =
    "Waiting for the plan";
  setTimeout(() => {
    document.querySelector("#demo-copy-status").textContent = "Caption ready";
  }, 400);
  setTimeout(() => {
    document.querySelector("#demo-plan-status").textContent = "JSON plan ready";
    document.querySelector("#demo-image-status").textContent =
      "Creating visuals…";
    const plan = document.querySelector("#demo-plan-output");
    plan.textContent = JSON.stringify(
      {
        frames: [
          { order: 1, topic: "Event overview", photo: "Photo 1" },
          { order: 2, topic: "Programme", photo: null },
        ],
        background: "light",
      },
      null,
      2,
    );
    plan.hidden = false;
  }, 700);
  setTimeout(() => {
    document.querySelector("#demo-image-status").textContent =
      "Visuals ready for review";
    runDemo.disabled = false;
  }, 1200);
});

const demoPrompts = {
  plan: "Create a JSON plan for a coherent sequence. Use light backgrounds and allocate only the supplied original photos.",
  copy: "Write one factual, channel-specific caption per post and language. Preserve the event details. Do not add a promotional ending.",
  image:
    "Generate the planned visual using all original logos and only its assigned photo. Keep the campaign style and light background.",
};
const roleControl = document.querySelector("#demo-role");
const promptTypeControl = document.querySelector("#demo-prompt-type");
const promptText = document.querySelector("#demo-prompt-text");
const saveDemoPrompt = document.querySelector("#demo-save-prompt");
function updatePromptDemo() {
  const editable = roleControl.value === "editor";
  promptText.value = demoPrompts[promptTypeControl.value];
  promptText.disabled = !editable;
  saveDemoPrompt.disabled = !editable;
  document.querySelector("#demo-prompt-status").textContent = editable
    ? "Editor: this prompt can be changed through the UI."
    : "Viewer: read-only. Select Editor to change the prompt.";
}
roleControl.addEventListener("change", updatePromptDemo);
promptTypeControl.addEventListener("change", updatePromptDemo);
saveDemoPrompt.addEventListener("click", () => {
  if (roleControl.value !== "editor") return;
  demoPrompts[promptTypeControl.value] = promptText.value;
  document.querySelector("#demo-prompt-status").textContent =
    "Demo change applied to future requests. No API call was made.";
});
updatePromptDemo();
