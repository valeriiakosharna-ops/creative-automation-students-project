import { BRAND_POLICY, snapshotPolicy } from "./brand.js";
import { session, privateFetch, jsonResponse } from "./private-api.js";
import "./style.css";
import { FORMATS, LANGUAGES, validateBrief, planOutputs } from "./planner.js";
import { templateCopy, requestCopy, PROMPT_VERSION } from "./copy.js";
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
  const data = new FormData(form),
    b = {};
  for (const name of [
    "title",
    "description",
    "date",
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
        `${new Date(run.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${run.status}`,
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
    ? " AI copy mode"
    : " Template mode";
  $("#mode-note").textContent = ai
    ? "AI creates and translates copy for each selected format and language. Your original photos and logos stay on this device; only event text is sent to the Java server."
    : "Template mode uses your supplied wording, with channel-specific structure. It does not translate descriptions. Add localized copy below, or connect AI for translation.";
}
async function updatePreview() {
  const token = ++state.previewToken,
    b = readBrief();
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
    `Layout preview · ${FORMATS[first.format].label} · ${LANGUAGES[first.language]} · ${first.width} × ${first.height}. AI wording may differ.`;
}
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
  state.run = run;
  state.cancelled = false;
  state.controller = new AbortController();
  setBusy(true);
  await persistRun(run);
  showRun(run);
  await renderSidebar();
  try {
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
    } else copies = run.outputs.map((o) => templateCopy(brief, o));
    for (let index = 0; index < run.outputs.length; index++) {
      const output = run.outputs[index];
      if (state.cancelled) break;
      $("#progress-message").textContent =
        `Rendering visual ${index + 1} of ${run.outputs.length}…`;
      $("#run-progress").value = 10 + (index / run.outputs.length) * 90;
      const copy = copies.find((c) => c.id === output.id);
      try {
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
  $("#editor-view").hidden = true;
  $("#results-view").hidden = false;
  renderResults();
  renderSidebar().catch(handleError);
  setSidebar(false);
  $("#workspace").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function renderResults() {
  const run = state.run;
  if (!run) return;
  revoke(outputUrls);
  const completed = run.outputs.filter((o) => o.status === "completed").length;
  $("#run-label").textContent = `RUN / ${run.id.slice(0, 8).toUpperCase()}`;
  $("#run-mode-label").textContent =
    `${run.mode === "ai" ? "AI COPY" : "TEMPLATE COPY"} / ${run.status.toUpperCase()} / GUIDE ${run.styleGuideVersion || "LEGACY"}`;
  $("#results-title").textContent =
    run.status === "running"
      ? "Making it yours."
      : run.status === "completed"
        ? "Ready to share."
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
      : "Some outputs could not be rendered. Successful files can be downloaded; failures are listed in the manifest.");
  $("#download-zip").disabled = !completed || run.status === "running";
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
    if (output.status === "completed") {
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
      const caption = element("p", "output-copy", output.caption);
      caption.lang = output.language;
      card.append(button, caption);
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
    }
    grid.append(card);
  }
  $("#run-details-json").textContent = JSON.stringify(
    {
      id: run.id,
      createdAt: run.createdAt,
      mode: run.mode,
      model: run.model || null,
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
    button.disabled = false;
  }
});
function openOutput(output) {
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
        name: "My first campaign",
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
  const mobile = window.matchMedia("(max-width:700px)").matches,
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
  .matchMedia("(max-width:700px)")
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
      !window.confirm(
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
    "Enter your OpenAI key for this visit. This browser sends text directly to OpenAI; the key is never saved in projects, browser storage or exports. Anyone with access to this browser can inspect a key while it is in use.";
  $("#check-connection").textContent = "Connection information";
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
    if (state.busy && !confirm("Stop generation and sign out?")) return;
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
    !window.confirm(
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
        name: "My first campaign",
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
      element(
        "main",
        "",
        "Corporate session required. Reload Studio to continue.",
      ),
    );
  }
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted && runtime.corporate) window.location.reload();
});
window.addEventListener("beforeunload", (event) => {
  if (state.busy) {
    event.preventDefault();
    event.returnValue = "";
  }
});
init();
