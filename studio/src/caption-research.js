import { BRAND_POLICY } from "./brand.js";
import { openaiRequest } from "./openai.js";
import { MODELS } from "./prompts/channel-styles.js";
import prompt, { version } from "./prompts/caption-research.js";
export const RESEARCH_PROMPT_VERSION = version;
const domains = [
  "developers.facebook.com", "help.instagram.com", "about.instagram.com",
  "creators.instagram.com", "facebook.com", "developers.google.com",
  "buffer.com", "hootsuite.com", "sproutsocial.com", "later.com",
];
const string = { type: "string" };
const schema = {
  type: "object", additionalProperties: false, required: ["channels"],
  properties: { channels: { type: "array", items: {
    type: "object", additionalProperties: false,
    required: ["format", "summary", "recommendedMin", "recommendedMax", "sourceUrls"],
    properties: {
      format: { type: "string", enum: Object.keys(BRAND_POLICY.formats) },
      summary: string,
      recommendedMin: { type: "integer" }, recommendedMax: { type: "integer" },
      sourceUrls: { type: "array", items: string },
    },
  } } },
};
export function publicSource(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password ||
      !domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}
export async function researchCaptions(formats, apiKey, signal) {
  const checkedAt = new Date().toISOString();
  const selected = [...new Set(formats)].filter((format) => BRAND_POLICY.formats[format]);
  const fallback = { status: "unavailable", checkedAt, promptVersion: version, channels: [], sources: [] };
  try {
    const data = await openaiRequest("responses", {
      model: MODELS.text, store: false,
      instructions: prompt,
      // Only this allowlisted public context goes to the research model/tool.
      // Never spread the event brief, uploads, identity or account settings here.
      input: JSON.stringify({ checkedOn: checkedAt.slice(0, 10), formats: selected }),
      tools: [{ type: "web_search", search_context_size: "low", filters: { allowed_domains: domains } }],
      tool_choice: "required", max_tool_calls: 1,
      include: ["web_search_call.action.sources"],
      text: { format: { type: "json_schema", name: "caption_recommendations", strict: true, schema } },
      max_output_tokens: 2500,
    }, apiKey, signal, 45000);
    if (data.status !== "completed" || !Array.isArray(data.output) ||
      !data.output.some((item) => item.type === "web_search_call" && item.status === "completed")) return fallback;
    const evidence = new Map();
    for (const item of data.output) {
      for (const source of item.action?.sources || []) {
        const url = publicSource(source.url);
        if (url) evidence.set(url, { url, title: new URL(url).hostname });
      }
      for (const part of item.content || [])
        for (const citation of part.annotations || []) {
          if (citation.type !== "url_citation") continue;
          const url = publicSource(citation.url);
          if (url) evidence.set(url, { url, title: String(citation.title || new URL(url).hostname).slice(0, 200) });
        }
    }
    const content = JSON.parse(data.output.filter((item) => item.type === "message")
      .flatMap((item) => item.content || []).filter((part) => part.type === "output_text")
      .map((part) => part.text).join(""));
    if (!Array.isArray(content.channels)) return fallback;
    const channels = [];
    for (const channel of content.channels) {
      if (!selected.includes(channel?.format) || channels.some((item) => item.format === channel.format) ||
        typeof channel.summary !== "string" || !channel.summary.trim() || channel.summary.length > 1800 ||
        !Number.isInteger(channel.recommendedMin) || !Number.isInteger(channel.recommendedMax) ||
        channel.recommendedMin < 0 || channel.recommendedMax < channel.recommendedMin || channel.recommendedMax > 2000 ||
        !Array.isArray(channel.sourceUrls)) continue;
      const sourceUrls = [...new Set(channel.sourceUrls.map(publicSource).filter((url) => url && evidence.has(url)))].slice(0, 5);
      if (!sourceUrls.length) continue;
      channels.push({ format: channel.format, summary: channel.summary, recommendedMin: channel.recommendedMin, recommendedMax: channel.recommendedMax, sourceUrls });
    }
    if (!channels.length) return fallback;
    return { status: "available", checkedAt, promptVersion: version, channels,
      sources: [...new Set(channels.flatMap((channel) => channel.sourceUrls))].map((url) => evidence.get(url)) };
  } catch (error) {
    if (signal?.aborted) throw error;
    // Research is optional evidence. Failure never discards post copy or visuals.
    return fallback;
  }
}
