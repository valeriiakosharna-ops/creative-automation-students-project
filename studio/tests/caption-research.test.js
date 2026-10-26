import test from "node:test";
import assert from "node:assert/strict";
import { researchCaptions, publicSource } from "../src/caption-research.js";
import { captionGuidance, characterCount } from "../src/caption-guidance.js";
const url = "https://buffer.com/resources/social-media-captions/";
const searchResult = (sourceUrls = [url]) => ({ status: "completed", output: [
  { type: "web_search_call", status: "completed", action: { type: "search", sources: [{ type: "url", url }] } },
  { type: "message", content: [{ type: "output_text", text: JSON.stringify({ channels: [{ format: "instagram_post", summary: "Readable event details, a relevant opening and one clear next step.", recommendedMin: 200, recommendedMax: 950, sourceUrls }] }), annotations: [{ type: "url_citation", url, title: "Writing guidance" }] }] },
] });

test("live research sends only public format/date context, bounds search cost and passes verified evidence to writing guidance", async (t) => {
  t.mock.method(globalThis, "fetch", async (endpoint, options) => {
    assert.equal(endpoint, "https://api.openai.com/v1/responses");
    assert.equal(options.headers.Authorization, "Bearer test-key");
    assert.equal(options.credentials, "omit");
    const body = JSON.parse(options.body), input = JSON.parse(body.input);
    assert.deepEqual(Object.keys(input).sort(), ["checkedOn", "formats"]);
    assert.deepEqual(input.formats, ["instagram_post"]);
    assert.equal(body.max_tool_calls, 1);
    assert.equal(body.store, false);
    assert.equal(body.tools[0].type, "web_search");
    assert.equal(body.text, undefined);
    assert.ok(!options.body.includes("test-key"));
    return Response.json(searchResult());
  });
  const research = await researchCaptions(["instagram_post", "private-event-text"], "test-key");
  assert.equal(research.status, "available");
  assert.equal(research.sources[0].url, url);
  assert.equal(captionGuidance("instagram_post", research).recommendedMax, 950);
  assert.equal(captionGuidance("facebook", research).recommendedMax, 1000);
  assert.equal(characterCount("A🙂Б"), 3);
});

test("fabricated citations, hostile URLs and missing search evidence cannot masquerade as live trends", async (t) => {
  let result = searchResult(["https://buffer.com/resources/not-returned-by-search/"]);
  t.mock.method(globalThis, "fetch", async () => Response.json(result));
  assert.equal((await researchCaptions(["instagram_post"], "test-key")).status, "unavailable");
  result = { ...searchResult(), output: searchResult().output.filter((item) => item.type !== "web_search_call") };
  assert.equal((await researchCaptions(["instagram_post"], "test-key")).status, "unavailable");
  for (const source of ["javascript:alert(1)", "https://buffer.com.evil.example/", "https://name:password@buffer.com/"])
    assert.equal(publicSource(source), null);
});

test("research failures fall back without retries, provider details or blocking normal generation", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => { requests++; return new Response("PRIVATE PROVIDER DETAIL", { status: 403 }); });
  const result = await researchCaptions(["instagram_post"], "test-key");
  assert.equal(result.status, "unavailable");
  assert.deepEqual(result.sources, []);
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  assert.equal(requests, 1);
});
