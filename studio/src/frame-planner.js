import { structuredRequest } from "./openai.js";
import { visualReferences, visionReferences } from "./visual-references.js";
import prompt, { version } from "./prompts/frame-planner.js";
export const FRAME_PLANNER_VERSION = version;
const text = { type: "string" };
const schema = {
  type: "object", additionalProperties: false,
  required: ["headline", "subheading", "cta", "photoSummary", "visualPlan"],
  properties: {
    headline: text, subheading: text, cta: { type: "string", enum: [""] }, photoSummary: text,
    visualPlan: { type: "object", additionalProperties: false, required: ["layout", "direction"],
      properties: { layout: text, direction: text } },
  },
};
export function hasReferencePlan(output) {
  return output.referencePlanVersion === version && output.plannedPhotoId === (output.photoId || null) &&
    output.plannedLogoIds?.length === output.logoIds?.length &&
    output.logoIds.every((id) => output.plannedLogoIds.includes(id));
}
export async function planVisualFrame(brief, output, storyboardPost, assets, key, signal, onResponse) {
  const { photo, logos, items, references } = visualReferences(output, assets);
  const images = await visionReferences(items, signal);
  const data = await structuredRequest("visual_frame", prompt, {
    brief, campaignStyle: storyboardPost?.campaignStyle || brief.direction,
    frame: { id: output.id, format: output.format, language: output.language, position: output.variant,
      headline: output.headline, subheading: output.subheading, narrativeRole: output.visualPlan?.role },
    desiredStyle: brief.direction, effectiveColors: brief.colors, backgroundPreference: "light",
    references, photoAvailable: Boolean(photo), peoplePolicy: photo ? "preserve only the people already present in the assigned photo" : "no people",
  }, schema, key, signal, images, onResponse);
  const textValue = (value, fallback = "") => typeof value === "string" ? value : fallback;
  return {
    headline: textValue(data?.headline, output.headline), subheading: textValue(data?.subheading, output.subheading), cta: "", photoSummary: photo ? textValue(data?.photoSummary) : "",
    visualPlan: { role: output.visualPlan?.role || "details", layout: textValue(data?.visualPlan?.layout, output.visualPlan?.layout), direction: textValue(data?.visualPlan?.direction, textValue(data?.rawText, output.visualPlan?.direction)) },
    planningNote: !data?.visualPlan ? "The frame response is saved. Missing layout fields do not block image generation." : "",
    referencePlanVersion: version, plannedPhotoId: photo?.id || null, plannedLogoIds: logos.map((logo) => logo.id),
  };
}
