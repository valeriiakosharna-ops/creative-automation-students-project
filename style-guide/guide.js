"use strict";
let palette = [
  "#00A6EB",
  "#E60036",
  "#81D0F4",
  "#EF958C",
  "#2A668E",
  "#937C8A",
  "#302A40",
  "#951B3C",
];
const formats = {
  instagram_post: {
    tag: "INSTAGRAM / FEED",
    title: "An invitation worth pausing for.",
    purpose:
      "Lead with a strong event name and one reason to join. The caption adds context; the visual stays focused.",
    type: "64–80 px · bold · 2–4 short lines",
    body: "28–36 px · one short idea",
    layout: "Text left, diagonal photo right, white logo shelf below.",
    copy: "A hook, event details, one CTA, and 1–3 relevant hashtags.",
    note: "1:1 composition · at least 65 px inside each edge",
  },
  instagram_story: {
    tag: "INSTAGRAM / STORY",
    title: "One glance. One next step.",
    purpose:
      "Create a vertical invitation. Put the headline high in the content area, use the photo as a central moment, and keep the CTA concise.",
    type: "72–96 px · bold · 2–4 short lines",
    body: "32–40 px · a short supporting line",
    layout:
      "Vertical hierarchy. Keep copy and the logo shelf away from native app controls.",
    copy: "A very short message and one CTA. Add a native link sticker manually when publishing.",
    note: "9:16 composition · 90 px sides, 250 px top and 320 px bottom for essential content",
  },
  facebook: {
    tag: "FACEBOOK / COMMUNITY",
    title: "Give the community a reason to join.",
    purpose:
      "Pair a useful event summary with a clear, welcoming announcement. The wider canvas needs shorter lines and fewer text blocks.",
    type: "48–60 px · bold · 2–3 short lines",
    body: "24–30 px · one supporting sentence",
    layout:
      "Wide text/photo split, concise date and location, balanced logo shelf.",
    copy: "Audience, value, practical event details, and a direct next step. Keep hashtags optional and sparse.",
    note: "1.91:1 composition · at least 72 px inside each edge",
  },
  google_chat: {
    tag: "GOOGLE CHAT / TEAM MESSAGE",
    title: "Useful information, right in the conversation.",
    purpose:
      "Let the image announce the event; let the message carry the details and link. Aim for a clean announcement rather than an advertising banner.",
    type: "48–64 px · bold · a compact title",
    body: "24–30 px · minimal supporting text",
    layout:
      "Simple horizontal composition. Prioritize title, date, and original logos.",
    copy: "A concise message, optional *bold* title, essential details and one event link. No hashtag block.",
    note: "16:9 composition · at least 72 px inside each edge",
  },
};
const captions = {
  en: {
    instagram_post:
      "Build something worth sharing.\n\nJoin Creative Automation Lab: a hands-on workshop for student builders.\n\n21 November 2026 · Kyiv, Ukraine\nFind out more at the event link.\n\n#CreativeAutomation #StudentProjects",
    instagram_story:
      "Creative Automation Lab\n21 November · Kyiv\nBuild your next idea.\nMore details at the event link.",
    facebook:
      "An invitation to student builders: join Creative Automation Lab for a hands-on workshop.\n\nLearn, experiment, and share your work with the community.\n21 November 2026 · Kyiv, Ukraine\n\nEvent details and registration: [event link].",
    google_chat:
      "*Creative Automation Lab*\n21 November 2026 · Kyiv, Ukraine\n\nA hands-on workshop for student builders.\nDetails and registration: [event link].",
  },
  uk: {
    instagram_post:
      "Створіть те, чим захочеться поділитися.\n\nДолучайтеся до Лабораторії креативної автоматизації — практичного воркшопу для студентів.\n\n21 листопада 2026 · Київ, Україна\nПодробиці — за посиланням на подію.\n\n#КреативнаАвтоматизація #СтудентськіПроєкти",
    instagram_story:
      "Лабораторія креативної автоматизації\n21 листопада · Київ\nВтілюйте свою наступну ідею.\nПодробиці — за посиланням на подію.",
    facebook:
      "Запрошуємо студентів до Лабораторії креативної автоматизації на практичний воркшоп.\n\nНавчайтеся, експериментуйте та діліться результатами зі спільнотою.\n21 листопада 2026 · Київ, Україна\n\nПодробиці та реєстрація: [посилання на подію].",
    google_chat:
      "*Лабораторія креативної автоматизації*\n21 листопада 2026 · Київ, Україна\n\nПрактичний воркшоп для студентів.\nПодробиці та реєстрація: [посилання на подію].",
  },
};
const tabs = [...document.querySelectorAll('[role="tab"]')];
let format = "instagram_post";
function render() {
  const data = formats[format],
    uk = document.getElementById("example-language").value === "uk",
    poster = document.getElementById("example-poster");
  poster.className = `example-poster ${format}${document.getElementById("show-photo").checked ? "" : " information-only"}`;
  poster.lang = uk ? "uk" : "en";
  for (const key of [
    "tag",
    "title",
    "purpose",
    "type",
    "body",
    "layout",
    "copy",
  ])
    document.getElementById(`format-${key}`).textContent = data[key];
  document.getElementById("example-note").textContent = data.note;
  document.getElementById("poster-title").textContent = uk
    ? "Лабораторія креативної автоматизації"
    : "Creative Automation Lab.";
  document.getElementById("poster-kicker").textContent = uk
    ? "НАВЧАЙТЕСЯ. СТВОРЮЙТЕ. ДІЛІТЬСЯ."
    : "LEARN. BUILD. SHARE.";
  document.getElementById("poster-summary").textContent = uk
    ? "Практичний воркшоп для студентів."
    : "A hands-on workshop for student builders.";
  document.getElementById("poster-date").textContent = uk
    ? "21 листопада 2026"
    : "21 November 2026";
  document.getElementById("poster-location").textContent = uk
    ? "Київ, Україна"
    : "Kyiv, Ukraine";
  const caption = document.getElementById("caption-example");
  caption.textContent = captions[uk ? "uk" : "en"][format];
  caption.lang = uk ? "uk" : "en";
  document.getElementById("safe-area").hidden =
    !document.getElementById("show-safe-area").checked;
}
function select(tab, focus = false) {
  format = tab.dataset.format;
  tabs.forEach((t) => {
    const active = t === tab;
    t.setAttribute("aria-selected", String(active));
    t.tabIndex = active ? 0 : -1;
  });
  document
    .getElementById("format-panel")
    .setAttribute("aria-labelledby", tab.id);
  if (focus) tab.focus();
  render();
}
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => select(tab));
  tab.addEventListener("keydown", (event) => {
    const target = {
      ArrowRight: (i + 1) % tabs.length,
      ArrowLeft: (i + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(tabs[target], true);
  });
});
for (const id of ["example-language", "show-photo", "show-safe-area"])
  document.getElementById(id).addEventListener("change", render);
document
  .getElementById("print-guide")
  .addEventListener("click", () => window.print());
document.getElementById("copy-palette").addEventListener("click", async () => {
  const status = document.getElementById("palette-status");
  try {
    await navigator.clipboard.writeText(palette.join("\n"));
    status.textContent = "Palette copied.";
  } catch {
    status.textContent = "Copy these values: " + palette.join(", ");
  }
});
render();

const policyUrl = document.currentScript.dataset.policyUrl;
fetch(policyUrl)
  .then((response) => {
    if (!response.ok) throw Error();
    return response.json();
  })
  .then((policy) => {
    palette = Object.values(policy.palette);
    for (const [id, spec] of Object.entries(policy.formats)) {
      formats[id].type =
        `${spec.headline.preferred}px preferred · ${spec.headline.min}px minimum · bold`;
      formats[id].body =
        `${spec.subheading.preferred}px preferred · ${spec.subheading.min}px minimum · max ${spec.subheading.maxCharacters} characters`;
      formats[id].copy =
        spec.caption.direction +
        ` Maximum ${spec.caption.maxCharacters} characters.`;
    }
    document.getElementById("guide-version").textContent =
      `Shared policy v${policy.version} · used by Studio generation`;
    render();
  })
  .catch(() => {
    document.getElementById("guide-version").textContent =
      "Policy unavailable · showing reference examples";
  });
