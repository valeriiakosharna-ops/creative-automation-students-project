import test from "node:test";
import assert from "node:assert/strict";
import { planVisualFrame, hasReferencePlan } from "../src/frame-planner.js";
import { generateAIVisual } from "../src/ai-visual.js";
import { templateCopy } from "../src/copy.js";
const brief = { title: "Creative Lab", description: "Workshop", date: "2026-11-21", timeZone: "Europe/Kyiv", colors: ["#00A6EB", "#E60036", "#302A40"], sourceLanguage: "en", url: "https://example.com/event" };
const assets = {
  logos: [{ id: "logo-a", blob: new Blob(["LOGO A"], { type: "image/png" }) }, { id: "logo-b", blob: new Blob(["LOGO B"], { type: "image/png" }) }],
  photos: [{ id: "photo-a", blob: new Blob(["ASSIGNED PHOTO"], { type: "image/jpeg" }) }, { id: "photo-b", blob: new Blob(["DO NOT UPLOAD"], { type: "image/jpeg" }) }],
};
const frame = { id: "instagram_post-en-1", postId: "instagram_post-en", format: "instagram_post", language: "en", variant: 1, width: 1080, height: 1080, photoId: "photo-a", logoIds: ["logo-a", "logo-b"], visualPlan: { role: "opening" } };
const response = (data = {}) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ headline: "Creative Lab", subheading: "Workshop", cta: "Join now", photoSummary: "The actual photo", visualPlan: { layout: "Light organic composition", direction: "Only the original photo, light background, no extra people" }, ...data }) } }] });

test("the frame vision planner receives all original logos and exactly its allocated photo, and cannot reassign sources or inject CTA", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(options.body), content = body.messages[1].content;
    assert.equal(body.response_format.json_schema.name, "visual_frame");
    assert.equal(body.store, false);
    assert.match(body.messages[0].content, /Do not identify people by name/);
    assert.match(body.messages[0].content, /No CTA/);
    const input = JSON.parse(content[0].text);
    assert.equal(input.photoAvailable, true);
    assert.equal(input.backgroundPreference, "light");
    assert.equal(input.references.filter((ref) => ref.role.startsWith("ASSIGNED_EVENT_PHOTO")).length, 1);
    const bytes = content.slice(1).map((part) => Buffer.from(part.image_url.url.split(",")[1], "base64").toString());
    assert.deepEqual(bytes, ["ASSIGNED PHOTO", "LOGO A", "LOGO B"]);
    assert.ok(!options.body.includes("DO NOT UPLOAD"));
    return response({ photoId: "photo-b", logoIds: [], approved: true });
  });
  const result = await planVisualFrame(brief, frame, { campaignStyle: "Shared light campaign" }, assets, "test-key");
  assert.equal(result.cta, "");
  assert.equal(result.plannedPhotoId, "photo-a");
  assert.deepEqual(result.plannedLogoIds, ["logo-a", "logo-b"]);
  assert.equal(result.photoId, undefined);
  assert.equal(result.approved, undefined);
  assert.equal(hasReferencePlan({ ...frame, ...result }), true);
  assert.equal(hasReferencePlan({ ...frame, ...result, photoId: "photo-b" }), false);
});

test("a no-photo frame planner gets only logos and retains no invented photo summary", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const body = JSON.parse(options.body), content = body.messages[1].content, input = JSON.parse(content[0].text);
    assert.equal(input.photoAvailable, false);
    assert.equal(input.peoplePolicy, "no people");
    assert.deepEqual(content.slice(1).map((part) => Buffer.from(part.image_url.url.split(",")[1], "base64").toString()), ["LOGO A", "LOGO B"]);
    assert.match(body.messages[0].content, /NO people, faces, avatars, crowds/);
    return response({ photoSummary: "Invented people" });
  });
  const result = await planVisualFrame(brief, { ...frame, photoId: null }, {}, assets, "test-key");
  assert.equal(result.photoSummary, "");
  assert.equal(result.plannedPhotoId, null);
});

test("missing original sources, incomplete logo sets and unverified frame bindings fail before a generation request", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw Error("Unexpected network call"); });
  await assert.rejects(planVisualFrame(brief, { ...frame, photoId: "missing" }, {}, assets, "test-key"), /assigned original photo is missing/);
  await assert.rejects(planVisualFrame(brief, { ...frame, logoIds: ["logo-a"] }, {}, assets, "test-key"), /all original uploaded logos/);
  await assert.rejects(generateAIVisual(brief, frame, {}, assets, "test-key"), /Plan this visual/);
  assert.equal(calls, 0);
});

test("offline captions keep useful facts and plain URLs without a generated CTA", () => {
  for (const format of ["instagram_post", "instagram_story", "facebook", "google_chat"])
    for (const language of ["en", "uk"]) {
      const copy = templateCopy(brief, { ...frame, format, language });
      assert.equal(copy.cta, "");
      assert.ok(copy.caption.includes(brief.url));
      assert.doesNotMatch(copy.caption, /Join us|Find out more|Дізнайтеся більше|Долучайтеся/);
    }
});
