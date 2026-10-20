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
  await page
    .locator("#photo-upload")
    .setInputFiles({
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
  await expect(page.locator("#run-mode-label")).toContainText("CANCELLED");
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
