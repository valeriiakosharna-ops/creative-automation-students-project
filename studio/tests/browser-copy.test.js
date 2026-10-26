import test from "node:test";
import assert from "node:assert/strict";
import {
  browserCopy,
  browserStoryboard,
  browserPostCopy,
} from "../src/browser-copy.js";
import { generateAIVisual } from "../src/ai-visual.js";
import { openaiRequest, structuredRequest } from "../src/openai.js";
import { requestCopy } from "../src/copy.js";
import { BRAND_POLICY } from "../src/brand.js";
const brief = {
  title: "Creative Lab",
  description: "Learn Java",
  date: "2026-11-21",
  timeZone: "Europe/Kyiv",
  formats: ["google_chat"],
  languages: ["en"],
  variants: 1,
  colors: ["#00a6eb", "#e60036", "#302a40"],
};
const outputs = [
  {
    id: "google_chat-en-1",
    format: "google_chat",
    language: "en",
    variant: 1,
    postId: "google_chat-en",
    width: 1200,
    height: 675,
    photoId: "private-photo-id",
    logoIds: ["private-logo-id"],
    referencePlanVersion: "reference-frame-planner-v1",
    plannedPhotoId: "private-photo-id", plannedLogoIds: ["private-logo-id"],
  },
];
const visual = {
  id: outputs[0].id,
  headline: "Creative Lab",
  subheading: "Learn Java",
  cta: "",
  visualPlan: {
    role: "opening",
    layout: "split-right",
    direction: "Clear event hook with original logos.",
  },
};
const storyboard = { campaignStyle: "Contemporary editorial, shared cyan/red identity", posts: [{ id: "google_chat-en", visuals: [visual] }] };
const copy = {
  posts: [{ id: "google_chat-en", caption: "Creative Lab." }],
};
const response = (data) =>
  Response.json({
    choices: [
      { finish_reason: "stop", message: { content: JSON.stringify(data?.posts?.[0]?.visuals ? { campaignStyle: storyboard.campaignStyle, ...data } : data) } },
    ],
  });

test("planner and copy are separate concurrent requests with shared campaign direction and advisory writing targets", async (t) => {
  const pending = [];
  t.mock.method(
    globalThis,
    "fetch",
    (url, options) =>
      new Promise((resolve) => {
        assert.equal(url, "https://api.openai.com/v1/chat/completions");
        assert.equal(options.headers.Authorization, "Bearer visit-test-key");
        assert.equal(options.credentials, "omit");
        assert.equal(options.redirect, "error");
        assert.equal(options.referrerPolicy, "no-referrer");
        assert.ok(
          !options.body.includes("private-photo-id") &&
            !options.body.includes("private-logo-id") &&
            !options.body.includes("visit-test-key"),
        );
        const body = JSON.parse(options.body);
        assert.equal(body.store, false);
        assert.ok(!body.messages[0].content.includes("minimumTextContrast"));
        assert.ok(!body.messages[0].content.includes("logo shelf;"));
        const payload = JSON.parse(body.messages[1].content);
        if (body.response_format.json_schema.name === "visual_storyboard") {
          assert.match(body.messages[0].content, /coherent visual campaign/);
          assert.match(payload.outputs[0].visualStyle, /internal announcement/);
          assert.equal(payload.outputs[0].photoAvailable, true);
          assert.equal(payload.outputs[0].maximumCharacters, undefined);
          assert.match(body.messages[0].content, /#00a6eb/);
          pending.push(() => resolve(response(storyboard)));
        } else {
          assert.equal(body.response_format.json_schema.name, "social_posts");
          assert.match(body.messages[0].content, /ONE polished post caption/);
          assert.equal(payload.posts[0].captionGuidance.recommendedMax, 600);
          assert.equal(payload.posts[0].maximumCharacters, undefined);
          pending.push(() => resolve(response(copy)));
        }
      }),
  );
  const task = browserCopy(brief, outputs, "visit-test-key");
  assert.equal(
    pending.length,
    2,
    "both requests must start before either response is ready",
  );
  pending.forEach((resolve) => resolve());
  const result = await task;
  assert.equal(result.outputs[0].caption, copy.posts[0].caption);
  assert.deepEqual(result.outputs[0].visualPlan, visual.visualPlan);
});

test("imperfect optional fields and response IDs retain plans without overriding original sources", async (t) => {
  let payload;
  t.mock.method(globalThis, "fetch", async () => response(payload));
  for (payload of [null, { posts: [null] },
    { posts: [{ ...storyboard.posts[0], visuals: [null] }] },
    { posts: [{ ...storyboard.posts[0], visuals: [{ ...visual, id: "foreign", photoId: "foreign", approved: true }] }] },
    { posts: [{ ...storyboard.posts[0], visuals: [{ ...visual, visualPlan: { layout: null } }] }] }]) {
    const [post] = await browserStoryboard(brief, outputs, "test-key");
    assert.equal(post.id, "google_chat-en");
    assert.equal(post.visuals[0].id, outputs[0].id);
    assert.equal(post.visuals[0].photoId, undefined);
    assert.equal(post.visuals[0].approved, undefined);
    assert.equal(post.visuals[0].cta, "");
  }
  const second = { ...outputs[0], id: "google_chat-en-2", variant: 2 };
  payload = { posts: [{ ...storyboard.posts[0], visuals: [visual, visual] }] };
  const [post] = await browserStoryboard(brief, [...outputs, second], "test-key");
  assert.equal(post.visuals[0].headline, visual.headline);
  assert.equal(post.visuals[1].headline, "", "a duplicated frame cannot replace a different frame");
});

test("a missing caption never discards another completed post", async (t) => {
  const second = { ...outputs[0], id: "google_chat-uk-1", language: "uk", postId: "google_chat-uk" };
  t.mock.method(globalThis, "fetch", async () => response(copy));
  const posts = await browserPostCopy(brief, [...outputs, second], "test-key");
  assert.equal(posts[0].caption, copy.posts[0].caption);
  assert.equal(posts[0].status, "completed");
  assert.equal(posts[1].status, "failed");
  assert.match(posts[1].error, /Other results are kept/);
});

test("paid responses are recorded before parsing, including truncated and fenced JSON, with no saved key or retry", async (t) => {
  let raw = "```json\n" + JSON.stringify(copy) + "\n```";
  let calls = 0; const saved = [];
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ choices: [{ finish_reason: "length", message: { content: raw } }] });
  });
  const record = (data) => { saved.push(data); };
  const posts = await browserPostCopy(brief, outputs, "test-key", undefined, undefined, record);
  assert.equal(posts[0].caption, copy.posts[0].caption);
  assert.equal(saved[0].finishReason, "length");
  raw = '{"unfinished": "test-key';
  const result = await structuredRequest("test", "prompt", {}, {}, "test-key", undefined, [], record);
  assert.equal(result.rawText, raw);
  assert.ok(!saved[1].text.includes("test-key"));
  assert.equal(calls, 2);
});

test("HTTP diagnostics report only safe codes and parameter names", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: {
    message: "PRIVATE event text test-key", code: "unsupported_parameter", param: "text.format",
  } }, { status: 400 }));
  await assert.rejects(openaiRequest("responses", {}, "test-key"), (error) =>
    error.message.includes("HTTP 400") && error.message.includes("text.format") &&
    !error.message.includes("PRIVATE") && !error.message.includes("test-key"));
});

test("provider response order cannot change carousel frame order", async (t) => {
  const second = { ...outputs[0], id: "google_chat-en-2", variant: 2 };
  t.mock.method(globalThis, "fetch", async () =>
    response({
      posts: [
        {
          id: "google_chat-en",
          visuals: [{ ...visual, id: second.id }, visual],
        },
      ],
    }),
  );
  const result = await browserStoryboard(
    brief,
    [...outputs, second],
    "test-key",
  );
  assert.deepEqual(
    result[0].visuals.map((frame) => frame.id),
    [visual.id, second.id],
  );
});

test("captions above the writing target remain complete and ready for approval", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    response({ posts: [{ id: "google_chat-en", caption: "x".repeat(601) }] }),
  );
  const [post] = await browserPostCopy(brief, outputs, "test-key");
  assert.equal(post.caption.length, 601);
  assert.equal(post.status, "completed");
  assert.equal(post.error, undefined);
});

test("errors never echo provider content or keys, and requests do not silently retry", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return new Response("SENSITIVE PROVIDER RESPONSE", { status: 403 });
  });
  await assert.rejects(
    openaiRequest("images/edits", new FormData(), "test-key"),
    (error) =>
      error.message.includes("HTTP 403") &&
      error.message.includes("organization verification") &&
      !error.message.includes("SENSITIVE") &&
      !error.message.includes("test-key"),
  );
  assert.equal(requests, 1);
  await assert.rejects(
    openaiRequest("https://foreign.example", {}, "test-key"),
    /Unsupported OpenAI endpoint/,
  );
  assert.equal(requests, 1);
});

test("image edits receive the planner, only the assigned photo, all original logos and revision feedback", async (t) => {
  const logos = [
      {
        id: "private-logo-id",
        blob: new Blob(["ORIGINAL LOGO"], { type: "image/png" }),
      },
    ],
    photos = [
      {
        id: "private-photo-id",
        blob: new Blob(["ASSIGNED PHOTO"], { type: "image/jpeg" }),
      },
      {
        id: "unused",
        blob: new Blob(["MUST NOT UPLOAD"], { type: "image/png" }),
      },
    ];
  let withPhoto = true;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/images/edits");
    assert.equal(options.headers.Authorization, "Bearer test-key");
    assert.equal(
      options.headers["Content-Type"],
      undefined,
      "browser sets multipart boundary",
    );
    const body = options.body,
      refs = body.getAll("image[]");
    assert.equal(body.get("model"), "gpt-image-2.5-flare");
    assert.equal(body.get("n"), "1");
    assert.equal(body.get("input_fidelity"), null);
    assert.equal(refs.length, withPhoto ? 2 : 1);
    assert.equal(await refs.at(-1).text(), "ORIGINAL LOGO");
    if (withPhoto) {
      assert.equal(await refs[0].text(), "ASSIGNED PHOTO");
      assert.ok(!(await Promise.all(refs.map((ref) => ref.text()))).includes("PREVIOUS VISUAL"));
    }
    const prompt = body.get("prompt");
    assert.ok(!prompt.includes("test-key"));
    assert.match(prompt, /#00a6eb/);
    assert.match(prompt, /internal announcement/);
    assert.match(prompt, /Clear event hook/);
    const input = JSON.parse(prompt.split("DATA:\n")[1]);
    assert.equal(input.brandPolicy, undefined);
    assert.equal(input.artworkRegion, undefined);
    assert.equal(input.logoShelf, undefined);
    assert.equal(input.campaignStyle, storyboard.campaignStyle);
    assert.equal(body.get("quality"), "high");
    assert.equal(body.get("background"), "opaque");
    assert.match(input.backgroundPreference, /light/);
    assert.equal(input.frame.cta, "");
    assert.equal(input.callToAction, false);
    assert.match(input.peoplePolicy, withPhoto ? /Only preserve people/ : /No people/);
    if (withPhoto) assert.match(prompt, /Make the heading larger/);
    // Do not silently accept a URL or invalid image as a generated visual.
    return Response.json({
      data: [{ url: "https://untrusted.example/image" }],
    });
  });
  await assert.rejects(
    generateAIVisual(
      brief,
      { ...outputs[0], ...visual },
      { ...storyboard.posts[0], campaignStyle: storyboard.campaignStyle },
      { logos, photos },
      "test-key",
      undefined,
      {
        previousImage: new Blob(["PREVIOUS VISUAL"], { type: "image/png" }),
        feedback: "Make the heading larger",
      },
    ),
    /invalid image content/,
  );
  withPhoto = false;
  await assert.rejects(
    generateAIVisual(
      brief,
      { ...outputs[0], ...visual, photoId: null, plannedPhotoId: null },
      { ...storyboard.posts[0], campaignStyle: storyboard.campaignStyle },
      { logos, photos },
      "test-key",
    ),
    /invalid image content/,
  );
});

test("Pages copy compatibility refuses custom proxy URLs before transmitting a key", async (t) => {
  globalThis.window = { STUDIO_RUNTIME: { pages: true } };
  t.after(() => delete globalThis.window);
  await assert.rejects(
    requestCopy(
      brief,
      outputs,
      "https://untrusted.example",
      undefined,
      "test-key",
    ),
    /proxy URLs are disabled/,
  );
});

test("planner JSON cannot override photo allocation, original logos or review state", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    response({
      posts: [
        {
          id: "google_chat-en",
          visuals: [
            {
              ...visual,
              photoId: "unassigned-photo",
              logoIds: [],
              approved: true,
              caption: "unrequested",
              visualPlan: { ...visual.visualPlan, reference: "unexpected" },
            },
          ],
        },
      ],
    }),
  );
  const [post] = await browserStoryboard(brief, outputs, "test-key");
  assert.deepEqual(post.visuals[0], visual);
});
