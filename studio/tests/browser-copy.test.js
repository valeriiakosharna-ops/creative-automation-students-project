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
const valid = {
  outputs: [
    {
      id: outputs[0].id,
      headline: "Creative Lab",
      subheading: "Learn Java",
      cta: "Join us",
      caption: "Join Creative Lab.",
    },
  ],
};
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
    assert.ok(body.messages[0].content.includes(JSON.stringify(BRAND_POLICY)));
    return Response.json({
      choices: [
        { finish_reason: "stop", message: { content: JSON.stringify(valid) } },
      ],
    });
  });
  const result = await browserCopy(brief, outputs, "test-visit-key");
  assert.deepEqual(result.outputs, valid.outputs);
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
              outputs: [{ ...valid.outputs[0], id: "foreign-output" }],
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
