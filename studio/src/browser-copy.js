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
  cta: string,
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
function validatePosts(content, expected) {
  if (
    !Array.isArray(content?.posts) ||
    content.posts.length !== expected.length ||
    content.posts.some(
      (post) => !post || !expected.some((item) => item.id === post.id),
    ) ||
    new Set(content.posts.map((post) => post.id)).size !== expected.length
  )
    throw Error("AI response does not match this run.");
}
export async function browserStoryboard(brief, outputs, apiKey, signal) {
  const expected = postRequirements(outputs);
  const content = await structuredRequest(
    "visual_storyboard",
    plannerPrompt + palette(brief),
    { brief, posts: expected, outputs: outputRequirements(outputs) },
    object({ campaignStyle: string, posts: { type: "array", items: object({ id: string, visuals: { type: "array", items: visualSchema } }) } }),
    apiKey,
    signal,
  );
  validatePosts(content, expected);
  if (typeof content.campaignStyle !== "string" || !content.campaignStyle.trim())
    throw Error("AI response does not match this run.");
  for (const post of content.posts) {
    const ids = expected.find((item) => item.id === post.id).visualIds;
    if (
      !Array.isArray(post.visuals) ||
      post.visuals.length !== ids.length ||
      new Set(post.visuals.map((visual) => visual?.id)).size !== ids.length
    )
      throw Error("AI response does not match this run.");
    for (const frame of post.visuals) {
      if (
        !frame ||
        !ids.includes(frame.id) ||
        !["headline", "subheading", "cta"].every(
          (key) => typeof frame[key] === "string",
        ) ||
        !frame.headline.trim() ||
        !["opening", "context", "benefit", "details", "closing"].includes(
          frame.visualPlan?.role,
        ) ||
        typeof frame.visualPlan?.layout !== "string" ||
        !frame.visualPlan.layout.trim() ||
        typeof frame.visualPlan?.direction !== "string" ||
        !frame.visualPlan.direction.trim()
      )
        throw Error("AI response does not match this run.");
    }
    // Input order, not provider response ordering, defines the narrative sequence.
    post.visuals.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  }
  return expected.map(({ id }) => ({
    id,
    campaignStyle: content.campaignStyle,
    visuals: content.posts
      .find((post) => post.id === id)
      .visuals.map((frame) => ({
        id: frame.id,
        headline: frame.headline,
        subheading: frame.subheading,
        cta: frame.cta,
        visualPlan: {
          role: frame.visualPlan.role,
          layout: frame.visualPlan.layout,
          direction: frame.visualPlan.direction,
        },
      })),
  }));
}
export async function browserPostCopy(brief, outputs, apiKey, signal, research) {
  const expected = postRequirements(outputs, research);
  const content = await structuredRequest(
    "social_posts",
    copyPrompt,
    { brief, posts: expected, researchCheckedAt: research?.checkedAt || null },
    rootSchema(object({ id: string, caption: string })),
    apiKey,
    signal,
  );
  validatePosts(content, expected);
  return expected.map((spec) => {
    const post = content.posts.find((item) => item.id === spec.id);
    if (typeof post.caption !== "string" || !post.caption.trim())
      throw Error("AI response does not match this run.");
    return {
      id: spec.id,
      format: spec.format,
      language: spec.language,
      caption: post.caption,
      status: "completed",
    };
  });
}
// Compatibility for callers requesting copy only. Pages generation uses the independent pipeline.
export async function browserCopy(brief, outputs, apiKey, signal) {
  const [storyboard, posts] = await Promise.all([
    browserStoryboard(brief, outputs, apiKey, signal),
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
