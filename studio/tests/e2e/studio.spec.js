import { test, expect } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import { readFile } from "node:fs/promises";

async function fixture(page, name, color) {
  const buffer = await page.evaluate(async (color) => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 320, 180);
    return Array.from(
      new Uint8Array(
        await (await new Promise((r) => c.toBlob(r))).arrayBuffer(),
      ),
    );
  }, color);
  return { name, mimeType: "image/png", buffer: Buffer.from(buffer) };
}
async function example(page) {
  await page.goto("/");
  await expect(page.locator("#current-project-name")).toHaveText(
    "My first campaign",
  );
  await page.locator("#example-button").click();
  await expect(page.locator("#logo-list .asset-item")).toHaveCount(1);
}
async function generate(page) {
  await page.locator("#generate-button").click();
  await expect(page.locator("#run-mode-label")).toContainText("COMPLETED", {
    timeout: 45000,
  });
}

test("real PNGs, all logos, multilingual per-channel copy, unique photo use, ZIP and durable history", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await example(page);
  await page.locator("#logo-list .remove-asset").click();
  const logo1 = await fixture(page, "logo-red.png", "#f03030"),
    logo2 = await fixture(page, "logo-blue.png", "#1030e0");
  await page.locator("#logo-upload").setInputFiles([logo1, logo2]);
  await expect(page.locator("#logo-list .asset-item")).toHaveCount(2);
  const photo1 = await fixture(page, "photo-green.png", "#2d9d44"),
    photo2 = await fixture(page, "photo-orange.png", "#d97520");
  await page.locator("#photo-upload").setInputFiles([photo1, photo2]);
  await expect(page.locator("#photo-list .asset-item")).toHaveCount(2);
  await page.locator("#photo-upload").setInputFiles(photo1);
  await expect(page.locator("#notice")).toContainText("already in your photos");
  await page.locator("#photo-upload").setInputFiles({
    name: "unsafe.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(page.locator("#notice")).toContainText("genuine PNG");
  for (const checkbox of await page.locator('[name="languages"]').all())
    await checkbox.uncheck();
  await page.locator("#generate-button").click();
  await expect(page.locator("#form-errors")).toContainText("Choose English");
  for (const checkbox of await page
    .locator('[name="languages"], [name="formats"]')
    .all())
    await checkbox.check();
  await page.locator("#variants").selectOption("2");
  await expect(page.locator("#output-count")).toHaveText("16");
  await expect(page.locator("#photo-count")).toHaveText("6");
  await generate(page);
  await expect(page.locator(".output-image")).toHaveCount(16);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download-zip").click();
  const dl = await downloadPromise;
  const archivePath = testInfo.outputPath(dl.suggestedFilename());
  await dl.saveAs(archivePath);
  const files = unzipSync(new Uint8Array(await readFile(archivePath))),
    manifest = JSON.parse(strFromU8(files["manifest.json"]));
  expect(manifest.outputs).toHaveLength(16);
  expect(manifest.styleGuideVersion).toBe("1.0.0");
  expect(JSON.parse(strFromU8(files["style-guide.json"])).version).toBe(
    "1.0.0",
  );
  expect(manifest.assets.logos).toHaveLength(2);
  for (const network of ["instagram", "facebook", "google_chat"]) {
    const used = manifest.outputs
      .filter((o) => o.network === network && o.photoId)
      .map((o) => o.photoId);
    expect(used).toHaveLength(2);
    expect(new Set(used).size).toBe(used.length);
  }
  expect(manifest.outputs.filter((o) => !o.photoId)).toHaveLength(10);
  for (const output of manifest.outputs) {
    expect(output.logoIds).toHaveLength(2);
    expect(output.status).toBe("completed");
    expect(output.style.version).toBe("1.0.0");
    const content = output.style.contentRect,
      shelf = output.style.logoShelf;
    expect(shelf.y + shelf.height).toBeLessThanOrEqual(
      output.height - output.style.safeArea.bottom,
    );
    expect(shelf.x).toBeGreaterThanOrEqual(output.style.safeArea.left);
    for (const rect of output.style.logoRects) {
      expect(rect.y).toBeGreaterThanOrEqual(content.y);
      expect(rect.y + rect.height).toBeLessThanOrEqual(
        content.y + content.height + 1,
      );
    }
    if (output.format === "instagram_story")
      expect(output.style.safeArea).toEqual({
        left: 90,
        right: 90,
        top: 250,
        bottom: 320,
      });
    const png = files[output.imageFile],
      header = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(header.getUint32(16)).toBe(output.width);
    expect(header.getUint32(20)).toBe(output.height);
    expect(strFromU8(files[output.captionFile])).toBe(output.caption);
    const colors = await page.evaluate(async (bytes) => {
      const image = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
      const c = document.createElement("canvas");
      c.width = image.width;
      c.height = image.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(image, 0, 0);
      image.close();
      const p = ctx.getImageData(0, 0, c.width, c.height).data;
      let red = 0,
        blue = 0;
      for (let i = 0; i < p.length; i += 4) {
        if (p[i] === 240 && p[i + 1] === 48 && p[i + 2] === 48) red++;
        if (p[i] === 16 && p[i + 1] === 48 && p[i + 2] === 224) blue++;
      }
      return { red, blue };
    }, Array.from(png));
    expect(colors.red).toBeGreaterThan(100);
    expect(colors.blue).toBeGreaterThan(100);
  }
  expect(
    new Set(
      manifest.outputs
        .filter((o) => o.language === "en" && o.variant === 1)
        .map((o) => o.caption),
    ).size,
  ).toBe(4);
  await page.reload();
  await page.locator("#history-list button").first().click();
  await expect(page.locator(".output-image")).toHaveCount(16);
  await page.locator("#result-filter").selectOption("uk");
  await expect(page.locator(".output-image")).toHaveCount(8);
  await page.locator(".output-image").first().click();
  await expect(page.locator("#output-caption")).toHaveValue(/Створюйте/);
  await page.locator("#output-dialog .close-dialog").click();
  await page.locator("#reuse-brief").click();
  await page.locator("#title").fill("Second campaign");
  for (const cb of await page.locator('[name="formats"]').all())
    await cb.uncheck();
  await page.locator('[name="formats"][value="facebook"]').check();
  await page.locator('[name="languages"][value="uk"]').uncheck();
  await page.locator("#variants").selectOption("1");
  await generate(page);
  await expect(page.locator("#history-list button")).toHaveCount(2);
  await page.locator("#history-list button").nth(1).click();
  await expect(page.locator("#run-summary")).toContainText(
    "Creative Automation Lab",
  );
  expect(errors).toEqual([]);
});

test("projects are isolated, rename/delete works, drafts survive reload, responsive layout and keyboard dialog", async ({
  page,
}) => {
  await example(page);
  await page.locator("#new-project").click();
  await page.locator("#project-name").fill("Winter School");
  await page.locator('#project-form button[type="submit"]').click();
  await expect(page.locator("#current-project-name")).toHaveText(
    "Winter School",
  );
  await expect(page.locator("#title")).toHaveValue("");
  await expect(page.locator("#logo-list .asset-item")).toHaveCount(0);
  await page.locator("#title").fill("My saved draft");
  await page.waitForTimeout(700);
  await page.reload();
  await page
    .getByRole("button", { name: "Winter School", exact: false })
    .first()
    .click();
  await expect(page.locator("#title")).toHaveValue("My saved draft");
  await page.locator("#rename-project").click();
  await page.locator("#project-name").fill("Winter Lab");
  await page.locator('#project-form button[type="submit"]').click();
  await expect(page.locator("#current-project-name")).toHaveText("Winter Lab");
  for (const width of [1440, 1024, 768, 600, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  await page.locator("#toggle-sidebar").click();
  await expect(page.locator("#toggle-sidebar")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#toggle-sidebar")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.locator("#delete-project").click();
  await expect(page.locator("#delete-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#delete-dialog")).not.toBeVisible();
  await page.locator("#delete-project").click();
  await page.locator("#confirm-delete").click();
  await expect(page.locator("#project-count")).toHaveText("1");
  await expect(page.locator("#current-project-name")).toHaveText(
    "My first campaign",
  );
  await expect(page.locator("#title")).toHaveValue("Creative Automation Lab");
});

test("AI errors are saved as failures with no silent template fallback", async ({
  page,
}) => {
  await example(page);
  await page.route("**/api/copy", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        message: "AI is not configured. Set the server API key.",
      }),
    }),
  );
  await page.locator("#generation-mode").selectOption("ai");
  await page.locator("#generate-button").click();
  await expect(page.locator("#run-mode-label")).toContainText("FAILED");
  await expect(page.locator("#run-error")).toContainText(
    "AI is not configured",
  );
  await expect(page.locator(".output-image")).toHaveCount(0);
  await expect(page.locator("#download-zip")).toBeDisabled();
  await page.reload();
  await page.locator("#history-list button").click();
  await expect(page.locator("#run-error")).toContainText(
    "AI is not configured",
  );
});

test("AI response is used for visuals/captions, cancellation and interrupted-run recovery are visible", async ({
  page,
}) => {
  await example(page);
  await page.route("**/api/copy", async (route) => {
    const request = route.request().postDataJSON();
    await route.fulfill({
      json: {
        model: "mock-model",
        styleGuideVersion: "1.0.0",
        outputs: request.outputs.map((o) => ({
          id: o.id,
          headline:
            o.language === "uk" ? "Зустріч студентів" : "Student meetup",
          subheading: "",
          cta: o.language === "uk" ? "Долучайтеся" : "Join us",
          caption:
            o.language === "uk"
              ? "Український допис для події."
              : "An English post for the event.",
        })),
      },
    });
  });
  await page.locator("#generation-mode").selectOption("ai");
  await generate(page);
  await page.locator(".output-image").first().click();
  await expect(page.locator("#output-caption")).toHaveValue(
    "An English post for the event.",
  );
  await page.locator("#output-dialog .close-dialog").click();
  await page.locator("#reuse-brief").click();
  await page.locator("#generation-mode").selectOption("template");
  for (const cb of await page.locator('[name="formats"]').all())
    await cb.check();
  await page.locator("#variants").selectOption("3");
  await page.locator("#generate-button").click();
  await expect(page.locator("#generation-progress")).toBeVisible();
  await page.locator("#cancel-generation").click();
  // Cancellation finishes an in-flight PNG encode before saving the final run.
  await expect(page.locator("#run-mode-label")).toContainText("CANCELLED", {
    timeout: 45000,
  });
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const r = indexedDB.open("creative-automation-studio");
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction("runs", "readwrite"),
          store = tx.objectStore("runs"),
          all = store.getAll();
        all.onsuccess = () => {
          const run = all.result[0];
          run.status = "running";
          store.put(run);
        };
        tx.oncomplete = resolve;
        tx.onerror = reject;
      };
    });
  });
  await page.reload();
  await expect(page.locator("#history-list")).toContainText("interrupted");
});

test("a Story photo and every logo stay inside the guide; too-long text fails at the font floor", async ({
  page,
}, testInfo) => {
  await example(page);
  for (const cb of await page.locator('[name="formats"]').all())
    await cb.uncheck();
  await page.locator('[name="formats"][value="instagram_story"]').check();
  await page.locator('[name="languages"][value="uk"]').uncheck();
  await page
    .locator("#photo-upload")
    .setInputFiles(await fixture(page, "story-photo.png", "#2d9d44"));
  await expect(page.locator("#photo-list .asset-item")).toHaveCount(1);
  await generate(page);
  const pending = page.waitForEvent("download");
  await page.locator("#download-zip").click();
  const dl = await pending;
  const path = testInfo.outputPath("story.zip");
  await dl.saveAs(path);
  const files = unzipSync(new Uint8Array(await readFile(path))),
    manifest = JSON.parse(strFromU8(files["manifest.json"])),
    output = manifest.outputs[0];
  expect(output.photoId).toBeTruthy();
  expect(output.style.photoRect.y).toBeGreaterThanOrEqual(250);
  expect(
    output.style.photoRect.y + output.style.photoRect.height,
  ).toBeLessThanOrEqual(output.style.logoShelf.y);
  expect(
    output.style.logoShelf.y + output.style.logoShelf.height,
  ).toBeLessThanOrEqual(1600);
  expect(output.style.text.headline.fontSize).toBeGreaterThanOrEqual(60);
  expect(output.style.text.headline.family).toBe("Arial, sans-serif");
  await page.locator("#reuse-brief").click();
  await page.locator(".localized-copy summary").click();
  await page.locator("#titleEn").fill("W".repeat(80));
  await page.locator("#generate-button").click();
  await expect(page.locator("#run-mode-label")).toContainText("FAILED");
  await expect(page.locator(".output-pending.failed")).toContainText(
    "minimum 60px",
  );
  await expect(page.locator("#download-zip")).toBeDisabled();
});

test("hosted Studio needs only a visit key, ignores old backend settings, and never persists or exports that key", async ({
  page,
}, testInfo) => {
  const key = "visitor-test-key-never-a-real-secret";
  await page.addInitScript(() =>
    localStorage.setItem("studio:backend", "http://127.0.0.1:9999"),
  );
  await page.route("**/runtime.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "window.STUDIO_RUNTIME={serverManaged:true,clientKeysEnabled:true,aiConfigured:false};",
    }),
  );
  let calls = 0;
  await page.route("**/api/copy", async (route) => {
    calls++;
    expect(new URL(route.request().url()).origin).toBe("http://127.0.0.1:4173");
    expect(route.request().headers()["x-openai-key"]).toBe(key);
    expect(route.request().postData()).not.toContain(key);
    const request = route.request().postDataJSON();
    await route.fulfill({
      json: {
        model: "mock-model",
        styleGuideVersion: "1.0.0",
        outputs: request.outputs.map((o) => ({
          id: o.id,
          headline:
            o.language === "uk" ? "Зустріч студентів" : "Student meetup",
          subheading: "",
          cta: "Join",
          caption:
            o.language === "uk"
              ? "Вітаємо на події!"
              : "Join our student event.",
        })),
      },
    });
  });
  await example(page);
  await expect(page.locator("#generation-mode")).toHaveValue("ai");
  await page.locator("#generate-button").click();
  await expect(page.locator("#settings-dialog")).toBeVisible();
  await expect(page.locator("#backend-field")).toBeHidden();
  expect(calls).toBe(0);
  await page.locator("#openai-key").fill(key);
  await page.locator("#save-connection").click();
  await expect(page.locator("#settings-dialog")).not.toBeVisible();
  await expect(page.locator("#openai-key")).toHaveValue("");
  await generate(page);
  expect(calls).toBe(1);
  const pending = page.waitForEvent("download");
  await page.locator("#download-zip").click();
  const dl = await pending,
    path = testInfo.outputPath("hosted.zip");
  await dl.saveAs(path);
  const files = unzipSync(new Uint8Array(await readFile(path)));
  for (const name of ["manifest.json", "brief.json", "style-guide.json"])
    expect(strFromU8(files[name])).not.toContain(key);
  const persisted = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("creative-automation-studio");
      r.onsuccess = () => resolve(r.result);
      r.onerror = reject;
    });
    const contents = await Promise.all(
      ["projects", "drafts", "runs"].map(
        (name) =>
          new Promise((resolve, reject) => {
            const r = db.transaction(name).objectStore(name).getAll();
            r.onsuccess = () => resolve(r.result);
            r.onerror = reject;
          }),
      ),
    );
    return JSON.stringify([
      contents,
      { ...localStorage },
      { ...sessionStorage },
    ]);
  });
  expect(persisted).not.toContain(key);
  await page.reload();
  await expect(page.locator("#connect-key")).toHaveText("Connect OpenAI");
  await page.locator("#generate-button").click();
  await expect(page.locator("#settings-dialog")).toBeVisible();
  expect(calls).toBe(1);
  await page.locator("#openai-key").fill(key);
  await page.locator("#save-connection").click();
  await page.locator("#connect-key").click();
  await page.locator("#forget-key").click();
  await expect(page.locator("#key-status")).toContainText("No key connected");
  await expect(page.locator("#connect-key")).toHaveText("Connect OpenAI");
});

test("corporate owner grants/revokes access; colleagues share server projects without local storage or API keys", async ({
  browser,
}, testInfo) => {
  const library = new Map(),
    binaries = new Map();
  const members = new Map([
    [
      "owner@team.example",
      { email: "owner@team.example", owner: true, active: true },
    ],
  ]);
  async function corporatePage(context, owner) {
    const page = await context.newPage();
    const email = owner ? "owner@team.example" : "member@team.example";
    await page.route("**/runtime.js", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: 'window.STUDIO_RUNTIME={serverManaged:true,clientKeysEnabled:false,aiConfigured:true,corporate:true,workspaceStorage:"server"};',
      }),
    );
    await page.route("**/api/**", async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        method = request.method();
      const send = (status, json) => route.fulfill({ status, json });
      if (!members.get(email)?.active)
        return send(403, { message: "Corporate access is not available." });
      if (method !== "GET")
        expect(request.headers()["x-csrf-token"]).toBe("test-corporate-csrf");
      expect(request.headers()["x-openai-key"]).toBeUndefined();
      if (url.pathname === "/api/session")
        return send(200, {
          email,
          csrfToken: "test-corporate-csrf",
          csrfHeader: "X-CSRF-TOKEN",
          workspace: "shared",
          canManageAccess: owner,
        });
      if (url.pathname.startsWith("/api/access")) {
        if (!owner) return send(403, { message: "Owner only" });
        if (method === "POST") {
          const value = request.postDataJSON().email;
          members.set(value, {
            email: value,
            owner: false,
            active: !url.pathname.endsWith("/revoke"),
          });
        }
        return send(200, [...members.values()]);
      }
      const pieces = url.pathname.split("/").slice(3),
        [store, id, kind, blob] = pieces;
      if (!["projects", "drafts", "runs"].includes(store)) return send(404, {});
      const key = store + "/" + id;
      if (method === "GET") {
        if (!id)
          return send(
            200,
            [...library.entries()]
              .filter(([key]) => key.startsWith(store + "/"))
              .map(([, value]) => value),
          );
        if (kind === "blobs")
          return route.fulfill({
            status: 200,
            contentType: "image/png",
            body: Buffer.from(binaries.get(key + "/" + blob)),
          });
        return library.has(key) ? send(200, library.get(key)) : send(404, {});
      }
      if (method === "POST") {
        const previous = library.get(key),
          expected = Number(request.headers()["if-match"].replaceAll('"', ""));
        if (expected !== (previous?.version || 0))
          return send(409, {
            message: "A colleague updated this record. Reload the project.",
          });
        const files = unzipSync(new Uint8Array(request.postDataBuffer())),
          record = JSON.parse(strFromU8(files["record.json"]));
        for (const [name, data] of Object.entries(files))
          if (name.startsWith("blobs/"))
            binaries.set(key + "/" + name.slice(6), data);
        const saved = { version: expected + 1, record };
        library.set(key, saved);
        return send(200, saved);
      }
      return send(404, {});
    });
    return page;
  }
  const ownerContext = await browser.newContext(),
    memberContext = await browser.newContext();
  try {
    const owner = await corporatePage(ownerContext, true);
    await example(owner);
    await expect(owner.locator("#connect-key")).toBeHidden();
    await expect(owner.locator("#sign-out")).toBeVisible();
    await owner.setViewportSize({ width: 320, height: 900 });
    await owner.locator("#toggle-sidebar").click();
    await owner.locator("#manage-access").click();
    expect(
      await owner.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await owner.screenshot({
      path: testInfo.outputPath("team-access-mobile.png"),
    });
    await owner.locator("#colleague-email").fill("member@team.example");
    await owner.locator('#access-form button[type="submit"]').click();
    await expect(owner.locator("#access-status")).toContainText(
      "Access enabled",
    );
    await expect(owner.locator(".access-member")).toHaveCount(2);
    await owner.locator("#access-dialog .close-dialog").click();
    await owner.setViewportSize({ width: 1280, height: 900 });
    await owner.locator("#generation-mode").selectOption("template");
    await generate(owner);
    const member = await corporatePage(memberContext, false);
    await member.goto("/");
    await expect(member.locator("#current-project-name")).toHaveText(
      "My first campaign",
    );
    await expect(member.locator("#title")).toHaveValue(
      "Creative Automation Lab",
    );
    await expect(member.locator("#manage-access")).toBeHidden();
    await expect(member.locator("#connect-key")).toBeHidden();
    await member.locator("#history-list button").click();
    await expect(member.locator(".output-image")).toHaveCount(4);
    const pending = member.waitForEvent("download");
    await member.locator("#download-zip").click();
    const dl = await pending,
      path = testInfo.outputPath("shared-private.zip");
    await dl.saveAs(path);
    const files = unzipSync(new Uint8Array(await readFile(path)));
    expect(JSON.parse(strFromU8(files["manifest.json"])).outputs).toHaveLength(
      4,
    );
    expect(
      await owner.evaluate(async () => await indexedDB.databases()),
    ).toHaveLength(0);
    expect(
      await member.evaluate(async () => await indexedDB.databases()),
    ).toHaveLength(0);
    expect(
      await member.evaluate(() => JSON.stringify({ ...localStorage })),
    ).not.toContain("Creative Automation Lab");
    await owner.locator("#manage-access").click();
    await owner
      .locator(".access-member")
      .filter({ hasText: "member@team.example" })
      .getByRole("button", { name: "Revoke access" })
      .click();
    await expect(owner.locator("#access-status")).toContainText(
      "Access revoked",
    );
    expect(
      await member.evaluate(
        async () => (await fetch("/api/workspace/projects")).status,
      ),
    ).toBe(403);
    await member.reload();
    await expect(member.locator("#notice")).toContainText(
      "corporate session is unavailable",
    );
  } finally {
    await ownerContext.close();
    await memberContext.close();
  }
});
