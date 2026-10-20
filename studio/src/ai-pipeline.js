import {
  browserStoryboard,
  browserPostCopy,
  postRequirements,
  PROMPT_VERSIONS,
} from "./browser-copy.js";
import { generateAIVisual, VISUAL_PROMPT_VERSION } from "./ai-visual.js";
import { planVisualFrame, FRAME_PLANNER_VERSION } from "./frame-planner.js";
import { MODELS } from "./prompts/channel-styles.js";
import { researchCaptions, RESEARCH_PROMPT_VERSION } from "./caption-research.js";

export function refreshAIStatus(run) {
  for (const output of run.outputs) {
    const post = run.posts.find((item) => item.id === output.postId);
    output.caption = post?.caption || "";
    delete output.captionError;
    output.status =
      output.image && !output.imageError
        ? "completed"
        : output.imageError
          ? "failed"
          : "pending";
    output.error = output.imageError || "";
  }
  const all =
    run.outputs.every((output) => output.status === "completed") &&
    run.posts.every((post) => post.status === "completed");
  const any =
    run.outputs.some((output) => output.image) ||
    run.posts.some((post) => post.status === "completed");
  run.status = all ? "completed" : any ? "partial" : "failed";
}
// Recover previously saved packs rejected solely by the retired caption budgets.
// Actual API/image errors, cancellation and all approvals stay intact.
export function recoverCaptionBudgets(run) {
  if (!run.reviewRequired || !run.posts?.length || ["running", "cancelled", "interrupted"].includes(run.status)) return false;
  let changed = false;
  for (const post of run.posts) {
    if (post.status === "failed" && post.caption?.trim() &&
      /caption has \d+ characters; limit \d+/.test(post.error || "")) {
      post.status = "completed";
      delete post.error;
      changed = true;
    }
  }
  if (changed) {
    if (/caption has \d+ characters; limit \d+/.test(run.error || "")) delete run.error;
    refreshAIStatus(run);
  }
  return changed;
}
export function reviewReady(run) {
  return (
    run.status === "completed" &&
    run.outputs.length > 0 &&
    run.outputs.every(
      (output) =>
        output.status === "completed" &&
        output.image &&
        output.approved &&
        !output.feedback?.trim(),
    ) &&
    run.posts?.length > 0 &&
    run.posts.every(
      (post) =>
        post.status === "completed" &&
        post.approved &&
        post.draftCaption === undefined,
    )
  );
}
export async function generatePagesRun(
  run,
  key,
  signal,
  onChange = async () => {},
) {
  run.reviewRequired = true;
  run.pipeline = {
    version: "openai-reference-v3",
    prompts: { ...PROMPT_VERSIONS, visual: VISUAL_PROMPT_VERSION, research: RESEARCH_PROMPT_VERSION, framePlanner: FRAME_PLANNER_VERSION },
    planner: { status: "running" },
    copy: { status: "running" },
  };
  run.promptVersion = "studio-ai-v6";
  run.model = MODELS.text;
  run.imageModel = MODELS.image;
  run.posts = postRequirements(run.outputs).map(({ id, format, language }) => ({
    id,
    format,
    language,
    caption: "",
    status: "pending",
    approved: false,
  }));
  let queue = Promise.resolve();
  const publish = () =>
    (queue = queue.then(() => {
      refreshAIStatus(run);
      run.status = "running";
      return onChange(run);
    }));
  const copyTask = (async () => {
    try {
      run.captionResearch = await researchCaptions(run.brief.formats, key, signal);
      await publish();
      const posts = await browserPostCopy(run.brief, run.outputs, key, signal, run.captionResearch);
      for (const post of posts)
        Object.assign(
          run.posts.find((item) => item.id === post.id),
          post,
          { generatedCaption: post.caption },
        );
      run.pipeline.copy.status = "completed";
    } catch (error) {
      run.pipeline.copy = {
        status: signal.aborted ? "cancelled" : "failed",
        error: signal.aborted ? "Generation cancelled." : error.message,
      };
      for (const post of run.posts)
        Object.assign(post, {
          status: "failed",
          error: run.pipeline.copy.error,
        });
    }
    await publish();
  })();
  const visualTask = (async () => {
    try {
      run.storyboard = await browserStoryboard(
        run.brief,
        run.outputs,
        key,
        signal,
      );
      run.pipeline.planner.status = "completed";
      for (const post of run.storyboard)
        for (const frame of post.visuals)
          Object.assign(
            run.outputs.find((output) => output.id === frame.id),
            frame,
          );
      await publish();
      let next = 0;
      const worker = async () => {
        while (next < run.outputs.length && !signal.aborted) {
          const output = run.outputs[next++];
          output.imageStatus = "planning";
          await publish();
          try {
            Object.assign(output, await planVisualFrame(
              run.brief, output, run.storyboard.find((post) => post.id === output.postId),
              run.assets, key, signal,
            ));
            output.imageStatus = "running";
            await publish();
            const rendered = await generateAIVisual(
              run.brief,
              output,
              run.storyboard.find((post) => post.id === output.postId),
              run.assets,
              key,
              signal,
            );
            if (signal.aborted)
              throw signal.reason || new Error("Generation cancelled.");
            Object.assign(output, {
              image: rendered.blob,
              style: rendered.style,
              imageModel: rendered.imageModel,
              imageSource: rendered.imageSource,
              visualPromptVersion: rendered.visualPromptVersion,
              imageStatus: "completed",
              approved: false,
            });
          } catch (error) {
            output.imageError = signal.aborted
              ? "Generation cancelled."
              : error.message;
            output.imageStatus = signal.aborted ? "cancelled" : "failed";
          }
          await publish();
        }
      };
      await Promise.all([worker(), worker()]);
    } catch (error) {
      run.pipeline.planner = {
        status: signal.aborted ? "cancelled" : "failed",
        error: signal.aborted ? "Generation cancelled." : error.message,
      };
      for (const output of run.outputs)
        if (!output.image) {
          output.imageError = run.pipeline.planner.error;
          output.imageStatus = "failed";
        }
      await publish();
    }
  })();
  await Promise.all([copyTask, visualTask]);
  await queue;
  refreshAIStatus(run);
  run.error = [run.pipeline.planner.error, run.pipeline.copy.error]
    .filter(Boolean)
    .join(" ");
  if (signal.aborted) {
    run.status = "cancelled";
    for (const output of run.outputs)
      if (!output.image) {
        output.status = "cancelled";
        output.error ||= "Generation cancelled.";
      }
  }
}
