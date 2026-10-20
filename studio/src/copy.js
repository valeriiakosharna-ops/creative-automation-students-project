import { BRAND_POLICY } from "./brand.js";
import { copyError } from "./copy-limits.js";
import { browserCopy } from "./browser-copy.js";
import { csrfHeaders } from "./private-api.js";
export const PROMPT_VERSION = "studio-copy-v4";
export function eventDate(b, lang) {
  if (["list", "text"].includes(b.dateMode)) return b.dateText || "";
  const formatter = new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const start = new Date(`${b.date}T12:00:00Z`);
  return b.dateMode === "range" && b.endDate
    ? formatter.formatRange(start, new Date(`${b.endDate}T12:00:00Z`))
    : formatter.format(start);
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
  const cta = "";
  function compose(body) {
    if (o.format === "instagram_story") return [title, details, b.url].filter(Boolean).join("\n");
    const lines = o.format === "google_chat" ? [`*${title}*`, details, body, b.url]
      : o.format === "facebook" ? [title, details, body, b.url] : [title, body, details, b.url];
    return lines.filter(Boolean).join("\n\n");
  }
  let caption = compose(description);
  const captionLimit = BRAND_POLICY.formats[o.format].caption.targetMax;
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
  const limit = BRAND_POLICY.formats[o.format].subheading.maxCharacters;
  return {
    id: o.id,
    postId: o.postId || `${o.format}-${o.language}`,
    visualPlan: {
      role:
        o.variant === 1
          ? "opening"
          : o.variant === o.sequenceLength
            ? "closing"
            : "details",
      layout: ["split-right", "split-left", "poster"][(o.variant - 1) % 3],
      direction: "Deterministic branded template using supplied event facts.",
    },
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
  let data;
  if (typeof window !== "undefined" && window.STUDIO_RUNTIME?.pages) {
    if (baseUrl)
      throw Error(
        "Pages AI requests use OpenAI directly; custom proxy URLs are disabled.",
      );
    data = await browserCopy(brief, outputs, apiKey, signal);
  } else {
    if (apiKey && baseUrl)
      throw Error(
        "Open the full hosted Studio site to use your key. Keys are sent only to this site's own server.",
      );
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/copy`, {
      method: "POST",
      ...(apiKey ? { mode: "same-origin", redirect: "error" } : {}),
      headers: {
        "Content-Type": "application/json",
        ...(await csrfHeaders()),
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
  }
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
      !copy.caption.trim()
    )
      throw Error("AI response does not match this run.");
    ids.add(copy.id);
  }
  return {
    model: String(data.model || "configured-model"),
    promptVersion: data.promptVersion || PROMPT_VERSION,
    outputs: data.outputs.map(
      ({ id, headline, subheading, cta, caption, visualPlan, postId }) => {
        const copy = {
          id,
          headline,
          subheading,
          cta,
          caption,
          ...(visualPlan ? { visualPlan, postId } : {}),
        };
        const error = copyError(
          copy,
          outputs.find((output) => output.id === id),
        );
        return error ? { ...copy, error } : copy;
      },
    ),
  };
}
