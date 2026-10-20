import { zipSync, strToU8 } from "fflate";
import { slug } from "./planner.js";
export async function buildArchive(run) {
  const files = {},
    manifest = {
      version: 1,
      runId: run.id,
      projectId: run.projectId,
      derivedFromRunId: run.derivedFromRunId || null,
      createdAt: run.createdAt,
      status: run.status,
      mode: run.mode,
      model: run.model || null,
      promptVersion: run.promptVersion,
      styleGuideVersion: run.styleGuideVersion || null,
      brief: run.brief,
      assets: {
        logos: run.assets.logos.map(({ id, name }) => ({ id, name })),
        photos: run.assets.photos.map(({ id, name }) => ({ id, name })),
      },
      outputs: [],
    };
  for (const o of run.outputs) {
    const folder = `${o.format}/${o.language}/variant-${String(o.variant).padStart(2, "0")}`;
    const { image, ...metadata } = o;
    const delivered = o.status === "completed" && image;
    manifest.outputs.push({
      ...metadata,
      imageFile: delivered ? `${folder}.png` : null,
      captionFile: delivered ? `${folder}.txt` : null,
    });
    if (delivered) {
      files[`${folder}.png`] = new Uint8Array(await image.arrayBuffer());
      files[`${folder}.txt`] = strToU8(o.caption);
    }
  }
  if (!Object.keys(files).length)
    throw Error("This run has no completed outputs to export.");
  const posts = [
    ...new Set(
      run.outputs
        .filter((output) => output.postId)
        .map((output) => output.postId),
    ),
  ].map((id) => {
    const visuals = run.outputs.filter((output) => output.postId === id);
    const post = {
      id,
      format: visuals[0].format,
      language: visuals[0].language,
      caption: visuals[0].caption,
      visuals: visuals.map(
        ({ id, variant, visualPlan, status, photoId, logoIds }) => ({
          id,
          position: variant,
          visualPlan,
          status,
          photoId,
          logoIds,
        }),
      ),
    };
    files[`${post.format}/${post.language}/post.txt`] = strToU8(
      post.caption || "",
    );
    return post;
  });
  if (posts.length)
    files["storyboard.json"] = strToU8(
      JSON.stringify({ version: 1, posts }, null, 2),
    );
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  files["brief.json"] = strToU8(JSON.stringify(run.brief, null, 2));
  if (run.styleGuideSnapshot)
    files["style-guide.json"] = strToU8(
      JSON.stringify(run.styleGuideSnapshot, null, 2),
    );
  files["README.txt"] = strToU8(
    "Creative Automation Studio\nFrames are ordered by their numeric filenames. post.txt is the shared post caption; storyboard.json records the visual plan. Per-frame text files repeat the shared caption for compatibility. Review before publishing; a partial carousel may be incomplete.\nmanifest.json records inputs, photo assignments, all logo IDs, generation mode and failures. Original uploads are not included. Failed/cancelled outputs are omitted from content folders.\n",
  );
  return {
    blob: new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }),
    name: `${slug(run.brief.title)}-${run.id.slice(0, 8)}.zip`,
  };
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
