import { translate, confirmTranslated, interfaceLanguage } from "./i18n.js";
import { captionGuidance, characterCount } from "./caption-guidance.js";
import { copyError, copyLimits } from "./copy-limits.js";
import { BRAND_POLICY, snapshotPolicy } from "./brand.js";
import { session, privateFetch, jsonResponse } from "./private-api.js";
import "./style.css";
import {
  FORMATS,
  LANGUAGES,
  validateBrief,
  planOutputs,
  quantityFor,
} from "./planner.js";
import { templateCopy, requestCopy, PROMPT_VERSION } from "./copy.js";
import { postRequirements } from "./browser-copy.js";
import {
  generatePagesRun,
  refreshAIStatus,
  reviewReady,
  recoverCaptionBudgets,
} from "./ai-pipeline.js";
import { planVisualFrame, hasReferencePlan } from "./frame-planner.js";
import { generateAIVisual } from "./ai-visual.js";
import { renderVisual, decodeImage } from "./renderer.js";
import { all, get, put, runsFor, deleteProject } from "./storage.js";
import { buildArchive, download } from "./archive.js";

document.querySelectorAll("[data-style-version]").forEach((node) => {
  node.textContent = BRAND_POLICY.version;
});
const $ = (selector) => document.querySelector(selector);
const form = $("#campaign-form");
const runtime = window.STUDIO_RUNTIME || {};
const browserKeyMode =
  runtime.pages || (runtime.serverManaged && runtime.clientKeysEnabled);
let requestApiKey = "";
const state = {
  projects: [],
  projectId: null,
  assets: { logos: [], photos: [] },
  run: null,
  busy: false,
  cancelled: false,
  controller: null,
  projectAction: "create",
  backend: "",
  previewToken: 0,
};
const assetUrls = [],
  outputUrls = [];
let previewUrl, dialogUrl, saveTimer, previewTimer;
const memoryRuns = new Map();
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function notice(message, error = false) {
  const box = $("#notice");
  box.textContent = message;
  box.hidden = !message;
  box.classList.toggle("is-error", error);
}
function handleError(error) {
  console.error(error.name || "Studio error");
  notice(error.message || "Something went wrong. Please try again.", true);
}
function revoke(urls) {
  urls.splice(0).forEach((url) => URL.revokeObjectURL(url));
}
function readBrief() {
  const data = {
      get: (name) => form.elements.namedItem(name)?.value,
      getAll: (name) =>
        Array.from(
          form.querySelectorAll(`[name="${name}"]:checked`),
          (input) => input.value,
        ),
    },
    b = {};
  for (const name of [
    "title",
    "description",
    "date",
    "dateMode",
    "endDate",
    "dateText",
    "time",
    "timeZone",
    "location",
    "url",
    "direction",
    "sourceLanguage",
    "titleEn",
    "titleUk",
    "descriptionEn",
    "descriptionUk",
  ])
    b[name] = String(data.get(name) || "").trim();
  b.formats = data.getAll("formats");
  b.languages = data.getAll("languages");
  b.variants = Number(data.get("variants"));
  b.quantities = Object.fromEntries(
    Object.keys(FORMATS).map((format) => [
      format,
      Number(form.elements.namedItem(`quantity-${format}`).value),
    ]),
  );
  b.mode = data.get("mode");
  b.colors = [
    data.get("primaryColor"),
    data.get("accentColor"),
    data.get("inkColor"),
  ];
  return b;
}
function fillBrief(b) {
  form.reset();
  if (!b) {
    if (browserKeyMode || runtime.aiConfigured)
      $("#generation-mode").value = "ai";
    return;
  }
  for (const [key, value] of Object.entries(b)) {
    const input = form.elements.namedItem(key);
    if (input && typeof value === "string" && "value" in input)
      input.value = value;
  }
  for (const type of ["formats", "languages"])
    form.querySelectorAll(`[name="${type}"]`).forEach((input) => {
      input.checked = (b[type] || []).includes(input.value);
    });
  $("#variants").value = String(b.variants || 1);
  for (const format of Object.keys(FORMATS))
    $("#quantity-" + format).value = String(quantityFor(b, format) || 1);
  if (b.colors) {
    $("#primary-color").value = b.colors[0];
    $("#accent-color").value = b.colors[1];
    $("#ink-color").value = b.colors[2];
  }
}
async function saveDraft() {
  clearTimeout(saveTimer);
  if (state.projectId)
    await put("drafts", {
      projectId: state.projectId,
      brief: readBrief(),
      assets: state.assets,
    });
}
function edited() {
  updateSummary();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveDraft().catch(handleError), 400);
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => updatePreview().catch(handleError), 650);
}
async function renderSidebar() {
  const projectList = $("#project-list");
  projectList.replaceChildren();
  $("#project-count").textContent = state.projects.length;
  for (const project of state.projects) {
    const button = element(
      "button",
      `project-item ${project.id === state.projectId ? "active" : ""}`,
    );
    button.append(
      element("span", "folder-icon", "▱"),
      element("span", "", project.name),
    );
    button.type = "button";
    button.setAttribute("aria-pressed", String(project.id === state.projectId));
    button.addEventListener("click", () =>
      switchProject(project.id).catch(handleError),
    );
    projectList.append(button);
  }
  const history = $("#history-list");
  history.replaceChildren();
  const saved = await runsFor(state.projectId),
    merged = new Map(saved.map((r) => [r.id, r]));
  for (const run of memoryRuns.values())
    if (run.projectId === state.projectId) merged.set(run.id, run);
  const runs = [...merged.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  $("#history-count").textContent = runs.length;
  if (!runs.length)
    history.append(
      element("p", "sidebar-empty", "Your generation runs will live here."),
    );
  for (const run of runs) {
    const button = element(
      "button",
      `history-item ${state.run?.id === run.id ? "active" : ""}`,
    );
    button.type = "button";
    button.append(
      element("strong", "", run.brief.title),
      element(
        "small",
        "",
        `${new Date(run.createdAt).toLocaleString(interfaceLanguage() === "uk" ? "uk-UA" : "en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${run.status}`,
      ),
    );
    button.addEventListener("click", () => {
      if (runtime.corporate)
        get("runs", run.id)
          .then((full) => {
            if (full) showRun(full);
          })
          .catch(handleError);
      else showRun(run);
    });
    history.append(button);
  }
}
async function switchProject(id) {
  if (state.busy || state.uploading) {
    notice(
      "Finish uploads or cancel the current generation before switching projects.",
    );
    return;
  }
  await saveDraft();
  state.projectId = id;
  state.run = null;
  const draft = await get("drafts", id);
  state.assets = draft?.assets || { logos: [], photos: [] };
  fillBrief(draft?.brief);
  $("#current-project-name").textContent =
    state.projects.find((p) => p.id === id)?.name || "Project";
  showEditor();
  renderAssets();
  updateSummary();
  await renderSidebar();
  await updatePreview();
  setSidebar(false);
}
function showEditor() {
  $("#editor-view").hidden = false;
  $("#results-view").hidden = true;
  $("#form-errors").hidden = true;
}
function renderAssets() {
  revoke(assetUrls);
  for (const [type, target] of [
    ["logos", "#logo-list"],
    ["photos", "#photo-list"],
  ]) {
    const list = $(target);
    list.replaceChildren();
    state.assets[type].forEach((asset, index) => {
      const item = element("div", "asset-item"),
        url = URL.createObjectURL(asset.blob);
      assetUrls.push(url);
      const img = element("img");
      img.src = url;
      img.alt = "";
      const label = element("div", "asset-name");
      label.append(
        element("span", "", asset.name),
        element(
          "small",
          "",
          `${type === "photos" ? `${index + 1} / ` : ""}${(asset.blob.size / 1024).toFixed(0)} KB`,
        ),
      );
      const button = element("button", "remove-asset", "×");
      button.type = "button";
      button.setAttribute("aria-label", `Remove ${asset.name}`);
      button.disabled = state.busy;
      button.addEventListener("click", () => {
        state.assets[type] = state.assets[type].filter(
          (a) => a.id !== asset.id,
        );
        renderAssets();
        edited();
      });
      item.append(img, label, button);
      list.append(item);
    });
  }
}
async function importFiles(type, files) {
  if (state.busy) return;
  state.uploading = (state.uploading || 0) + 1;
  $("#generate-button").disabled = true;
  const limit = type === "logos" ? 8 : 20,
    errors = [];
  for (const file of files) {
    try {
      if (state.assets[type].length >= limit)
        throw Error(`You can add at most ${limit} ${type}.`);
      if (file.size > 10 * 1024 * 1024)
        throw Error(`${file.name}: exceeds 10 MB.`);
      if (
        [...state.assets.logos, ...state.assets.photos].reduce(
          (sum, a) => sum + a.blob.size,
          0,
        ) +
          file.size >
        100 * 1024 * 1024
      )
        throw Error("Uploads cannot exceed 100 MB in total.");
      const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      const png =
        bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71;
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const webp =
        String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
      if (!png && !jpeg && !webp)
        throw Error(
          `${file.name}: only genuine PNG, JPEG and WebP images are supported.`,
        );
      const image = await decodeImage(file);
      const pixels = image.width * image.height;
      image.close();
      if (pixels > 24000000)
        throw Error(`${file.name}: exceeds 24 megapixels.`);
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (state.assets[type].some((a) => a.hash === hash))
        throw Error(`${file.name}: this image is already in your ${type}.`);
      state.assets[type].push({
        id: crypto.randomUUID(),
        name: file.name,
        blob: file,
        hash,
      });
    } catch (error) {
      errors.push(error.message || `${file.name}: could not decode the image.`);
    }
  }
  renderAssets();
  edited();
  notice(
    errors.length
      ? errors.join(" ")
      : `${files.length} file${files.length === 1 ? "" : "s"} processed.`,
    !!errors.length,
  );
  state.uploading--;
  $("#generate-button").disabled = state.busy || state.uploading > 0;
}
$("#logo-upload").addEventListener("change", async (event) => {
  await importFiles("logos", Array.from(event.target.files));
  event.target.value = "";
});
$("#photo-upload").addEventListener("change", async (event) => {
  await importFiles("photos", Array.from(event.target.files));
  event.target.value = "";
});
function updateSummary() {
  const b = readBrief(),
    outputs = planOutputs(b, state.assets.photos, state.assets.logos);
  const customDate = ["list", "text"].includes(b.dateMode);
  $("#date-start-field").hidden = customDate;
  $("#date-end-field").hidden = b.dateMode !== "range";
  $("#date-text-field").hidden = !customDate;
  $("#date").required = !customDate;
  $("#date-end").required = b.dateMode === "range";
  $("#date-end").min = b.date;
  $("#date-text").required = customDate;
  for (const format of Object.keys(FORMATS)) {
    $("#quantity-" + format).disabled =
      state.busy || !b.formats.includes(format);
    $("#quantity-" + format)
      .closest(".quantity-item")
      .classList.toggle("is-inactive", !b.formats.includes(format));
  }
  $("#output-count").textContent = outputs.length;
  $("#format-count").textContent = b.formats.length;
  $("#language-count").textContent = b.languages.length
    ? b.languages.map((l) => (l === "uk" ? "UA" : "EN")).join(" + ")
    : "Choose below";
  $("#photo-count").textContent = outputs.filter((o) => o.photoId).length;
  $("#info-count").textContent = outputs.filter((o) => !o.photoId).length;
  for (const id of ["primary", "accent", "ink"])
    $(`#${id}-hex`).textContent = $(`#${id}-color`).value.toUpperCase();
  const ai = b.mode === "ai";
  $("#mode-indicator").lastChild.textContent = ai
    ? runtime.pages
      ? " AI visuals + posts"
      : " AI copy mode"
    : " Template mode";
  $("#mode-note").textContent = ai
    ? runtime.pages
      ? "AI plans a light, coherent campaign, checks each frame against its original logos and assigned photo, and writes shared posts without a CTA. Review every result before ZIP."
      : "AI creates channel-specific copy. This optional Java mode uses local template visuals."
    : "Template mode uses your supplied wording, with channel-specific structure. It does not translate descriptions. Add localized copy below, or connect AI for translation.";
  $("#ai-cost-note").hidden = !runtime.pages || !ai;
  $("#ai-cost-note").textContent =
    `AI requests: 3 campaign text + ${outputs.length} reference plans + ${outputs.length} high-quality images. Public web research is included. A revision uses 1 image request; older packs may also need 1 reference plan.`;
  if (runtime.pages)
    $(".privacy-note").textContent = ai
      ? "AI mode sends event text, assigned photos, all logos and revision instructions directly to OpenAI. Projects and results are saved locally; your key is never saved."
      : "Template mode works locally without sending event text or images to OpenAI.";
}
async function updatePreview() {
  const token = ++state.previewToken,
    b = readBrief();
  if (runtime.pages && b.mode === "ai") {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    $("#visual-preview").replaceChildren(element("p", "empty-preview", "AI will design the complete visual after generation."));
    $("#preview-label").textContent = "One shared campaign style, with naturally varied compositions.";
    return;
  }
  if (!state.assets.logos.length || !b.title || !b.date) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      $("#visual-preview").replaceChildren(
        element(
          "p",
          "empty-preview",
          "Add a logo, title and date to see your layout.",
        ),
      );
      $("#preview-label").textContent = "Your first visual will appear here.";
    }
    return;
  }
  const outputs = planOutputs(
    {
      ...b,
      formats: b.formats.length ? b.formats : ["instagram_post"],
      languages: b.languages.length ? b.languages : ["en"],
    },
    state.assets.photos,
    state.assets.logos,
  );
  const first = outputs[0];
  if (!first) return;
  const { blob } = await renderVisual(
    b,
    first,
    templateCopy(b, first),
    state.assets,
  );
  if (token !== state.previewToken) return;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(blob);
  const img = element("img");
  img.src = previewUrl;
  img.alt = `Layout preview for ${FORMATS[first.format].label}`;
  $("#visual-preview").replaceChildren(img);
  $("#preview-label").textContent =
    runtime.pages && b.mode === "ai"
      ? "Reference preview only. AI-generated artwork appears after generation and must be reviewed."
      : `Layout preview · ${FORMATS[first.format].label} · ${LANGUAGES[first.language]} · ${first.width} × ${first.height}. AI wording may differ.`;
}
$("#variants").addEventListener("change", () => {
  for (const format of Object.keys(FORMATS))
    $("#quantity-" + format).value = $("#variants").value;
});
form.addEventListener("input", edited);
form.addEventListener("change", edited);
async function persistRun(run) {
  memoryRuns.set(run.id, run);
  try {
    await put("runs", run);
    return true;
  } catch (error) {
    notice(
      `${error.message} This run is available for this visit; download the ZIP now.`,
      true,
    );
    return false;
  }
}
function setBusy(busy) {
  state.busy = busy;
  form.querySelectorAll("input,textarea,select,button").forEach((el) => {
    el.disabled = busy;
  });
  $("#example-button").disabled = busy;
  $("#new-project").disabled = busy;
  $("#rename-project").disabled = busy;
  $("#delete-project").disabled = busy;
  $("#reuse-brief").disabled = busy;
  $("#back-to-editor").disabled = busy;
  renderAssets();
  updateSummary();
}
async function generate(event) {
  event.preventDefault();
  if (state.busy) return;
  if (state.uploading) {
    notice("Wait for the selected uploads to finish.");
    return;
  }
  const brief = readBrief(),
    errors = validateBrief(brief, state.assets.logos),
    box = $("#form-errors");
  if (errors.length) {
    box.replaceChildren(...errors.map((error) => element("p", "", error)));
    box.hidden = false;
    box.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  box.hidden = true;
  if (brief.mode === "ai" && browserKeyMode && !requestApiKey) {
    openConnection();
    $("#connection-status").textContent =
      "Add your API key for this visit, or choose Template mode.";
    $("#openai-key").focus();
    return;
  }
  notice("");
  await saveDraft();
  clearTimeout(previewTimer);
  state.previewToken++;
  const run = {
    id: crypto.randomUUID(),
    projectId: state.projectId,
    createdAt: new Date().toISOString(),
    status: "running",
    brief: structuredClone(brief),
    assets: structuredClone(state.assets),
    mode: brief.mode,
    promptVersion: PROMPT_VERSION,
    styleGuideVersion: BRAND_POLICY.version,
    styleGuideSnapshot: snapshotPolicy(brief.colors),
    outputs: planOutputs(brief, state.assets.photos, state.assets.logos),
  };
  if (runtime.pages) {
    run.reviewRequired = true;
    run.posts = postRequirements(run.outputs).map(
      ({ id, format, language }) => ({
        id,
        format,
        language,
        caption: "",
        status: "pending",
        approved: false,
      }),
    );
  }
  state.run = run;
  state.cancelled = false;
  state.controller = new AbortController();
  setBusy(true);
  await persistRun(run);
  showRun(run);
  await renderSidebar();
  try {
    if (runtime.pages && brief.mode === "ai") {
      await generatePagesRun(
        run,
        requestApiKey,
        state.controller.signal,
        async () => {
          $("#progress-message").textContent =
            run.pipeline.planner.status === "running"
              ? "Planning visuals and writing posts in parallel…"
              : "Checking original references and generating light visuals…";
          $("#run-progress").value = Math.round(
            (100 *
              (run.outputs.filter((output) => output.image).length +
                run.outputs.filter((output) => output.referencePlanVersion).length +
                (run.pipeline.planner.status !== "running" ? 1 : 0) +
                (run.pipeline.copy.status !== "running" ? 1 : 0))) /
              (run.outputs.length * 2 + 2),
          );
          await persistRun(run);
          renderResults();
        },
      );
      return;
    }
    let copies;
    if (brief.mode === "ai") {
      $("#progress-message").textContent =
        "Writing channel-specific copy and translations…";
      const response = await requestCopy(
        brief,
        run.outputs,
        state.backend,
        state.controller.signal,
        browserKeyMode ? requestApiKey : "",
      );
      copies = response.outputs;
      run.model = response.model;
      run.promptVersion = response.promptVersion;
    } else copies = run.outputs.map((o) => templateCopy(brief, o));
    if (runtime.pages && brief.mode === "template")
      for (const post of run.posts) {
        post.caption = copies.find((copy) => copy.postId === post.id).caption;
        post.generatedCaption = post.caption;
        post.status = "completed";
      }
    for (let index = 0; index < run.outputs.length; index++) {
      const output = run.outputs[index];
      if (state.cancelled) break;
      $("#progress-message").textContent =
        `Rendering visual ${index + 1} of ${run.outputs.length}…`;
      $("#run-progress").value = 10 + (index / run.outputs.length) * 90;
      const copy = copies.find((c) => c.id === output.id);
      Object.assign(output, copy);
      try {
        if (copy.error) throw Error(copy.error);
        const rendered = await renderVisual(brief, output, copy, run.assets);
        Object.assign(output, copy, {
          image: rendered.blob,
          style: rendered.style,
          status: "completed",
        });
      } catch (error) {
        output.status = "failed";
        output.error = error.message;
      }
      await persistRun(run);
      renderResults();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const completed = run.outputs.filter(
      (o) => o.status === "completed",
    ).length;
    run.status = state.cancelled
      ? "cancelled"
      : completed === run.outputs.length
        ? "completed"
        : completed
          ? "partial"
          : "failed";
    run.outputs
      .filter((o) => o.status === "pending")
      .forEach((o) => {
        o.status = "cancelled";
        o.error = "Cancelled before rendering.";
      });
  } catch (error) {
    run.status = state.cancelled ? "cancelled" : "failed";
    run.error = state.cancelled ? "Generation cancelled." : error.message;
    run.outputs
      .filter((o) => o.status === "pending")
      .forEach((o) => {
        o.status = state.cancelled ? "cancelled" : "failed";
        o.error = run.error;
      });
  } finally {
    run.finishedAt = new Date().toISOString();
    await persistRun(run);
    setBusy(false);
    renderResults();
    await renderSidebar();
  }
}
form.addEventListener("submit", (event) =>
  generate(event).catch((error) => {
    setBusy(false);
    handleError(error);
  }),
);
$("#cancel-generation").addEventListener("click", () => {
  state.cancelled = true;
  state.controller?.abort();
  $("#progress-message").textContent = "Cancelling after the current visual…";
});
function showRun(run) {
  if (state.uploading || (state.busy && state.run?.id !== run.id)) {
    notice(
      "Finish uploads or cancel the current generation before opening another run.",
    );
    return;
  }
  state.run = memoryRuns.get(run.id) || run;
  if (recoverCaptionBudgets(state.run)) persistRun(state.run).catch(handleError);
  $("#editor-view").hidden = true;
  $("#results-view").hidden = false;
  renderResults();
  renderSidebar().catch(handleError);
  setSidebar(false);
  $("#workspace").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function updateReviewGate(run) {
  if (!run.reviewRequired || state.run?.id !== run.id) return;
  $("#download-zip").disabled = state.busy || !reviewReady(run);
  if (run.status === "completed")
    $("#results-title").textContent = reviewReady(run)
      ? "Approved and ready."
      : "Review your content.";
  $("#review-status").textContent =
    `Approved visuals: ${run.outputs.filter((output) => output.approved).length}/${run.outputs.length} · Approved posts: ${run.posts.filter((post) => post.approved).length}/${run.posts.length}. Approve every visual and post to unlock ZIP.`;
}
function renderPostReviews(run) {
  const section = $("#posts-review");
  section.hidden = !run.reviewRequired;
  section.replaceChildren();
  if (!run.reviewRequired) return;
  section.append(
    element("h2", "", "Review post texts"),
    element(
      "p",
      "",
      "One shared caption per carousel or Story sequence. Edit the text, then approve it. Text edits do not call OpenAI.",
    ),
  );
  if (run.captionResearch) {
    const info = element("div", "research-note");
    info.append(element("p", "input-help", run.captionResearch.status === "available"
      ? `Public writing guidance checked on ${run.captionResearch.checkedAt.slice(0, 10)}. Sources inform the copy; recommendations are not hard limits.`
      : "Live writing research was unavailable. Baseline channel recommendations were used; no live trend claim is made."));
    for (const source of run.captionResearch.sources) {
      const link = element("a", "research-source", source.title);
      link.href = source.url; link.target = "_blank"; link.rel = "noopener noreferrer";
      info.append(link);
    }
    section.append(info);
  }
  for (const post of run.posts) {
    const card = element("article", "post-review-card");
    card.dataset.postId = post.id;
    card.append(
      element(
        "h3",
        "",
        `${FORMATS[post.format].label} · ${LANGUAGES[post.language]}`,
      ),
    );
    const label = element("label", "", "Post text"),
      editor = element("textarea", "post-copy-editor"),
      id = `post-copy-${post.id}`;
    label.htmlFor = id;
    editor.id = id;
    editor.rows = 7;
    editor.lang = post.language;
    const guidance = captionGuidance(post.format, run.captionResearch);
    const count = element("p", "input-help caption-count");
    const updateCount = () => {
      count.textContent = `${characterCount(editor.value)} characters · Suggested length: ${guidance.recommendedMin}–${guidance.recommendedMax}. Guidance only; preserve important details.`;
    };
    editor.value = post.draftCaption ?? post.caption;
    updateCount();
    editor.disabled = state.busy;
    const error = element("p", "review-error", post.error || "");
    error.setAttribute("role", "status");
    const approve = element(
      "button",
      "button secondary approve-post",
      post.approved ? "Reopen post review" : "Approve post",
    );
    approve.type = "button";
    approve.disabled = state.busy;
    editor.addEventListener("input", () => {
      updateCount();
      post.draftCaption = editor.value;
      post.approved = false;
      approve.textContent = "Approve edited post";
      const badge = card.querySelector(".approval-badge");
      badge.textContent = "Needs approval";
      badge.classList.remove("is-approved");
      updateReviewGate(run);
      persistRun(run).catch(handleError);
    });
    approve.addEventListener("click", () =>
      approvePost(run, post).catch(handleError),
    );
    card.append(
      label,
      editor,
      count,
      error,
      element(
        "span",
        `approval-badge ${post.approved ? "is-approved" : ""}`,
        post.approved ? "Approved" : "Needs approval",
      ),
      approve,
    );
    section.append(card);
  }
}
async function approvePost(source, original) {
  if (state.busy || state.run?.id !== source.id) return;
  const caption = (original.draftCaption ?? original.caption).trim();
  if (!caption) {
    notice("Enter the post text before approval.", true);
    return;
  }
  let run = source;
  if (caption !== original.caption) {
    run = structuredClone(source);
    run.id = crypto.randomUUID();
    run.createdAt = new Date().toISOString();
    run.derivedFromRunId = source.id;
    run.finishedAt = run.createdAt;
  }
  const post = run.posts.find((item) => item.id === original.id);
  const wasApproved = post.approved;
  Object.assign(post, { caption, status: "completed", approved: !wasApproved });
  delete post.error;
  if (caption !== original.caption) post.copySource = "manual";
  delete post.draftCaption;
  if (run !== source) {
    delete original.draftCaption;
    await persistRun(source);
  }
  if (run.pipeline && run.posts.every((item) => item.status === "completed")) {
    run.pipeline.copy = { status: "completed", source: "reviewed" };
    run.error = run.pipeline.planner.error || "";
  }
  refreshAIStatus(run);
  state.run = run;
  await persistRun(run);
  renderResults();
  await renderSidebar();
}
function visualReviewControls(run, output) {
  const controls = element("div", "visual-review");
  if (output.imageError)
    controls.append(element("p", "review-error", output.imageError));
  if (run.pipeline) {
    const assigned = run.assets.photos.find((photo) => photo.id === output.photoId);
    controls.append(element("p", "input-help", assigned
      ? `Assigned photo: ${assigned.name}. Check that no people were added or replaced.`
      : "Information-only visual: no event photo is supplied; no people should appear."));
  }
  const label = element("label", "", "Changes for this visual"),
    feedback = element("textarea", "visual-feedback"),
    id = `feedback-${output.id}`;
  label.htmlFor = id;
  feedback.id = id;
  feedback.rows = 3;
  feedback.maxLength = 1500;
  feedback.value = output.feedback || "";
  feedback.placeholder =
    "For example: make the heading larger, use more cyan, and move the photo to the left.";
  feedback.disabled = state.busy;
  const actions = element("div", "review-actions");
  const regenerate = element(
    "button",
    "button secondary regenerate-visual",
    output.image ? "Regenerate visual · paid" : "Generate visual · paid",
  );
  regenerate.type = "button";
  regenerate.disabled = state.busy || !output.visualPlan;
  regenerate.addEventListener("click", () =>
    regenerateVisual(run, output).catch(handleError),
  );
  const approve = element(
    "button",
    "button primary approve-visual",
    output.approved ? "Reopen visual review" : "Approve visual",
  );
  approve.type = "button";
  approve.disabled =
    state.busy ||
    !output.image ||
    Boolean(output.imageError) ||
    Boolean(output.feedback?.trim());
  approve.addEventListener("click", async () => {
    if (
      state.busy ||
      !output.image ||
      output.imageError ||
      output.feedback?.trim()
    )
      return;
    output.approved = !output.approved;
    try {
      await persistRun(run);
      renderResults();
    } catch (error) {
      handleError(error);
    }
  });
  feedback.addEventListener("input", () => {
    output.feedback = feedback.value;
    output.approved = false;
    approve.textContent = "Approve visual";
    const badge = controls.querySelector(".approval-badge");
    badge.textContent = "Needs approval";
    badge.classList.remove("is-approved");
    approve.disabled =
      !output.image ||
      Boolean(output.imageError) ||
      Boolean(feedback.value.trim());
    updateReviewGate(run);
    persistRun(run).catch(handleError);
  });
  actions.append(regenerate, approve);
  if (!run.pipeline) {
    controls.append(
      element(
        "span",
        `approval-badge ${output.approved ? "is-approved" : ""}`,
        output.approved ? "Approved" : "Needs approval",
      ),
      approve,
    );
    return controls;
  }
  controls.append(
    label,
    feedback,
    element(
      "p",
      "input-help",
      "Regeneration uses only original logos and the assigned photo, never an old generated image. It costs 1 image request; an older pack may also need 1 reference-planning request. Every new image needs approval again.",
    ),
    element(
      "span",
      `approval-badge ${output.approved ? "is-approved" : ""}`,
      output.approved ? "Approved" : "Needs approval",
    ),
    actions,
  );
  return controls;
}
async function regenerateVisual(source, original) {
  if (state.busy || state.uploading || state.run?.id !== source.id) return;
  if (!requestApiKey) {
    openConnection();
    return;
  }
  if (original.image && !original.feedback?.trim()) {
    notice("Describe the changes before regenerating this visual.", true);
    return;
  }
  const run = structuredClone(source),
    output = run.outputs.find((item) => item.id === original.id);
  run.id = crypto.randomUUID();
  run.createdAt = new Date().toISOString();
  run.derivedFromRunId = source.id;
  run.status = "running";
  delete run.error;
  delete run.finishedAt;
  const feedback = output.feedback || "";
  output.approved = false;
  output.imageStatus = "running";
  output.status = "pending";
  delete output.imageError;
  delete output.error;
  state.run = run;
  state.cancelled = false;
  state.controller = new AbortController();
  setBusy(true);
  showRun(run);
  $("#progress-message").textContent =
    "Regenerating the selected visual with your feedback…";
  try {
    await persistRun(run);
    if (!hasReferencePlan(output)) {
      Object.assign(output, await planVisualFrame(
        run.brief, output, run.storyboard.find((post) => post.id === output.postId),
        run.assets, requestApiKey, state.controller.signal,
      ));
      await persistRun(run);
    }
    const rendered = await generateAIVisual(
      run.brief,
      output,
      run.storyboard.find((post) => post.id === output.postId),
      run.assets,
      requestApiKey,
      state.controller.signal,
      { feedback },
    );
    if (state.controller.signal.aborted)
      throw new Error("Generation cancelled.");
    Object.assign(output, {
      image: rendered.blob,
      style: rendered.style,
      imageModel: rendered.imageModel,
      imageSource: rendered.imageSource,
      visualPromptVersion: rendered.visualPromptVersion,
      imageStatus: "completed",
      feedback: "",
    });
    (output.revisions ||= []).push({
      createdAt: new Date().toISOString(),
      instructions: feedback,
      previousRunId: source.id,
    });
  } catch (error) {
    output.imageError = state.cancelled
      ? "Generation cancelled."
      : error.message;
    output.imageStatus = state.cancelled ? "cancelled" : "failed";
  } finally {
    refreshAIStatus(run);
    if (state.cancelled) run.status = "cancelled";
    run.finishedAt = new Date().toISOString();
    await persistRun(run);
    setBusy(false);
    renderResults();
    await renderSidebar();
  }
}

function renderResults() {
  const run = state.run;
  if (!run) return;
  revoke(outputUrls);
  const completed = run.outputs.filter((o) => o.status === "completed").length;
  $("#run-label").textContent = `RUN / ${run.id.slice(0, 8).toUpperCase()}`;
  $("#run-mode-label").textContent =
    `${run.pipeline ? "AI VISUALS + POSTS" : run.mode === "ai" ? "AI COPY" : "TEMPLATE COPY"} / ${run.status.toUpperCase()}${["openai-organic-v2", "openai-reference-v3"].includes(run.pipeline?.version) ? "" : ` / GUIDE ${run.styleGuideVersion || "LEGACY"}`}`;
  $("#results-title").textContent =
    run.status === "running"
      ? "Making it yours."
      : run.status === "completed"
        ? run.reviewRequired
          ? reviewReady(run)
            ? "Approved and ready."
            : "Review your content."
          : "Ready to share."
        : run.status === "partial"
          ? "A pack in progress."
          : run.status === "cancelled"
            ? "Your run, paused."
            : "Let’s try that again.";
  $("#run-summary").textContent =
    `${run.brief.title} · ${completed} of ${run.outputs.length} outputs ready · ${run.brief.languages.map((l) => LANGUAGES[l]).join(" + ")}`;
  $("#generation-progress").hidden = run.status !== "running";
  $("#cancel-generation").disabled = !state.busy;
  $("#run-error").hidden =
    !run.error && !["partial", "interrupted"].includes(run.status);
  $("#run-error").textContent =
    run.error ||
    (run.status === "interrupted"
      ? "The page closed during generation. Completed outputs were kept. Reuse the brief to start a new run."
      : run.reviewRequired
        ? "Some AI stages failed. Review the available results and retry failed visuals; ZIP unlocks after every visual and post is complete and approved."
        : "Some outputs could not be rendered. Successful files can be downloaded; failures are listed in the manifest.");
  $("#download-zip").disabled =
    state.busy ||
    (run.reviewRequired
      ? !reviewReady(run)
      : !completed || run.status === "running");
  renderPostReviews(run);
  $("#review-status").hidden = !run.reviewRequired;
  if (run.reviewRequired)
    $("#review-status").textContent =
      `Approved visuals: ${run.outputs.filter((output) => output.approved).length}/${run.outputs.length} · Approved posts: ${run.posts.filter((post) => post.approved).length}/${run.posts.length}. Approve every visual and post to unlock ZIP.`;
  $("#reuse-brief").disabled = state.busy;
  $("#back-to-editor").disabled = state.busy;
  const filter = $("#result-filter").value,
    grid = $("#output-grid");
  grid.replaceChildren();
  for (const output of run.outputs.filter(
    (o) => filter === "all" || o.language === filter,
  )) {
    const card = element("article", "output-card"),
      header = element("div", "output-card-header");
    header.append(
      element("strong", "", FORMATS[output.format].label),
      element("span", "language-tag", output.language === "uk" ? "UA" : "EN"),
    );
    card.append(header);
    if (output.image) {
      const url = URL.createObjectURL(output.image);
      outputUrls.push(url);
      const button = element("button", "output-image"),
        img = element("img");
      button.type = "button";
      button.setAttribute(
        "aria-label",
        `Open ${FORMATS[output.format].label}, ${LANGUAGES[output.language]}, variant ${output.variant}`,
      );
      img.src = url;
      img.alt = output.headline;
      button.append(img);
      button.addEventListener("click", () => openOutput(output));
      card.append(button);
      if (!run.reviewRequired) {
        const caption = element("p", "output-copy", output.caption);
        caption.lang = output.language;
        card.append(caption);
      }
      const footer = element("div", "output-card-footer");
      footer.append(
        element(
          "span",
          "",
          `${output.photoId ? "Photo included" : "Information-only"} · V${output.variant}`,
        ),
      );
      const view = element("button", "text-button", "View & copy →");
      view.type = "button";
      view.addEventListener("click", () => openOutput(output));
      footer.append(view);
      card.append(footer);
    } else {
      const placeholder = element(
        "div",
        `output-pending ${output.status === "failed" ? "failed" : ""}`,
        output.status === "pending"
          ? "Waiting for its moment…"
          : output.error || output.status,
      );
      card.append(placeholder);
      if (output.status === "failed" && !state.busy && !run.reviewRequired) {
        const edit = element(
          "button",
          "button secondary repair-copy",
          "Edit copy & render",
        );
        edit.type = "button";
        edit.addEventListener("click", () => openCopyRepair(output));
        card.append(edit);
      }
    }
    if (run.reviewRequired) card.append(visualReviewControls(run, output));
    grid.append(card);
  }
  $("#run-details-json").textContent = JSON.stringify(
    {
      id: run.id,
      createdAt: run.createdAt,
      mode: run.mode,
      model: run.model || null,
      imageModel: run.imageModel || null,
      pipeline: run.pipeline || null,
      captionResearch: run.captionResearch || null,
      posts: run.posts || null,
      promptVersion: run.promptVersion,
      styleGuideVersion: run.styleGuideVersion || null,
      styleGuideSnapshot: run.styleGuideSnapshot || null,
      brief: run.brief,
      outputs: run.outputs.map(
        ({ image, caption, subheading, ...rest }) => rest,
      ),
    },
    null,
    2,
  );
}
$("#result-filter").addEventListener("change", renderResults);
$("#back-to-editor").addEventListener("click", () => {
  if (!state.busy) showEditor();
});
$("#reuse-brief").addEventListener("click", async () => {
  if (state.busy || !state.run) return;
  state.assets = structuredClone(state.run.assets);
  fillBrief(state.run.brief);
  showEditor();
  renderAssets();
  edited();
  await saveDraft();
  notice("Brief copied into the editor. The original run stays unchanged.");
});
$("#download-zip").addEventListener("click", async () => {
  const button = $("#download-zip");
  button.disabled = true;
  try {
    notice("Packing your visuals and captions…");
    const archive = await buildArchive(state.run);
    download(archive.blob, archive.name);
    notice("Your content pack is ready. Check your browser downloads.");
  } catch (error) {
    handleError(error);
  } finally {
    renderResults();
  }
});
function openOutput(output) {
  $("#copy-editor").hidden = true;
  $("#render-edited-output").hidden = true;
  $("#copy-caption").hidden = false;
  $("#download-image").hidden = false;
  $("#output-caption").readOnly = true;
  $("#output-caption").removeAttribute("maxlength");
  if (dialogUrl) URL.revokeObjectURL(dialogUrl);
  dialogUrl = URL.createObjectURL(output.image);
  const img = element("img");
  img.src = dialogUrl;
  img.alt = output.headline;
  $("#output-dialog-image").replaceChildren(img);
  $("#output-dialog-title").textContent =
    `${FORMATS[output.format].label} · ${LANGUAGES[output.language]}`;
  $("#output-caption").value = output.caption;
  $("#output-caption").lang = output.language;
  $("#copy-status").textContent = "";
  $("#download-image").onclick = () =>
    download(output.image, `${output.id}.png`);
  $("#copy-caption").onclick = async () => {
    try {
      await navigator.clipboard.writeText(output.caption);
      $("#copy-status").textContent = "Copied to clipboard.";
    } catch {
      $("#output-caption").focus();
      $("#output-caption").select();
      $("#copy-status").textContent =
        "Select the text and copy it with your keyboard.";
    }
  };
  $("#output-dialog").showModal();
}
let repairOutputId;
function openCopyRepair(output) {
  if (state.busy) return;
  repairOutputId = output.id;
  $("#output-dialog-title").textContent = "Edit copy & render";
  $("#output-dialog-image").replaceChildren(
    element(
      "p",
      "",
      "Edit only the copy that needs changing. Event details, logos and photo assignments are kept. Saving creates a new run without an AI request.",
    ),
  );
  $("#copy-editor").hidden = false;
  $("#render-edited-output").hidden = false;
  $("#copy-caption").hidden = true;
  $("#download-image").hidden = true;
  $("#output-caption").readOnly = false;
  const limits = copyLimits(output.format);
  for (const field of ["headline", "subheading", "cta"]) {
    $("#edit-" + field).value =
      output[field] || (field === "headline" ? state.run.brief.title : "");
    $("#edit-" + field).maxLength = limits[field];
  }
  $("#output-caption").value = output.caption || "";
  $("#output-caption").removeAttribute("maxlength");
  $("#copy-status").textContent = output.error || "";
  $("#copy-limits").textContent =
    `headline: ${limits.headline} · subheading: ${limits.subheading} · CTA: ${limits.cta} · caption: writing guidance only`;
  $("#output-dialog").showModal();
}
$("#render-edited-output").addEventListener("click", async () => {
  if (state.busy || !state.run) return;
  const source = state.run,
    original = source.outputs.find((output) => output.id === repairOutputId);
  if (!original) return;
  const copy = {
    id: original.id,
    headline: $("#edit-headline").value.trim(),
    subheading: $("#edit-subheading").value.trim(),
    cta: $("#edit-cta").value.trim(),
    caption: $("#output-caption").value.trim(),
  };
  const error = copyError(copy, original);
  if (error) {
    $("#copy-status").textContent = error;
    return;
  }
  const run = structuredClone(source);
  run.id = crypto.randomUUID();
  run.createdAt = new Date().toISOString();
  run.derivedFromRunId = source.id;
  run.status = "running";
  delete run.error;
  delete run.finishedAt;
  const output = run.outputs.find((item) => item.id === original.id);
  Object.assign(output, copy, { status: "pending", copySource: "manual" });
  delete output.error;
  delete output.image;
  const related = run.outputs.filter(
    (item) =>
      item.id === output.id || (output.postId && item.postId === output.postId),
  );
  for (const item of related) {
    item.caption = copy.caption;
    item.copySource = "manual";
    if (item.status !== "completed" && !copyError(item, item)) {
      item.status = "pending";
      delete item.error;
    }
  }
  $("#output-dialog").close();
  state.cancelled = false;
  state.controller = new AbortController();
  state.run = run;
  setBusy(true);
  showRun(run);
  try {
    await persistRun(run);
    for (const item of related.filter((item) => item.status === "pending")) {
      if (state.cancelled) {
        item.status = "cancelled";
        item.error = "Cancelled before rendering.";
        continue;
      }
      try {
        const rendered = await renderVisual(run.brief, item, item, run.assets);
        Object.assign(item, {
          image: rendered.blob,
          style: rendered.style,
          status: "completed",
        });
      } catch (error) {
        item.status = "failed";
        item.error = error.message;
      }
      await persistRun(run);
      renderResults();
    }
  } catch (error) {
    run.error = error.message;
  } finally {
    const ready = run.outputs.filter(
      (item) => item.status === "completed",
    ).length;
    run.status = state.cancelled
      ? "cancelled"
      : ready === run.outputs.length
        ? "completed"
        : ready
          ? "partial"
          : "failed";
    run.finishedAt = new Date().toISOString();
    await persistRun(run);
    setBusy(false);
    renderResults();
    await renderSidebar();
  }
});
function openProjectDialog(action) {
  if (state.busy || state.uploading) {
    notice("Wait for the current uploads or generation to finish.");
    return;
  }
  state.projectAction = action;
  $("#project-dialog-title").textContent =
    action === "rename" ? "Give it a new name." : "A space for your ideas.";
  $("#project-name").value =
    action === "rename"
      ? state.projects.find((p) => p.id === state.projectId)?.name || ""
      : "";
  $("#project-dialog").showModal();
}
$("#new-project").addEventListener("click", () => openProjectDialog("create"));
$("#rename-project").addEventListener("click", () =>
  openProjectDialog("rename"),
);
$("#project-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = $("#project-name").value.trim();
  if (!name) {
    $("#project-name").setCustomValidity("Enter a project name.");
    $("#project-name").reportValidity();
    return;
  }
  try {
    if (state.projectAction === "rename") {
      const project = state.projects.find((p) => p.id === state.projectId);
      project.name = name;
      await put("projects", project);
      $("#current-project-name").textContent = name;
    } else {
      const project = {
        id: crypto.randomUUID(),
        name,
        createdAt: new Date().toISOString(),
      };
      await put("projects", project);
      state.projects.push(project);
      await switchProject(project.id);
    }
    $("#project-dialog").close();
    await renderSidebar();
  } catch (error) {
    handleError(error);
  }
});
$("#project-name").addEventListener("input", () =>
  $("#project-name").setCustomValidity(""),
);
$("#delete-project").addEventListener("click", () => {
  if (state.uploading) {
    notice("Wait for uploads to finish.");
    return;
  }
  $("#delete-dialog").showModal();
});
$("#confirm-delete").addEventListener("click", async () => {
  if (state.busy) return;
  try {
    clearTimeout(saveTimer);
    const id = state.projectId;
    await deleteProject(id);
    state.projects = state.projects.filter((p) => p.id !== id);
    for (const [key, run] of memoryRuns)
      if (run.projectId === id) memoryRuns.delete(key);
    state.projectId = null;
    if (!state.projects.length) {
      const project = {
        id: crypto.randomUUID(),
        name: translate("My first campaign"),
        createdAt: new Date().toISOString(),
      };
      await put("projects", project);
      state.projects.push(project);
    }
    await switchProject(state.projects[0].id);
    $("#delete-dialog").close();
    notice(
      runtime.corporate
        ? "Shared project and its history deleted."
        : "Project and its local history deleted.",
    );
  } catch (error) {
    handleError(error);
  }
});
for (const button of document.querySelectorAll(".close-dialog"))
  button.addEventListener("click", () => button.closest("dialog").close());
function setSidebar(open) {
  const mobile = window.matchMedia("(max-width:950px)").matches,
    wasOpen = $("#sidebar").classList.contains("open");
  $("#sidebar").classList.toggle("open", open);
  $("#sidebar").inert = mobile && !open;
  $(".app-main").inert = mobile && open;
  $("#sidebar-overlay").hidden = !open || !mobile;
  $("#toggle-sidebar").setAttribute("aria-expanded", String(open));
  $("#toggle-sidebar").setAttribute(
    "aria-label",
    open ? "Close projects" : "Open projects",
  );
  if (mobile && open) $("#new-project").focus();
  else if (mobile && wasOpen) $("#toggle-sidebar").focus();
}
window
  .matchMedia("(max-width:950px)")
  .addEventListener("change", () => setSidebar(false));
setSidebar(false);
$("#toggle-sidebar").addEventListener("click", () =>
  setSidebar($("#toggle-sidebar").getAttribute("aria-expanded") !== "true"),
);
$("#sidebar-overlay").addEventListener("click", () => setSidebar(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setSidebar(false);
});
try {
  state.backend =
    runtime.serverManaged || runtime.pages
      ? ""
      : localStorage.getItem("studio:backend") || "";
} catch {}
function updateKeyStatus() {
  $("#connect-key").textContent = requestApiKey
    ? "OpenAI key connected"
    : "Connect OpenAI";
  $("#key-status").textContent = requestApiKey
    ? "A key is active for this visit. Leave the field empty to keep it, or paste a replacement."
    : "No key connected. Template mode is available without one.";
  $("#forget-key").disabled = !requestApiKey;
}
function openConnection() {
  $("#backend-url").value = state.backend;
  $("#openai-key").value = "";
  $("#connection-status").textContent = "";
  updateKeyStatus();
  $("#settings-dialog").showModal();
}
if (runtime.corporate) {
  document.body.classList.add("corporate-mode");
  form.autocomplete = "off";
  $("#sign-out").hidden = false;
  $("#open-settings").textContent = "Account & shared library →";
  $("#connection-description").textContent =
    "Your company manages the OpenAI connection. The key stays on the server and is never sent to this browser. Approved colleagues share one protected project library.";
  $("#generation-mode option[value=ai]").textContent =
    "AI · company connection";
  $(".local-indicator").textContent = "Private team library";
  $(".sidebar-bottom p").textContent =
    "Projects and materials are stored in your team's encrypted server library. Access requires your approved corporate account.";
  $(".settings-note strong").textContent = "Protected shared library";
  $(".settings-note p").textContent =
    "Projects, assets and results are shared with approved colleagues and encrypted in server storage. You can access them after signing in on another device.";
  $("#delete-dialog p").textContent =
    "This removes the shared project, uploads and generation history for all approved colleagues. Export any ZIP archives you need first.";
  $("#save-connection").hidden = true;
  $("#sign-out").addEventListener("click", async () => {
    if (
      state.busy &&
      !confirmTranslated(
        "A generation is in progress. Sign out and leave the page?",
      )
    )
      return;
    try {
      const response = await privateFetch("/api/logout", { method: "POST" });
      if (!response.ok && response.status !== 401) await jsonResponse(response);
      state.busy = false;
      revoke(assetUrls);
      revoke(outputUrls);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (dialogUrl) URL.revokeObjectURL(dialogUrl);
      memoryRuns.clear();
      window.location.replace("/signin.html");
    } catch (error) {
      handleError(error);
    }
  });
}
$("#open-settings").addEventListener("click", openConnection);
$("#connect-key").addEventListener("click", openConnection);
$("#forget-key").addEventListener("click", () => {
  requestApiKey = "";
  $("#openai-key").value = "";
  updateKeyStatus();
  $("#connection-status").textContent =
    "Key forgotten. Paste it again when you need AI copy.";
});
$("#settings-dialog").addEventListener("close", () => {
  $("#openai-key").value = "";
});
if (runtime.serverManaged || runtime.pages) $("#backend-field").hidden = true;
if (browserKeyMode) {
  document.body.classList.add("hosted-key-mode");
  $("#client-key-field").hidden = false;
  $("#connect-key").hidden = false;
  $("#open-settings").textContent = "Your OpenAI key →";
  $("#save-connection").textContent = "Use key for this visit";
  $("#check-connection").textContent = "Check server";
  $("#generation-mode option[value=ai]").textContent = "AI · your OpenAI key";
  $("#connection-description").textContent =
    "Paste your OpenAI API key once for this visit. No installation or server address is needed. Your API account pays for your generation requests.";
} else if (runtime.serverManaged && !runtime.corporate) {
  $("#connection-description").textContent =
    "This site is already connected to its own server. The owner manages the OpenAI key in the server settings.";
}
if (runtime.pages) {
  form.autocomplete = "off";
  $("#connection-description").textContent =
    "Enter your OpenAI key for this visit. This browser sends event text, photos, logos and revision instructions directly to OpenAI for AI generation; the key is never saved in projects, browser storage or exports. Anyone with access to this browser can inspect a key while it is in use.";
  $("#check-connection").textContent = "Connection information";
  $("#generation-mode option[value=ai]").textContent = "AI · visuals + posts";
  $("#mode-indicator").textContent = "PAGES / LOCAL PROJECTS";
  $(".local-indicator").textContent = "Your local Google workspace";
  $(".sidebar-bottom p").textContent =
    "Each Google account has a separate library in this browser. No cloud sync. Export important ZIPs before clearing browser data.";
  $("#access-dialog > p").textContent =
    "Only the owner can manage this private Google access list. Each person keeps their own projects in their browser and enters a key for the visit.";
  $("#colleague-email").placeholder = "colleague@gmail.com";
  $("#access-form label").textContent = "Google account email";
  $("#access-dialog .settings-note p").textContent =
    "Adding an account sends no email. Share the Studio link manually. Google access controls the private directory, while the Pages code remains public. Revocation cannot erase local files or prevent someone using a copied version of this app.";
  $("#sign-out").hidden = false;
  $("#sign-out").addEventListener("click", async () => {
    if (state.busy && !confirmTranslated("Stop generation and sign out?"))
      return;
    window.dispatchEvent(new Event("studio:access-lost"));
    await (await import("./pages-auth.js")).signOutPages();
    window.location.reload();
  });
}
window.addEventListener("studio:access-lost", () => {
  requestApiKey = "";
  $("#openai-key").value = "";
  state.cancelled = true;
  state.controller?.abort();
  clearTimeout(saveTimer);
  clearTimeout(previewTimer);
  revoke(assetUrls);
  revoke(outputUrls);
  memoryRuns.clear();
  state.assets = { logos: [], photos: [] };
  state.run = null;
  $("#studio-app").hidden = true;
});
function backendValue() {
  if (runtime.serverManaged || runtime.pages) return "";
  const value = $("#backend-url").value.trim().replace(/\/$/, "");
  if (!value) return "";
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !["https:", "http:"].includes(u.protocol) ||
    (u.protocol === "http:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))
  )
    throw Error(
      "Use HTTPS for a remote server, or http://localhost for local development. Do not include credentials, query parameters, or fragments.",
    );
  return value;
}
$("#settings-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    if (browserKeyMode) {
      const entered = $("#openai-key").value.trim();
      if (entered && !/^[\x21-\x7e]{1,512}$/.test(entered))
        throw Error("Paste the key without spaces or quotes.");
      if (entered) requestApiKey = entered;
      if (!requestApiKey)
        throw Error(
          "Paste your API key, or close this window to use Template mode.",
        );
      $("#openai-key").value = "";
      updateKeyStatus();
      $("#settings-dialog").close();
      notice(
        "OpenAI key connected for this visit. It will be cleared when you refresh or close this page.",
      );
      return;
    }
    state.backend = backendValue();
    if (!runtime.serverManaged)
      localStorage.setItem("studio:backend", state.backend);
    $("#settings-dialog").close();
    notice(
      "Backend address saved. Your API key stays in the Java server configuration.",
    );
  } catch (error) {
    $("#connection-status").textContent = error.message;
  }
});
$("#check-connection").addEventListener("click", async () => {
  const status = $("#connection-status");
  status.textContent = "Checking…";
  try {
    if (runtime.pages) {
      status.textContent =
        "Pages connects directly to OpenAI. Your key and API billing are checked on the first generation; this check spends no credits.";
      return;
    }
    const response = await fetch(`${backendValue()}/api/health`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error("The backend is not available.");
    const data = await response.json();
    if (data.service !== "creative-automation-studio")
      throw Error("This address does not point to the Studio Java server.");
    status.textContent = data.clientKeysEnabled
      ? "Studio is online. Your key is checked by OpenAI on your first generation; this server check spends no API credits."
      : data.aiConfigured
        ? "Connected. The server has an AI key configured."
        : "Connected. Add your key to the Java server configuration to enable AI copy.";
  } catch (error) {
    status.textContent = `Connection failed: ${error.message}. Template mode is still available.`;
  }
});
$("#example-button").addEventListener("click", async () => {
  if (state.busy || state.uploading) return;
  if (
    (readBrief().title || state.assets.logos.length) &&
    !confirmTranslated(
      "Replace this project’s draft and uploads with an example? Existing generation history is kept.",
    )
  )
    return;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 440;
    canvas.height = 150;
    const c = canvas.getContext("2d");
    c.fillStyle = "#302A40";
    c.fillRect(0, 0, 440, 150);
    c.fillStyle = "#00A6EB";
    c.fillRect(22, 27, 42, 42);
    c.fillStyle = "#E60036";
    c.fillRect(45, 72, 42, 42);
    c.fillStyle = "white";
    c.font = "bold 43px Arial";
    c.fillText("CREATIVE", 109, 67);
    c.font = "28px Arial";
    c.fillText("LAB / DEMO", 110, 108);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve));
    state.assets = {
      logos: [
        {
          id: crypto.randomUUID(),
          name: "creative-lab-demo.png",
          blob,
          hash: "example-logo",
        },
      ],
      photos: [],
    };
    fillBrief({
      title: "Creative Automation Lab",
      description:
        "A hands-on workshop for students learning Java, JavaScript and creative automation.",
      date: "2026-11-21",
      time: "17:00",
      timeZone: "Europe/Kyiv",
      location: "Kyiv, Ukraine",
      sourceLanguage: "en",
      titleEn: "Creative Automation Lab",
      titleUk: "Лабораторія креативної автоматизації",
      descriptionEn: "Build, experiment and share your next idea.",
      descriptionUk: "Створюйте, експериментуйте та діліться своїми ідеями.",
      formats: ["instagram_post", "facebook"],
      languages: ["en", "uk"],
      variants: 1,
      mode: browserKeyMode || runtime.aiConfigured ? "ai" : "template",
      colors: ["#00a6eb", "#e60036", "#302a40"],
    });
    renderAssets();
    edited();
    await saveDraft();
    notice(
      "Example loaded with a demo logo. Replace it with your own brand assets.",
    );
  } catch (error) {
    handleError(error);
  }
});
async function renderAccess() {
  const members = runtime.pages
    ? await (await import("./pages-auth.js")).listPagesAccess()
    : await jsonResponse(await privateFetch("/api/access"));
  const list = $("#access-list");
  list.replaceChildren();
  for (const member of members) {
    const row = element("div", "access-member"),
      info = element("div");
    info.append(
      element("strong", "", member.email),
      element(
        "small",
        "",
        member.owner
          ? "Owner · always approved"
          : member.active
            ? "Access approved"
            : "Access revoked",
      ),
    );
    row.append(info);
    if (!member.owner) {
      const button = element(
        "button",
        "button secondary",
        member.active ? "Revoke access" : "Restore access",
      );
      button.type = "button";
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          if (runtime.pages)
            await (
              await import("./pages-auth.js")
            ).changePagesAccess(member.email, !member.active);
          else {
            await jsonResponse(
              await privateFetch(
                member.active ? "/api/access/revoke" : "/api/access",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: member.email }),
                },
              ),
            );
          }
          $("#access-status").textContent = member.active
            ? "Access revoked. This account's next request will be blocked."
            : "Access restored. Share this Studio link with your colleague.";
          await renderAccess();
        } catch (error) {
          $("#access-status").textContent = error.message;
          button.disabled = false;
        }
      });
      row.append(button);
    }
    list.append(row);
  }
}
$("#manage-access").addEventListener("click", () => {
  $("#access-status").textContent = "Loading the private access list…";
  $("#access-dialog").showModal();
  renderAccess()
    .then(() => {
      $("#access-status").textContent = "";
    })
    .catch((error) => {
      $("#access-status").textContent = error.message;
    });
});
$("#access-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#access-form button");
  button.disabled = true;
  try {
    if (runtime.pages)
      await (
        await import("./pages-auth.js")
      ).changePagesAccess($("#colleague-email").value, true);
    else {
      await jsonResponse(
        await privateFetch("/api/access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: $("#colleague-email").value.trim() }),
        }),
      );
    }
    $("#colleague-email").value = "";
    $("#access-status").textContent =
      "Access enabled. Copy this Studio link and share it with your colleague. No invitation email was sent.";
    await renderAccess();
  } catch (error) {
    $("#access-status").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
$("#copy-team-link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(
      new URL("./", window.location.href).href,
    );
    $("#access-status").textContent = runtime.pages
      ? "Studio link copied. Share it with your approved Google accounts."
      : "Studio link copied. Only approved corporate accounts can open the library.";
  } catch {
    $("#access-status").textContent =
      "Share this site's address from your browser's address bar.";
  }
});
async function init() {
  try {
    if (runtime.pages) {
      const account = (await import("./pages-auth.js")).pagesAccount();
      if (!account) throw Error("Sign in with an approved Google account.");
      $("#manage-access").hidden = !account.owner;
    }
    if (runtime.corporate) {
      const account = await session();
      $("#connection-status").textContent =
        "Signed in to the protected team library.";
      $("#sign-out").title = "Sign out of this corporate session";
      $("#manage-access").hidden = !account.canManageAccess;
    }
    state.projects = await all("projects");
    for (const run of await all("runs"))
      if (!runtime.corporate && run.status === "running") {
        run.status = "interrupted";
        run.outputs
          .filter((o) => o.status === "pending")
          .forEach((o) => {
            o.status = "interrupted";
            o.error = "Page closed before this output was rendered.";
          });
        await put("runs", run);
      }
    if (!state.projects.length) {
      const project = {
        id: crypto.randomUUID(),
        name: translate("My first campaign"),
        createdAt: new Date().toISOString(),
      };
      await put("projects", project);
      state.projects.push(project);
    }
    await switchProject(state.projects[0].id);
  } catch (error) {
    form
      .querySelectorAll("button,input,textarea,select")
      .forEach((el) => (el.disabled = true));
    handleError(error);
  }
}
window.addEventListener("pagehide", () => {
  requestApiKey = "";
  $("#openai-key").value = "";
  updateKeyStatus();
  if (runtime.corporate || runtime.pages) {
    revoke(assetUrls);
    revoke(outputUrls);
    memoryRuns.clear();
    state.assets = { logos: [], photos: [] };
    state.run = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (dialogUrl) URL.revokeObjectURL(dialogUrl);
    document.body.replaceChildren(
      element("main", "", "Sign-in required. Reload Studio to continue."),
    );
  }
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted && (runtime.corporate || runtime.pages))
    window.location.reload();
});
window.addEventListener("beforeunload", (event) => {
  if (state.busy) {
    event.preventDefault();
    event.returnValue = "";
  }
});
window.addEventListener("studio:language-change", () => {
  updateSummary();
  renderResults();
  if (state.projectId) renderSidebar().catch(handleError);
});
init();
