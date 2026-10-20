import test from "node:test";
import assert from "node:assert/strict";
import { planOutputs, validateBrief } from "../src/planner.js";
import { templateCopy } from "../src/copy.js";
import { buildArchive } from "../src/archive.js";
import { unzipSync, strFromU8 } from "fflate";
const brief = {
  title: "ML Week",
  description: "A Java workshop",
  date: "2026-11-21",
  timeZone: "Europe/Kyiv",
  sourceLanguage: "en",
  formats: ["instagram_post", "instagram_story", "facebook", "google_chat"],
  languages: ["en", "uk"],
  variants: 2,
  colors: ["#00a6eb", "#e60036", "#302a40"],
};
const photos = [{ id: "photo-one" }, { id: "photo-two" }],
  logos = [{ id: "logo-one" }, { id: "logo-two" }];
test("photo allocation never repeats within a network, including languages and Instagram formats", () => {
  const outputs = planOutputs(brief, photos, logos);
  assert.equal(outputs.length, 16);
  for (const network of ["instagram", "facebook", "google_chat"]) {
    const used = outputs
      .filter((o) => o.network === network && o.photoId)
      .map((o) => o.photoId);
    assert.deepEqual(used, ["photo-one", "photo-two"]);
    assert.equal(new Set(used).size, used.length);
  }
  assert.equal(outputs.filter((o) => !o.photoId).length, 10);
  for (const o of outputs)
    assert.deepEqual(o.logoIds, ["logo-one", "logo-two"]);
  assert.equal(
    outputs.find((o) => o.format === "instagram_story").photoId,
    null,
  );
});
test("no photos is valid; every output becomes informational", () => {
  assert.ok(planOutputs(brief, [], logos).every((o) => o.photoId === null));
  assert.deepEqual(validateBrief(brief, logos), []);
});
test("a language and logos are mandatory; unknown formats and invalid URLs are rejected", () => {
  assert.match(
    validateBrief({ ...brief, languages: [] }, logos).join(" "),
    /Choose English/,
  );
  assert.match(validateBrief(brief, []).join(" "), /logo/);
  assert.match(
    validateBrief({ ...brief, formats: ["tiktok"] }, logos).join(" "),
    /supported format/,
  );
  assert.match(
    validateBrief({ ...brief, url: "javascript:alert(1)" }, logos).join(" "),
    /https/,
  );
});
test("captions differ by channel, and Ukrainian output uses localized copy", () => {
  const b = {
    ...brief,
    titleUk: "Тиждень машинного навчання",
    descriptionUk: "Навчайтеся та створюйте разом.",
  };
  const outputs = planOutputs(b, photos, logos);
  const captions = new Set(
    outputs
      .filter((o) => o.language === "en" && o.variant === 1)
      .map((o) => templateCopy(b, o).caption),
  );
  assert.equal(captions.size, 4);
  const ukrainian = templateCopy(
    b,
    outputs.find((o) => o.language === "uk"),
  );
  assert.match(ukrainian.caption, /Навчайтеся/);
  assert.match(ukrainian.headline, /Тиждень/);
  assert.ok(!ukrainian.caption.includes("A Java workshop"));
});
test("ZIP contains paired PNG/caption files, immutable brief and explicit failed output metadata", async () => {
  const planned = planOutputs(
    { ...brief, formats: ["facebook"], languages: ["uk"], variants: 2 },
    photos,
    logos,
  );
  const run = {
    id: "1234-run",
    projectId: "p",
    createdAt: "2026-10-20T00:00:00Z",
    status: "partial",
    brief,
    assets: { logos, photos },
    mode: "template",
    outputs: [
      {
        ...planned[0],
        status: "completed",
        caption: "Вітаємо!",
        image: new Blob([new Uint8Array([137, 80, 78, 71])]),
      },
      { ...planned[1], status: "failed", error: "Rendering failed." },
    ],
  };
  const result = await buildArchive(run),
    files = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
  assert.equal(strFromU8(files["facebook/uk/variant-01.txt"]), "Вітаємо!");
  assert.ok(files["facebook/uk/variant-01.png"]);
  assert.ok(!files["facebook/uk/variant-02.png"]);
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  assert.equal(manifest.outputs[1].status, "failed");
  assert.equal(manifest.outputs[1].imageFile, null);
  assert.ok(!("image" in manifest.outputs[0]));
  assert.deepEqual(JSON.parse(strFromU8(files["brief.json"])), brief);
});

test("shared policy snapshots are independent and template text obeys each format limit", async () => {
  const { BRAND_POLICY, snapshotPolicy } = await import("../src/brand.js");
  const snapshot = snapshotPolicy(["#111111", "#222222", "#333333"]);
  snapshot.formats.instagram_story.safeArea.bottom = 1;
  assert.equal(BRAND_POLICY.formats.instagram_story.safeArea.bottom, 320);
  const long = {
    ...brief,
    description: "A practical workshop for student builders. ".repeat(40),
  };
  for (const output of planOutputs(long, photos, logos).filter(
    (o) => o.language === "en",
  )) {
    const copy = templateCopy(long, output),
      rule = BRAND_POLICY.formats[output.format];
    assert.ok(copy.caption.length <= rule.caption.maxCharacters);
    assert.ok(copy.subheading.length <= rule.subheading.maxCharacters);
    assert.match(copy.caption, /ML Week/);
  }
  assert.ok(long.description.length > 1000);
});
test("AI copy rejects a different guide version before it can be rendered", async (t) => {
  const { requestCopy } = await import("../src/copy.js");
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify({ styleGuideVersion: "old", outputs: [] })),
  );
  await assert.rejects(
    () => requestCopy(brief, planOutputs(brief, photos, logos), "", undefined),
    /versions differ/,
  );
});

test("shortening an optional caption body preserves an identical title and the complete URL", () => {
  const b = {
    ...brief,
    title: "T".repeat(80),
    description: "T".repeat(80),
    location: "L".repeat(100),
    url: "https://example.com/" + "p".repeat(140),
  };
  const output = {
    id: "chat",
    format: "google_chat",
    language: "en",
    variant: 1,
  };
  const copy = templateCopy(b, output);
  assert.ok(copy.caption.startsWith(`*${b.title}*`));
  assert.ok(copy.caption.includes(b.url));
  assert.ok(copy.caption.length <= 450);
  assert.equal(b.description.length, 80);
});
