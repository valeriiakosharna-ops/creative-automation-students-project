import test from "node:test";
import assert from "node:assert/strict";
import { browserCopy } from "../src/browser-copy.js";
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
};
const outputs = [
  {
    id: "google_chat-en-1",
    format: "google_chat",
    language: "en",
    variant: 1,
    photoId: "private-photo-id",
    logoIds: ["private-logo-id"],
  },
];
const visual = {
  id: outputs[0].id,
  headline: "Creative Lab",
  subheading: "Learn Java",
  cta: "Join us",
  visualPlan: {
    role: "opening",
    layout: "split-right",
    direction: "Clear event hook with original logos.",
  },
};
const valid = {
  posts: [
    { id: "google_chat-en", caption: "Join Creative Lab.", visuals: [visual] },
  ],
};
const flattened = [
  { ...visual, postId: "google_chat-en", caption: valid.posts[0].caption },
];

test("Pages AI sends a visit key only to fixed OpenAI with brand instructions and no image data", async (t) => {
  let count = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    count++;
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-visit-key");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.equal(options.referrerPolicy, "no-referrer");
    assert.equal(options.cache, "no-store");
    assert.ok(
      !options.body.includes("test-visit-key") &&
        !options.body.includes("private-photo-id") &&
        !options.body.includes("private-logo-id"),
    );
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    const payload = JSON.parse(
      body.messages.find((message) => message.role === "user").content,
    );
    assert.equal(payload.outputs[0].maximumCharacters.caption, 450);
    assert.equal(
      payload.outputs[0].maximumCharacters.subheading,
      BRAND_POLICY.formats.google_chat.subheading.maxCharacters,
    );
    assert.equal(payload.outputs[0].photoAvailable, true);
    assert.equal(payload.outputs[0].logoCount, 1);
    assert.equal(
      body.messages.filter((message) => message.role === "developer").length,
      2,
    );
    assert.match(body.messages[1].content, /ONE carousel/);
    assert.match(body.messages[2].content, /ONE shared caption/);
    assert.ok(body.messages[0].content.includes(JSON.stringify(BRAND_POLICY)));
    return Response.json({
      choices: [
        { finish_reason: "stop", message: { content: JSON.stringify(valid) } },
      ],
    });
  });
  const result = await browserCopy(brief, outputs, "test-visit-key");
  assert.deepEqual(result.outputs, flattened);
  assert.equal(count, 1);
});
test("Pages uses common response validation and rejects unknown outputs or proxy URLs", async (t) => {
  globalThis.window = { STUDIO_RUNTIME: { pages: true } };
  t.after(() => delete globalThis.window);
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              posts: [
                {
                  ...valid.posts[0],
                  visuals: [{ ...visual, id: "foreign-output" }],
                },
              ],
            }),
          },
        },
      ],
    }),
  );
  await assert.rejects(
    requestCopy(brief, outputs, "", undefined, "test-key"),
    /does not match/,
  );
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
test("provider errors and malformed responses do not echo bodies, keys or silently retry", async (t) => {
  let count = 0;
  t.mock.method(globalThis, "fetch", async () => {
    count++;
    return new Response("SECRET PROVIDER RESPONSE", { status: 401 });
  });
  await assert.rejects(
    browserCopy(brief, outputs, "test-key"),
    (error) =>
      error.message.includes("HTTP 401") &&
      !error.message.includes("SECRET") &&
      !error.message.includes("test-key"),
  );
  assert.equal(count, 1);
});

test("overlong copy marks only affected outputs and keeps valid storyboard frames", async (t) => {
  globalThis.window = { STUDIO_RUNTIME: { pages: true } };
  t.after(() => delete globalThis.window);
  const second = { ...outputs[0], id: "google_chat-en-2", variant: 2 };
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              posts: [
                {
                  ...valid.posts[0],
                  visuals: [
                    visual,
                    {
                      ...visual,
                      id: second.id,
                      subheading: "x".repeat(500),
                      visualPlan: {
                        role: "closing",
                        layout: "poster",
                        direction: "Closing next step",
                      },
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    }),
  );
  const result = await requestCopy(
    brief,
    [...outputs, second],
    "",
    undefined,
    "test-key",
  );
  assert.equal(result.outputs[0].error, undefined);
  assert.match(result.outputs[1].error, /subheading has 500 characters; limit/);
  assert.equal(result.outputs[1].subheading.length, 500);
  assert.equal(result.outputs[0].caption, result.outputs[1].caption);
  assert.equal(result.outputs[1].visualPlan.role, "closing");
});

test("malformed storyboards are rejected as content errors, without retrying", async (t) => {
  let payload;
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(payload) },
        },
      ],
    }),
  );
  for (payload of [
    null,
    { posts: [null] },
    { posts: [{ ...valid.posts[0], visuals: [null] }] },
    {
      posts: [
        {
          ...valid.posts[0],
          visuals: [
            {
              ...visual,
              visualPlan: { ...visual.visualPlan, layout: "arbitrary-code" },
            },
          ],
        },
      ],
    },
  ]) {
    await assert.rejects(
      browserCopy(brief, outputs, "test-key"),
      /does not match this run/,
    );
  }
});
