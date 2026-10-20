import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";

async function pagesFixture(page) {
  let identity = { uid: "owner-uid", email: "owner@team.example", owner: true };
  const members = [{ email: identity.email, active: true, owner: true }];
  await page.route("**/runtime.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.STUDIO_RUNTIME={pages:true,clientKeysEnabled:true,workspaceStorage:"browser",firebase:{projectId:"demo-project",apiKey:"not-a-secret"}};',
    }),
  );
  await page.route("**/assets/pages-auth-*.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
    let account=null, callback;
    const identity=${JSON.stringify(identity)};
    export function pagesAccount(){return account;}
    export async function initializePagesAuth(config,onAccess,onMessage){callback=onAccess;onAccess(null,false);window.addEventListener('__fixture_revoke',()=>{account=null;callback(null,true);});}
    export async function signInPages(){account=identity;callback(account,true);}
    export async function signOutPages(){account=null;callback(null,false);}
    export async function listPagesAccess(){return (await fetch('/fixture-access')).json();}
    export async function changePagesAccess(email,active){await fetch('/fixture-access',{method:'POST',body:JSON.stringify({email,active})});}
  `,
    }),
  );
  await page.route("**/fixture-access", (route) => {
    if (route.request().method() === "POST") {
      const value = route.request().postDataJSON(),
        index = members.findIndex((m) => m.email === value.email);
      if (index >= 0) members[index] = { ...members[index], ...value };
      else members.push({ ...value, owner: false });
    }
    return route.fulfill({ json: members });
  });
  return (value) => {
    identity = value;
  };
}
async function login(page) {
  await page.goto("/");
  await expect(page.locator("#studio-app")).toBeHidden();
  await page.locator("#google-signin").click();
  await expect(page.locator("#current-project-name")).toHaveText(
    "My first campaign",
  );
}
async function mockOpenAI(
  page,
  { key, failVisualOnce, holdCopyUntilImage = false, longPost = false } = {},
) {
  const state = {
    text: [],
    images: [],
    activeImages: 0,
    maxActiveImages: 0,
    plannerDone: false,
    copyDone: false,
  };
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const c = canvas.getContext("2d");
    c.fillStyle = "#81d0f4";
    c.fillRect(0, 0, 256, 256);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  let heldCopy;
  await page.route(
    "https://api.openai.com/v1/chat/completions",
    async (route) => {
      const request = route.request(),
        body = request.postDataJSON(),
        stage = body.response_format.json_schema.name;
      if (key) expect(request.headers().authorization).toBe(`Bearer ${key}`);
      expect(body.messages[0].content).toContain(
        "Creative Automation Social Style Guide",
      );
      const input = JSON.parse(
        body.messages.find((message) => message.role === "user").content,
      );
      state.text.push({ stage, input });
      const posts = input.posts.map((post) =>
        stage === "social_posts"
          ? {
              id: post.id,
              caption:
                longPost && post.id === "instagram_post-en"
                  ? "x".repeat(651)
                  : `${post.id} — Creative Lab`,
            }
          : {
              id: post.id,
              visuals: input.outputs
                .filter((output) => output.postId === post.id)
                .map((output) => ({
                  id: output.id,
                  headline:
                    output.language === "uk"
                      ? "Творча лабораторія"
                      : "Creative Lab",
                  subheading: "",
                  cta: output.language === "uk" ? "Долучайтеся" : "Join us",
                  visualPlan: {
                    role: output.position === 1 ? "opening" : "closing",
                    layout: ["split-right", "split-left", "poster"][
                      (output.position - 1) % 3
                    ],
                    direction:
                      "Complementary frame using the channel style and all original logos.",
                  },
                })),
            },
      );
      const fulfill = async () => {
        if (stage === "visual_storyboard") state.plannerDone = true;
        else state.copyDone = true;
        await route.fulfill({
          json: {
            choices: [
              {
                finish_reason: "stop",
                message: { content: JSON.stringify({ posts }) },
              },
            ],
          },
        });
      };
      if (stage === "social_posts" && holdCopyUntilImage) heldCopy = fulfill;
      else await fulfill();
    },
  );
  await page.route("https://api.openai.com/v1/images/edits", async (route) => {
    const req = route.request();
    if (key) expect(req.headers().authorization).toBe(`Bearer ${key}`);
    const form = await new Request(req.url(), {
      method: "POST",
      headers: req.headers(),
      body: req.postDataBuffer(),
    }).formData();
    const prompt = form.get("prompt"),
      input = JSON.parse(
        prompt.slice(prompt.search(/DATA:\r?\n/)).replace(/^DATA:\r?\n/, ""),
      );
    const files = await Promise.all(
      form.getAll("image[]").map(async (file) => ({
        size: file.size,
        name: file.name,
        bytes: Buffer.from(await file.arrayBuffer()),
      })),
    );
    state.images.push({ input, files, model: form.get("model") });
    expect(state.plannerDone).toBe(true);
    expect(form.get("model")).toBe("gpt-image-1.5");
    expect(input.brandPolicy.defaultColors).toContain("#00A6EB");
    if (heldCopy) {
      expect(state.copyDone).toBe(false);
      await heldCopy();
      heldCopy = null;
    }
    state.activeImages++;
    state.maxActiveImages = Math.max(state.maxActiveImages, state.activeImages);
    try {
      if (failVisualOnce && input.frame.id === failVisualOnce) {
        failVisualOnce = null;
        await route.fulfill({
          status: 429,
          json: { error: { message: "private provider response" } },
        });
      } else await route.fulfill({ json: { data: [{ b64_json: png }] } });
    } finally {
      state.activeImages--;
    }
  });
  return state;
}
async function approvePack(page) {
  for (const button of await page.locator(".approve-visual").all())
    if ((await button.textContent()).includes("Approve visual"))
      await button.click();
  for (const button of await page.locator(".approve-post").all())
    if ((await button.textContent()).includes("Approve post"))
      await button.click();
  await expect(page.locator("#download-zip")).toBeEnabled();
}

test("unconfigured Pages stays locked without opening local project databases", async ({
  page,
}) => {
  await page.route("**/runtime.js", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: "window.STUDIO_RUNTIME={pages:true,firebase:null};",
    }),
  );
  await page.goto("/");
  await expect(page.locator("#google-signin")).toBeDisabled();
  await expect(page.locator("#signin-status")).toContainText(
    "finish Firebase setup",
  );
  await expect(page.locator("#studio-app")).toBeHidden();
  expect(await page.evaluate(() => indexedDB.databases())).toHaveLength(0);
});
test("Pages Google workflow, private owner controls, direct AI, ZIP, visit key clearing and per-account local history", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const setIdentity = await pagesFixture(page);
  await login(page);
  await page.locator("#manage-access").click();
  await page.locator("#colleague-email").fill("member@gmail.com");
  await page.locator('#access-form button[type="submit"]').click();
  await expect(page.locator(".access-member")).toHaveCount(2);
  await page.locator("#access-dialog .close-dialog").click();
  await page.locator("#example-button").click();
  await page.locator("#connect-key").click();
  await expect(page.locator("#backend-field")).toBeHidden();
  const visitKey = "test-only-pages-visit-key";
  await page.locator("#openai-key").fill(visitKey);
  await page.locator("#save-connection").click();
  expect(await page.locator("#openai-key").inputValue()).toBe("");
  const requests = await mockOpenAI(page, { key: visitKey });
  await page.locator("#generate-button").click();
  await expect(page.locator("#run-mode-label")).toContainText("COMPLETED", {
    timeout: 45000,
  });
  expect(requests.text).toHaveLength(2);
  expect(requests.images).toHaveLength(4);
  await expect(page.locator("#download-zip")).toBeDisabled();
  await approvePack(page);
  const pending = page.waitForEvent("download");
  await page.locator("#download-zip").click();
  const zip = await pending,
    path = testInfo.outputPath("pages-pack.zip");
  await zip.saveAs(path);
  const files = unzipSync(new Uint8Array(await readFile(path)));
  expect(
    Object.keys(files).filter((name) => name.endsWith(".png")),
  ).toHaveLength(4);
  for (const [name, bytes] of Object.entries(files))
    if (!name.endsWith(".png"))
      expect(strFromU8(bytes)).not.toContain(visitKey);
  const dbName = "creative-automation-studio:demo-project:owner-uid";
  const records = await page.evaluate(async (name) => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open(name);
      r.onsuccess = () => resolve(r.result);
    });
    const data = await Promise.all(
      ["projects", "drafts", "runs"].map(
        (store) =>
          new Promise((resolve) => {
            const r = db.transaction(store).objectStore(store).getAll();
            r.onsuccess = () => resolve(r.result);
          }),
      ),
    );
    db.close();
    return JSON.stringify(data);
  }, dbName);
  expect(records).not.toContain(visitKey);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage })),
  ).not.toContain(visitKey);
  setIdentity({ uid: "member-uid", email: "member@gmail.com", owner: false });
  await login(page);
  await expect(page.locator("#manage-access")).toBeHidden();
  await expect(page.locator("#title")).toHaveValue("");
  await expect(page.locator("#history-list button")).toHaveCount(0);
  setIdentity({ uid: "owner-uid", email: "owner@team.example", owner: true });
  await login(page);
  await expect(page.locator("#title")).toHaveValue("Creative Automation Lab");
  await expect(page.locator("#history-list button")).toHaveCount(1);
  await expect(page.locator("#connect-key")).toHaveText("Connect OpenAI");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("__fixture_revoke")),
  );
  await expect(page.locator("#pages-signin")).toBeVisible();
  await expect(page.locator("#studio-app")).toBeHidden();
  expect(await page.locator("#openai-key").inputValue()).toBe("");
  expect(errors).toEqual([]);
});

test("a Pages build refuses to open when runtime settings fail to load", async ({
  page,
}) => {
  await page.route("**/runtime.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: "" }),
  );
  await page.goto("/");
  if (!(await page.locator('meta[name="studio-build"]').count()))
    test.skip(true, "Requires build:pages");
  await expect(page.locator("#studio-app")).toBeHidden();
  await expect(page.locator("#google-signin")).toBeDisabled();
  await expect(page.locator("#signin-status")).toContainText(
    "configuration could not be loaded",
  );
});

test("bilingual review, distinct frame counts, parallel text/planning, original image references and paid feedback revisions", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await pagesFixture(page);
  await login(page);
  await page.locator("#example-button").click();
  const language = page.locator(".topbar [data-ui-language]");
  await language.selectOption("uk");
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  await expect(page.locator("#generate-button")).toContainText("Створити");
  await language.selectOption("en");
  for (const input of await page
    .locator('[name="formats"], [name="languages"]')
    .all())
    await input.uncheck();
  await page.locator('[name="formats"][value="instagram_post"]').check();
  await page.locator('[name="formats"][value="instagram_story"]').check();
  await page.locator('[name="languages"][value="en"]').check();
  await page.locator("#quantity-instagram_post").fill("4");
  await page.locator("#quantity-instagram_story").fill("2");
  await expect(page.locator("#output-count")).toHaveText("6");
  await page.locator("#date-mode").selectOption("range");
  await page.locator("#date-end").fill("2026-11-28");
  await page.locator("#date-mode").selectOption("list");
  await page.locator("#date-text").fill("21, 23 and 28 November 2026");
  await expect(page.locator("#date")).toBeHidden();
  await page.locator("#date-mode").selectOption("text");
  await page.locator("#date-text").fill("Every Tuesday in November 2026");
  // A single event photo may appear in only one Instagram frame, across feed and Stories.
  const photo = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 48;
    c.height = 48;
    const x = c.getContext("2d");
    x.fillStyle = "#EF958C";
    x.fillRect(0, 0, 48, 48);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.locator("#photo-upload").setInputFiles({
    name: "event.png",
    mimeType: "image/png",
    buffer: Buffer.from(photo, "base64"),
  });
  await page.locator("#connect-key").click();
  await page.locator("#openai-key").fill("test-revision-key");
  await page.locator("#save-connection").click();
  const requests = await mockOpenAI(page, {
    key: "test-revision-key",
    holdCopyUntilImage: true,
  });
  await page.locator("#generate-button").click();
  await expect(page.locator("#run-mode-label")).toContainText("COMPLETED", {
    timeout: 45000,
  });
  await expect(page.locator(".output-image")).toHaveCount(6);
  await expect(page.locator("#download-zip")).toBeDisabled();
  expect(requests.text).toHaveLength(2);
  expect(requests.images).toHaveLength(6);
  expect(
    requests.images.filter((request) =>
      request.input.references.some((ref) =>
        ref.role.startsWith("ASSIGNED_EVENT_PHOTO"),
      ),
    ),
  ).toHaveLength(1);
  expect(requests.images[0].files).toHaveLength(2);
  expect(
    requests.images.slice(1).every((request) => request.files.length === 1),
  ).toBe(true);
  expect(
    requests.images.every(
      (request) =>
        request.input.event.dateText === "Every Tuesday in November 2026",
    ),
  ).toBe(true);
  await approvePack(page);
  const post = page.locator(".post-review-card").first();
  await post.locator("textarea").fill("A shared, reviewed carousel caption.");
  await expect(page.locator("#download-zip")).toBeDisabled();
  await post.locator(".approve-post").click();
  await expect(page.locator("#download-zip")).toBeEnabled();
  await expect(page.locator("#history-list button")).toHaveCount(2);
  const target = page.locator(".output-card").nth(1);
  await target
    .locator(".visual-feedback")
    .fill("Make the heading larger and use more cyan.");
  await expect(target.locator(".approve-visual")).toBeDisabled();
  await expect(page.locator("#download-zip")).toBeDisabled();
  await target.locator(".regenerate-visual").click();
  await expect(page.locator("#run-mode-label")).toContainText("COMPLETED", {
    timeout: 45000,
  });
  await expect(page.locator("#download-zip")).toBeDisabled();
  expect(requests.text).toHaveLength(2);
  expect(requests.images).toHaveLength(7);
  const revision = requests.images.at(-1);
  expect(revision.input.revisionInstructions).toBe(
    "Make the heading larger and use more cyan.",
  );
  expect(revision.input.references[0].role).toContain("PREVIOUS_VISUAL");
  expect(revision.files).toHaveLength(2);
  await expect(page.locator("#history-list button")).toHaveCount(3);
  await page.locator(".output-card").nth(1).locator(".approve-visual").click();
  await expect(page.locator("#download-zip")).toBeEnabled();
  await language.selectOption("uk");
  await expect(page.locator(".post-copy-editor").first()).toHaveValue(
    "A shared, reviewed carousel caption.",
  );
  await language.selectOption("en");
  const download = page.waitForEvent("download");
  await page.locator("#download-zip").click();
  const archive = await download,
    path = testInfo.outputPath("approved-carousel.zip");
  await archive.saveAs(path);
  const files = unzipSync(new Uint8Array(await readFile(path))),
    manifest = JSON.parse(strFromU8(files["manifest.json"]));
  expect(manifest.reviewRequired).toBe(true);
  expect(manifest.outputs.every((output) => output.approved)).toBe(true);
  expect(manifest.posts.every((post) => post.approved)).toBe(true);
  expect(manifest.outputs[1].revisions[0].instructions).toContain("more cyan");
  expect(strFromU8(files["instagram_post/en/post.txt"])).toBe(
    "A shared, reviewed carousel caption.",
  );
  expect(strFromU8(files["posts.txt"])).toContain(
    "A shared, reviewed carousel caption.",
  );
  expect(
    Object.keys(files).filter((name) => name.endsWith(".png")),
  ).toHaveLength(6);
  await page.locator("#history-list button").last().click();
  await expect(page.locator(".post-copy-editor").first()).toHaveValue(
    "instagram_post-en — Creative Lab",
  );
  expect(errors).toEqual([]);
});

test("an image failure keeps text and other previews, blocks ZIP and retries only the selected image", async ({
  page,
}) => {
  await pagesFixture(page);
  await login(page);
  await page.locator("#example-button").click();
  await page.locator("#connect-key").click();
  await page.locator("#openai-key").fill("test-failure-key");
  await page.locator("#save-connection").click();
  const requests = await mockOpenAI(page, {
    failVisualOnce: "instagram_post-en-1",
  });
  await page.locator("#generate-button").click();
  await expect(page.locator("#run-mode-label")).toContainText("PARTIAL", {
    timeout: 45000,
  });
  await expect(page.locator(".output-image")).toHaveCount(3);
  await expect(page.locator(".post-copy-editor")).toHaveCount(4);
  await expect(page.locator("#download-zip")).toBeDisabled();
  expect(requests.images).toHaveLength(4);
  await page
    .locator(".output-card")
    .first()
    .locator(".regenerate-visual")
    .click();
  await expect(page.locator("#run-mode-label")).toContainText("COMPLETED", {
    timeout: 45000,
  });
  await expect(page.locator(".output-image")).toHaveCount(4);
  expect(requests.images).toHaveLength(5);
  expect(requests.text).toHaveLength(2);
  await expect(page.locator("#download-zip")).toBeDisabled();
  await approvePack(page);
});

test("copy length errors keep real AI images and are repaired locally before approval", async ({
  page,
}) => {
  await pagesFixture(page);
  await login(page);
  await page.locator("#example-button").click();
  await page.locator("#connect-key").click();
  await page.locator("#openai-key").fill("test-caption-key");
  await page.locator("#save-connection").click();
  const requests = await mockOpenAI(page, { longPost: true });
  await page.locator("#generate-button").click();
  await expect(page.locator("#run-mode-label")).toContainText("PARTIAL", {
    timeout: 45000,
  });
  await expect(page.locator(".output-image")).toHaveCount(4);
  await expect(
    page.locator(".post-review-card").first().locator(".review-error"),
  ).toContainText("limit 650");
  await expect(page.locator("#download-zip")).toBeDisabled();
  await page
    .locator(".post-copy-editor")
    .first()
    .fill("Reviewed and concise event post.");
  await page.locator(".approve-post").first().click();
  await expect(page.locator("#run-mode-label")).toContainText("COMPLETED");
  await approvePack(page);
  expect(requests.text).toHaveLength(2);
  expect(requests.images).toHaveLength(4);
});

test("cancellation aborts active image work and never starts queued images", async ({
  page,
}) => {
  await pagesFixture(page);
  await login(page);
  await page.locator("#example-button").click();
  await page.locator("#connect-key").click();
  await page.locator("#openai-key").fill("test-cancel-key");
  await page.locator("#save-connection").click();
  await mockOpenAI(page);
  const held = [];
  await page.route("https://api.openai.com/v1/images/edits", (route) => {
    held.push(route);
  });
  await page.locator("#generate-button").click();
  await expect.poll(() => held.length).toBe(2);
  await page.locator("#cancel-generation").click();
  await expect(page.locator("#run-mode-label")).toContainText("CANCELLED", {
    timeout: 10000,
  });
  expect(held).toHaveLength(2);
  await expect(page.locator("#download-zip")).toBeDisabled();
  await Promise.all(held.map((route) => route.abort().catch(() => {})));
});

test("a planner failure preserves independently generated posts and sends no image requests", async ({
  page,
}) => {
  await pagesFixture(page);
  await login(page);
  await page.locator("#example-button").click();
  await page.locator("#connect-key").click();
  await page.locator("#openai-key").fill("test-planner-failure-key");
  await page.locator("#save-connection").click();
  const requests = await mockOpenAI(page);
  await page.route(
    "https://api.openai.com/v1/chat/completions",
    async (route) => {
      if (
        route.request().postDataJSON().response_format.json_schema.name ===
        "visual_storyboard"
      )
        await route.fulfill({
          status: 500,
          json: { error: { message: "private provider details" } },
        });
      else await route.fallback();
    },
  );
  await page.locator("#generate-button").click();
  await expect(page.locator("#run-mode-label")).toContainText("PARTIAL", {
    timeout: 15000,
  });
  await expect(page.locator(".post-copy-editor")).toHaveCount(4);
  await expect(page.locator(".output-image")).toHaveCount(0);
  await expect(page.locator("#download-zip")).toBeDisabled();
  expect(requests.images).toHaveLength(0);
  expect(requests.text).toHaveLength(1);
  await expect(page.locator("#run-error")).not.toContainText(
    "private provider details",
  );
});

test("new Pages template packs also require image and text approval without sending any AI request", async ({
  page,
}) => {
  await pagesFixture(page);
  await login(page);
  await page.locator("#example-button").click();
  await page.locator("#generation-mode").selectOption("template");
  let requests = 0;
  await page.route("https://api.openai.com/**", (route) => {
    requests++;
    return route.abort();
  });
  await page.locator("#generate-button").click();
  await expect(page.locator("#run-mode-label")).toContainText("COMPLETED", {
    timeout: 45000,
  });
  await expect(page.locator("#download-zip")).toBeDisabled();
  await approvePack(page);
  expect(requests).toBe(0);
});

test("AI finalization preserves original logo pixels and exact social PNG dimensions", async ({
  page,
}, testInfo) => {
  await pagesFixture(page);
  await login(page);
  await page.locator("#example-button").click();
  await page.locator("#logo-list .remove-asset").click();
  const buffers = [];
  for (const color of ["#E60036", "#00A6EB"])
    buffers.push(
      await page.evaluate((color) => {
        const c = document.createElement("canvas");
        c.width = 32;
        c.height = 32;
        const x = c.getContext("2d");
        x.fillStyle = color;
        x.fillRect(0, 0, 32, 32);
        return c.toDataURL("image/png").split(",")[1];
      }, color),
    );
  await page
    .locator("#logo-upload")
    .setInputFiles(
      buffers.map((data, index) => ({
        name: `original-logo-${index}.png`,
        mimeType: "image/png",
        buffer: Buffer.from(data, "base64"),
      })),
    );
  await expect(page.locator("#logo-list .asset-item")).toHaveCount(2);
  await page.locator('[name="formats"][value="facebook"]').uncheck();
  await page.locator('[name="languages"][value="uk"]').uncheck();
  await page.locator("#connect-key").click();
  await page.locator("#openai-key").fill("test-logo-key");
  await page.locator("#save-connection").click();
  const requests = await mockOpenAI(page);
  await page.locator("#generate-button").click();
  await expect(page.locator("#run-mode-label")).toContainText("COMPLETED", {
    timeout: 45000,
  });
  await approvePack(page);
  const pending = page.waitForEvent("download");
  await page.locator("#download-zip").click();
  const zip = await pending,
    path = testInfo.outputPath("original-logos.zip");
  await zip.saveAs(path);
  const files = unzipSync(new Uint8Array(await readFile(path))),
    manifest = JSON.parse(strFromU8(files["manifest.json"])),
    output = manifest.outputs[0];
  expect(output.imageSource).toBe("openai");
  expect(output.style.logoRects).toHaveLength(2);
  expect(requests.images[0].files).toHaveLength(2);
  const pixels = await page.evaluate(
    async ({ bytes, rects }) => {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(bytes)], { type: "image/png" }),
      );
      const c = document.createElement("canvas");
      c.width = bitmap.width;
      c.height = bitmap.height;
      const x = c.getContext("2d");
      x.drawImage(bitmap, 0, 0);
      const pixels = rects.map((r) =>
        Array.from(
          x.getImageData(
            Math.floor(r.x + r.width / 2),
            Math.floor(r.y + r.height / 2),
            1,
            1,
          ).data,
        ),
      );
      bitmap.close();
      return { width: c.width, height: c.height, pixels };
    },
    {
      bytes: Array.from(files[output.imageFile]),
      rects: output.style.logoRects,
    },
  );
  expect(pixels.width).toBe(1080);
  expect(pixels.height).toBe(1080);
  expect(pixels.pixels).toEqual([
    [230, 0, 54, 255],
    [0, 166, 235, 255],
  ]);
});
