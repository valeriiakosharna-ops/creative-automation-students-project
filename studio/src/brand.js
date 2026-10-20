import policy from "../brand-policy.json" with { type: "json" };
function freeze(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
export const BRAND_POLICY = freeze(policy);
export function snapshotPolicy(colors = BRAND_POLICY.defaultColors) {
  return { ...structuredClone(BRAND_POLICY), effectiveColors: [...colors] };
}
