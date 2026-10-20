import test from "node:test";
import assert from "node:assert/strict";
import { reviewReady } from "../src/ai-pipeline.js";
import { buildArchive } from "../src/archive.js";
import { unzipSync, strFromU8 } from "fflate";
const makeRun = () => ({
  id: "run-1",
  projectId: "project-1",
  createdAt: "2026-10-20T16:00:00Z",
  brief: { title: "Creative Lab" },
  mode: "ai",
  status: "completed",
  reviewRequired: true,
  assets: { logos: [], photos: [] },
  posts: [
    {
      id: "instagram_post-en",
      format: "instagram_post",
      language: "en",
      caption: "Reviewed post.",
      approved: true,
      status: "completed",
    },
  ],
  outputs: [
    {
      id: "instagram_post-en-1",
      postId: "instagram_post-en",
      format: "instagram_post",
      language: "en",
      variant: 1,
      status: "completed",
      approved: true,
      image: new Blob(["PNG"]),
      caption: "Reviewed post.",
    },
  ],
});
test("ZIP requires approval of every requested visual and post, even if generation is complete", async () => {
  const run = makeRun();
  assert.equal(reviewReady(run), true);
  for (const target of [run.outputs[0], run.posts[0]]) {
    target.approved = false;
    assert.equal(reviewReady(run), false);
    await assert.rejects(buildArchive(run), /Approve every/);
    target.approved = true;
  }
  run.status = "running";
  assert.equal(reviewReady(run), false);
});
test("approved AI pack has ordered images and one text file per post plus the combined set", async () => {
  const run = makeRun(),
    { blob } = await buildArchive(run),
    files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  assert.ok(files["instagram_post/en/frame-01.png"]);
  assert.equal(
    strFromU8(files["instagram_post/en/post.txt"]),
    "Reviewed post.",
  );
  assert.match(strFromU8(files["posts.txt"]), /Reviewed post/);
  assert.equal(
    Object.keys(files).filter((name) => /frame.*\.txt$/.test(name)).length,
    0,
  );
  assert.equal(
    JSON.parse(strFromU8(files["manifest.json"])).posts[0].approved,
    true,
  );
});

test("pending feedback and draft captions block export even if an old approval flag is present", async () => {
  const run = makeRun();
  run.outputs[0].feedback = "Use more cyan";
  assert.equal(reviewReady(run), false);
  await assert.rejects(buildArchive(run), /Approve every/);
  delete run.outputs[0].feedback;
  run.posts[0].draftCaption = "An unfinished edit";
  assert.equal(reviewReady(run), false);
  await assert.rejects(buildArchive(run), /Approve every/);
});

test("retired caption budgets are recovered from history without an API call or changing approvals", async () => {
  const { recoverCaptionBudgets } = await import("../src/ai-pipeline.js");
  const run = makeRun();
  run.status = "failed";
  Object.assign(run.posts[0], { caption: "x".repeat(651), status: "failed", approved: false,
    error: "Instagram post · en: caption has 651 characters; limit 650. Edit this post without another AI request." });
  Object.assign(run.outputs[0], { status: "failed", error: run.posts[0].error, captionError: run.posts[0].error });
  assert.equal(recoverCaptionBudgets(run), true);
  assert.equal(run.status, "completed");
  assert.equal(run.posts[0].caption.length, 651);
  assert.equal(run.posts[0].approved, false);
  assert.equal(run.outputs[0].status, "completed");
  assert.equal(run.outputs[0].error, "");
  assert.equal(recoverCaptionBudgets(run), false);
});

test("a real caption API error never turns an available image into a failed visual", async () => {
  const { refreshAIStatus, recoverCaptionBudgets } = await import("../src/ai-pipeline.js");
  const run = makeRun();
  Object.assign(run.posts[0], { caption: "", status: "failed", error: "OpenAI rejected the request (HTTP 403).", approved: false });
  refreshAIStatus(run);
  assert.equal(run.outputs[0].status, "completed");
  assert.equal(run.outputs[0].error, "");
  assert.equal(run.status, "partial");
  assert.equal(reviewReady(run), false);
  assert.equal(recoverCaptionBudgets(run), false);
});
