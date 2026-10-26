import { BRAND_POLICY } from "./brand.js";
import { captionGuidance } from "./caption-guidance.js";
import { structuredRequest } from "./openai.js";
import plannerPrompt, { version as plannerVersion } from "./prompts/planner.js";
import copyPrompt, { version as copyVersion } from "./prompts/social-copy.js";
import { CHANNEL_STYLES, MODELS } from "./prompts/channel-styles.js";

export const PROMPT_VERSIONS = { planner: plannerVersion, copy: copyVersion };
const object = (properties) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
const string = { type: "string" };
const visualSchema = object({
  id: string,
  headline: string,
  subheading: string,
  cta: { type: "string", enum: [""] },
  visualPlan: object({
    role: {
      type: "string",
      enum: ["opening", "context", "benefit", "details", "closing"],
    },
    layout: string,
    direction: string,
  }),
});
const rootSchema = (post) => object({ posts: { type: "array", items: post } });
export function outputRequirements(outputs) {
  return outputs.map(
    ({ id, format, language, variant, photoId, logoIds, width, height }) => ({
      id,
      format,
      language,
      postId: `${format}-${language}`,
      position: variant,
      sequenceLength: outputs.filter(
        (output) => output.format === format && output.language === language,
      ).length,
      photoAvailable: Boolean(photoId),
      logoCount: logoIds?.length || 0,
      width,
      height,
      visualStyle: CHANNEL_STYLES[format],
    }),
  );
}
export function postRequirements(outputs, research) {
  const frames = outputRequirements(outputs);
  return [...new Set(frames.map((output) => output.postId))].map((id) => {
    const visuals = frames.filter((output) => output.postId === id),
      first = visuals[0];
    return {
      id,
      format: first.format,
      language: first.language,
      visualCount: visuals.length,
      visualIds: visuals.map((output) => output.id),
      visualStyle: first.visualStyle,
      captionStyle: BRAND_POLICY.formats[first.format].caption.direction,
      captionGuidance: captionGuidance(first.format, research),
    };
  });
}
function palette(brief) {
  return `\nDesired palette: ${JSON.stringify(brief.colors || BRAND_POLICY.defaultColors)}`;
}
const textValue = (value, fallback = "") => typeof value === "string" ? value : fallback;
export function matchResponseItems(items, specs) {
  const list = Array.isArray(items) ? items : [];
  const known = new Set(specs.map((spec) => spec.id));
  return specs.map((spec, index) => {
    const exact = list.find((item) => item && item.id === spec.id);
    if (exact) return exact;
    const candidate = list[index];
    // Only recover positional IDs when the provider returned the entire list.
    // Known/duplicate IDs must never be reassigned to another requested item.
    return list.length === specs.length && candidate && !known.has(candidate.id) ? candidate : null;
  });
}
export async function browserStoryboard(brief, outputs, apiKey, signal, onResponse) {
  const expected = postRequirements(outputs);
  const content = await structuredRequest(
    "visual_storyboard",
    plannerPrompt + palette(brief),
    { brief, posts: expected, outputs: outputRequirements(outputs) },
    object({ campaignStyle: string, posts: { type: "array", items: object({ id: { type: "string", enum: expected.map((post) => post.id) }, visuals: { type: "array", items: { ...visualSchema, properties: { ...visualSchema.properties, id: { type: "string", enum: outputs.map((output) => output.id) } } } } }) } }),
    apiKey,
    signal,
    [],
    onResponse,
  );
  const matched = matchResponseItems(content?.posts, expected);
  return expected.map((spec, index) => {
    const post = matched[index];
    const frames = matchResponseItems(post?.visuals, spec.visualIds.map((id) => ({ id })));
    return {
      id: spec.id,
      campaignStyle: textValue(content?.campaignStyle).trim() || brief.direction || "A coherent, contemporary campaign with light backgrounds and the supplied palette.",
      visuals: spec.visualIds.map((id, frameIndex) => {
        const frame = frames[frameIndex];
        return { id, headline: textValue(frame?.headline), subheading: textValue(frame?.subheading), cta: "",
          visualPlan: { role: textValue(frame?.visualPlan?.role, frameIndex === 0 ? "opening" : "details"),
            layout: textValue(frame?.visualPlan?.layout), direction: textValue(frame?.visualPlan?.direction) } };
      }),
    };
  });
}

export async function browserPostCopy(brief, outputs, apiKey, signal, research, onResponse) {
  const expected = postRequirements(outputs, research);
  const content = await structuredRequest(
    "social_posts",
    copyPrompt,
    { brief, posts: expected, researchCheckedAt: research?.checkedAt || null },
    rootSchema(object({ id: { type: "string", enum: expected.map((post) => post.id) }, caption: string })),
    apiKey,
    signal,
    [],
    onResponse,
  );
  const matched = matchResponseItems(content?.posts, expected);
  return expected.map((spec, index) => {
    const caption = textValue(matched[index]?.caption);
    return { id: spec.id, format: spec.format, language: spec.language, caption,
      status: caption.trim() ? "completed" : "failed",
      ...(caption.trim() ? {} : { error: "This post was missing from the AI response. Other results are kept. Enter its text here without a new AI request." }) };
  });
}
// Compatibility for callers requesting copy only. Pages generation uses the independent pipeline.
export async function browserCopy(brief, outputs, apiKey, signal, onResponse) {
  const [storyboard, posts] = await Promise.all([
    browserStoryboard(brief, outputs, apiKey, signal, onResponse),
    browserPostCopy(brief, outputs, apiKey, signal),
  ]);
  return {
    model: MODELS.text,
    styleGuideVersion: BRAND_POLICY.version,
    outputs: storyboard.flatMap((post) =>
      post.visuals.map((visual) => ({
        ...visual,
        postId: post.id,
        caption: posts.find((item) => item.id === post.id).caption,
      })),
    ),
  };
}
