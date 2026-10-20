import { BRAND_POLICY } from "./brand.js";
export const PROMPT_VERSION = "studio-copy-v2";
export function eventDate(b, lang) {
  const [y, m, d] = b.date.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
export function templateCopy(b, o) {
  const uk = o.language === "uk";
  const title = (b[uk ? "titleUk" : "titleEn"] || b.title).trim();
  const description = (
    b[uk ? "descriptionUk" : "descriptionEn"] ||
    (b.sourceLanguage === o.language ? b.description : "")
  ).trim();
  const details = [
    eventDate(b, o.language),
    b.time ? `${b.time} (${b.timeZone})` : "",
    b.location,
  ]
    .filter(Boolean)
    .join(" · ");
  const cta = uk ? "Дізнайтеся більше" : "Find out more",
    link = b.url ? `\n${b.url}` : "";
  const opening = uk
    ? ["Долучайтеся до нас!", "Збережіть дату!", "Зустрінемося на події!"][
        o.variant - 1
      ]
    : ["Join us!", "Save the date!", "See you there!"][o.variant - 1];
  function compose(body) {
    let caption;
    if (o.format === "instagram_story")
      caption = [title, details, b.url ? `${cta}${link}` : opening]
        .filter(Boolean)
        .join("\n");
    else if (o.format === "google_chat")
      caption = [`*${title}*`, details, body, `${cta}${link}`]
        .filter(Boolean)
        .join("\n\n");
    else if (o.format === "facebook")
      caption = [
        `${opening} ${title}`,
        body,
        details,
        b.url ? `${cta}:${link}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    else
      caption = [
        `${title} — ${opening}`,
        body,
        details,
        b.url ? `${cta}${link}` : "",
        uk ? "#Подія" : "#Event",
      ]
        .filter(Boolean)
        .join("\n\n");
    return caption;
  }
  let caption = compose(description);
  const captionLimit = BRAND_POLICY.formats[o.format].caption.maxCharacters;
  if (
    caption.length > captionLimit &&
    description &&
    o.format !== "instagram_story"
  ) {
    const without = compose("");
    const separatorCost = compose("x").length - without.length - 1;
    const budget = captionLimit - without.length - separatorCost;
    const short =
      budget > 12
        ? description.slice(0, budget - 1).replace(/\s+\S*$/, "") + "…"
        : "";
    caption = compose(short);
  }
  if (caption.length > captionLimit)
    throw Error(
      `${o.format} caption cannot fit the guide's ${captionLimit}-character limit. Shorten the event name, location or link.`,
    );
  const limit = BRAND_POLICY.formats[o.format].subheading.maxCharacters;
  return {
    id: o.id,
    headline: title,
    subheading:
      description.length > limit
        ? description.slice(0, limit - 1).replace(/\s+\S*$/, "") + "…"
        : description,
    cta,
    caption,
  };
}
export async function requestCopy(
  brief,
  outputs,
  baseUrl,
  signal,
  apiKey = "",
) {
  if (apiKey && baseUrl)
    throw Error(
      "Open the full hosted Studio site to use your key. Keys are sent only to this site's own server.",
    );
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/copy`, {
    method: "POST",
    ...(apiKey ? { mode: "same-origin", redirect: "error" } : {}),
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-OpenAI-Key": apiKey } : {}),
    },
    body: JSON.stringify({
      brief,
      styleGuideVersion: BRAND_POLICY.version,
      outputs: outputs.map(({ id, format, language, variant }) => ({
        id,
        format,
        language,
        variant,
      })),
    }),
    signal,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error(
      "The AI server returned an unreadable response. Check the backend URL.",
    );
  }
  if (!response.ok)
    throw Error(
      data.message || "AI copy generation failed. Your brief has been kept.",
    );
  if (data.styleGuideVersion !== BRAND_POLICY.version)
    throw Error(
      "AI server and browser style guide versions differ. Rebuild/restart the server and reload Studio.",
    );
  if (!Array.isArray(data.outputs) || data.outputs.length !== outputs.length)
    throw Error("AI response is incomplete. No template text was substituted.");
  const ids = new Set();
  for (const copy of data.outputs) {
    if (
      ids.has(copy.id) ||
      !outputs.some((o) => o.id === copy.id) ||
      !["headline", "subheading", "caption", "cta"].every(
        (k) => typeof copy[k] === "string",
      ) ||
      !copy.headline.trim() ||
      !copy.caption.trim() ||
      copy.headline.length > 80 ||
      copy.subheading.length > 160 ||
      copy.cta.length > 40 ||
      copy.caption.length > 3000
    )
      throw Error("AI response does not match this run.");
    const format = outputs.find((output) => output.id === copy.id).format;
    const rule = BRAND_POLICY.formats[format];
    if (
      copy.subheading.length > rule.subheading.maxCharacters ||
      copy.caption.length > rule.caption.maxCharacters
    )
      throw Error("AI copy exceeds this format's brand style guide limits.");
    ids.add(copy.id);
  }
  return {
    model: String(data.model || "configured-model"),
    outputs: data.outputs.map(({ id, headline, subheading, cta, caption }) => ({
      id,
      headline,
      subheading,
      cta,
      caption,
    })),
  };
}
