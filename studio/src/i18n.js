import ukrainian from "./messages.uk.json";
const normalize = (text) => text.replace(/\s+/g, " ").trim();
let language = "en";
try {
  language =
    localStorage.getItem("studio:ui-language") ||
    (navigator.language.startsWith("uk") ? "uk" : "en");
} catch {}
if (!["en", "uk"].includes(language)) language = "en";
const fields = {
  headline: "заголовок",
  subheading: "короткий опис",
  caption: "текст публікації",
  cta: "заклик до дії",
};
const statuses = {
  running: "створюється",
  completed: "готово",
  partial: "частково готово",
  failed: "помилка",
  cancelled: "скасовано",
  interrupted: "перервано",
};
export function translate(text) {
  if (language === "en" || typeof text !== "string") return text;
  const source = normalize(text);
  if (ukrainian[source])
    return text.match(/^\s*/)[0] + ukrainian[source] + text.match(/\s*$/)[0];
  let match;
  if (
    (match = source.match(
      /^Approved visuals: (\d+)\/(\d+) · Approved posts: (\d+)\/(\d+)\./,
    ))
  )
    return `Погоджено візуалів: ${match[1]}/${match[2]} · Погоджено текстів: ${match[3]}/${match[4]}. Погодьте кожен візуал і текст, щоб завантажити ZIP.`;
  if ((match = source.match(/^AI requests: 2 text \+ (\d+) images\./)))
    return `AI-запити: 2 для тексту + ${match[1]} для зображень. Перегенерація одного візуалу — ще 1 платний запит на зображення. Автоматичних повторів немає.`;
  if ((match = source.match(/^Post text must contain 1–(\d+) characters\.$/)))
    return `Текст публікації має містити від 1 до ${match[1]} символів.`;

  if ((match = source.match(/^Remove (.+)$/))) return `Видалити ${match[1]}`;
  if ((match = source.match(/^(\d+) files? processed\.$/)))
    return `Оброблено файлів: ${match[1]}.`;
  if ((match = source.match(/^You can add at most (\d+) (logos|photos)\.$/)))
    return `Можна додати максимум ${match[1]} ${match[2] === "logos" ? "логотипів" : "фото"}.`;
  if (
    (match = source.match(
      /^(Instagram post|Instagram story|Facebook post|Google Chat) · (English|Українська)$/,
    ))
  )
    return `${ukrainian[match[1]] || match[1]} · ${ukrainian[match[2]] || match[2]}`;
  if (
    (match = source.match(
      /^(Headline|Subheading|Details) cannot fit the brand guide's minimum (\d+)px type size\./,
    ))
  )
    return `${{ Headline: "Заголовок", Subheading: "Короткий опис", Details: "Дані події" }[match[1]]} не вміщується за мінімального розміру шрифту ${match[2]} px. Скоротіть текст; для зміни даних події скопіюйте бриф у новий запуск.`;
  for (const [suffix, replacement] of Object.entries({
    ": exceeds 10 MB.": ": перевищує 10 МБ.",
    ": exceeds 24 megapixels.": ": перевищує 24 мегапікселі.",
    ": only genuine PNG, JPEG and WebP images are supported.":
      ": підтримуються лише справжні зображення PNG, JPEG та WebP.",
    ": this image is already in your logos.":
      ": цей файл уже є серед логотипів.",
    ": this image is already in your photos.": ": цей файл уже є серед фото.",
    ": could not decode the image.": ": не вдалося відкрити зображення.",
  }))
    if (source.endsWith(suffix))
      return source.slice(0, -suffix.length) + replacement;
  if ((match = source.match(/^Rendering visual (\d+) of (\d+)…$/)))
    return `Створюємо візуал ${match[1]} із ${match[2]}…`;
  if ((match = source.match(/^(.*?) · (\d+) of (\d+) outputs ready · (.*)$/)))
    return `${match[1]} · готово ${match[2]} із ${match[3]} · ${match[4].replace("English", "Англійська")}`;
  if (
    (match = source.match(
      /^(.*?) · (headline|subheading|caption|cta) has (\d+) characters; limit (\d+)\./,
    ))
  )
    return `${match[1]}: ${fields[match[2]]} містить ${match[3]} символів; максимум ${match[4]}. Відредагуйте цей результат без нового запиту до AI.`;
  if (
    (match = source.match(
      /^(.*?): (headline|subheading|caption|cta) has (\d+) characters; limit (\d+)\./,
    ))
  )
    return `${match[1]}: ${fields[match[2]]} містить ${match[3]} символів; максимум ${match[4]}. Відредагуйте цей результат без нового запиту до AI.`;
  if (
    (match = source.match(
      /^(.*?): (headline|subheading|caption|cta) is required\.$/,
    ))
  )
    return `${match[1]}: ${fields[match[2]]} — обов’язкове поле.`;
  if (
    (match = source.match(
      /^(.*?) · (running|completed|partial|failed|cancelled|interrupted)$/,
    ))
  )
    return `${match[1]} · ${statuses[match[2]]}`;
  if ((match = source.match(/^(Photo included|Information-only) · V(\d+)$/)))
    return `${ukrainian[match[1]]} · №${match[2]}`;
  if (
    (match = source.match(/^(AI COPY|TEMPLATE COPY) \/ (\w+) \/ GUIDE (.+)$/))
  )
    return `${match[1] === "AI COPY" ? "AI-ТЕКСТ" : "ТЕКСТ ШАБЛОНУ"} / ${(statuses[match[2].toLowerCase()] || match[2]).toUpperCase()} / СТИЛЬ ${match[3]}`;
  if (
    (match = source.match(
      /^headline: (\d+) · subheading: (\d+) · CTA: (\d+) · caption: (\d+)$/,
    ))
  )
    return `заголовок: ${match[1]} · опис: ${match[2]} · заклик: ${match[3]} · текст: ${match[4]}`;
  if ((match = source.match(/^OpenAI rejected the request \(HTTP (\d+)\)\./)))
    return `OpenAI відхилив запит (HTTP ${match[1]}). Перевірте ключ, доступ до моделі та баланс API.`;
  if (
    (match = source.match(
      /^Layout preview · (.+) · (.+) · (.+)\. AI wording may differ\.$/,
    ))
  )
    return `Попередній перегляд · ${ukrainian[match[1]] || match[1]} · ${ukrainian[match[2]] || match[2]} · ${match[3]}. AI-текст може відрізнятися.`;
  return text;
}
export const confirmTranslated = (text) => window.confirm(translate(text));
export const interfaceLanguage = () => language;
const originalText = new WeakMap(),
  originalAttributes = new WeakMap();
const excluded =
  "script,style,textarea,input,pre,code,[translate=no],[data-ui-language],.output-copy,.asset-name,.project-item,.history-item strong,#current-project-name";
function updateText(node) {
  if (!node.parentElement || node.parentElement.closest(excluded)) return;
  let record = originalText.get(node);
  if (!record || node.data !== record.rendered)
    record = { source: node.data, rendered: node.data };
  const next = translate(record.source);
  record.rendered = next;
  originalText.set(node, record);
  if (node.data !== next) node.data = next;
}
function updateAttributes(element) {
  if (
    element.closest(
      "[translate=no],.output-copy,.asset-name,.project-item,.history-item strong,[data-ui-language]",
    )
  )
    return;
  for (const name of ["placeholder", "aria-label", "title"]) {
    const value = element.getAttribute(name);
    if (!value) continue;
    let records = originalAttributes.get(element);
    if (!records) {
      records = {};
      originalAttributes.set(element, records);
    }
    let record = records[name];
    if (!record || value !== record.rendered)
      record = { source: value, rendered: value };
    const next = translate(record.source);
    record.rendered = next;
    records[name] = record;
    if (value !== next) element.setAttribute(name, next);
  }
}
export function initializeInterface() {
  const refresh = (root = document.body) => {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      updateText(root);
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) updateText(node);
    if (root.nodeType === Node.ELEMENT_NODE) {
      updateAttributes(root);
      root
        .querySelectorAll("[placeholder],[aria-label],[title]")
        .forEach(updateAttributes);
    }
  };
  const observer = new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === "characterData") updateText(change.target);
      else if (change.type === "attributes") updateAttributes(change.target);
      else change.addedNodes.forEach(refresh);
    }
  });
  document.documentElement.lang = language;
  document.querySelectorAll("[data-ui-language]").forEach((select) => {
    select.value = language;
    select.addEventListener("change", () => {
      language = select.value;
      try {
        localStorage.setItem("studio:ui-language", language);
      } catch {}
      document.documentElement.lang = language;
      document.querySelectorAll("[data-ui-language]").forEach((control) => {
        control.value = language;
      });
      refresh();
      window.dispatchEvent(new Event("studio:language-change"));
    });
  });
  refresh();
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["placeholder", "aria-label", "title"],
  });
}
