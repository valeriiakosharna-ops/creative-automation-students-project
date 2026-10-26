import { test, expect } from "@playwright/test";

for (const width of [1440, 1024, 768, 390]) {
  test(`Studio layout and English UI remain usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() =>
      localStorage.setItem("studio:ui-language", "uk"),
    );
    await page.goto("/");
    // Generic test build uses the local template workflow, not a production auth bypass.
    await expect(page.locator("#title")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("[data-ui-language]")).toHaveCount(0);
    await expect(page.locator(".workflow-steps a")).toHaveCount(4);
    await expect(page.locator(".format-option")).toHaveCount(4);
    await expect(page.locator("#quantity-instagram_post")).toBeEnabled();
    await expect(page.locator("#quantity-facebook")).toBeDisabled();
    await page.locator('[name="formats"][value="facebook"]').check();
    await expect(page.locator("#quantity-facebook")).toBeEnabled();
    await page.locator("#quantity-facebook").fill("3");
    await page.locator('[name="languages"][value="en"]').check();
    await page.locator('[name="languages"][value="uk"]').check();
    await expect(page.locator("#pack-total")).toHaveText(
      "8 visuals · 4 shared post captions",
    );
    await expect(
      page.locator('[name="languages"][value="uk"]').locator(".."),
    ).toContainText("Ukrainian");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const selector of [
      ".panel",
      ".format-option",
      ".pack-sticky",
      ".workflow-steps",
    ]) {
      for (const item of await page.locator(selector).all()) {
        const box = await item.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
    }
    if (width < 950) {
      await page.locator("#toggle-sidebar").click();
      await expect(page.locator("#sidebar")).toHaveClass(/open/);
      await page
        .locator("#sidebar-overlay")
        .click({ position: { x: width - 10, y: 10 } });
      await expect(page.locator("#toggle-sidebar")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    }
  });
}

test("the assignment has one MVP, two full-product additions and short implementation steps", async ({
  page,
  request,
}) => {
  await page.goto("/brief/index.html");
  await expect(page.locator("main > section")).toHaveCount(3);
  await expect(page.locator("main h2")).toHaveText([
    "MVP requirements",
    "Full product requirements",
    "Implementation steps",
  ]);
  await expect(page.locator("#mvp")).toContainText("Java backend");
  await expect(page.locator("#mvp")).toContainText("database");
  await expect(page.locator("#mvp")).toContainText("shared project library");
  await expect(page.locator("#mvp")).toContainText("three prompt templates");
  await expect(
    page.locator("#full-product .full-requirements > li"),
  ).toHaveCount(2);
  await expect(page.locator("#full-product")).toContainText("Editor role");
  await expect(page.locator("#full-product")).toContainText(
    "visual or post caption",
  );
  const response = await request.get("/brief/docs/PRODUCT_REQUIREMENTS.md");
  expect(response.ok()).toBe(true);
  expect((await response.text()).match(/^## /gm)).toHaveLength(3);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".menu-toggle").click();
  await expect(page.locator(".menu-toggle")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu-toggle")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("requirement demos explain counts, separate AI stages and Editor permissions without API requests", async ({
  page,
}) => {
  const apiCalls = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://api.openai.com/"))
      apiCalls.push(request.url());
  });
  await page.goto("/brief/index.html");
  await page.locator("#count-demo summary").click();
  await expect(page.locator("#demo-count-summary")).toContainText(
    "6 visuals · 2 shared captions · 2 photo frames · 4 information-only",
  );
  await expect(page.locator(".demo-frame.has-photo")).toHaveCount(2);
  await page.locator("#demo-languages").selectOption("1");
  await page.locator("#demo-frames").focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#demo-count-summary")).toContainText(
    "2 visuals · 1 shared caption · 2 photo frames · 0 information-only",
  );
  await page.locator("#demo-photos").focus();
  await page.keyboard.press("Home");
  await expect(page.locator(".demo-frame.has-photo")).toHaveCount(0);
  await page.locator("#pipeline-demo summary").click();
  await page.locator("#demo-run").click();
  await expect(page.locator("#demo-image-status")).toHaveText(
    "Waiting for the plan",
  );
  await expect(page.locator("#demo-image-status")).toHaveText(
    "Visuals ready for review",
  );
  await expect(page.locator("#demo-copy-status")).toHaveText("Caption ready");
  expect(
    JSON.parse(await page.locator("#demo-plan-output").textContent()).frames,
  ).toHaveLength(2);
  await page.locator("#prompt-demo summary").click();
  await expect(page.locator("#demo-prompt-text")).toBeDisabled();
  await page.locator("#demo-role").selectOption("editor");
  await page.locator("#demo-prompt-type").selectOption("copy");
  await page
    .locator("#demo-prompt-text")
    .fill("Use a concise factual post with complete dates.");
  await page.locator("#demo-save-prompt").click();
  await expect(page.locator("#demo-prompt-status")).toContainText(
    "No API call was made",
  );
  await page.locator("#demo-prompt-type").selectOption("plan");
  await page.locator("#demo-prompt-type").selectOption("copy");
  await expect(page.locator("#demo-prompt-text")).toHaveValue(
    "Use a concise factual post with complete dates.",
  );
  await page.locator("#demo-role").selectOption("viewer");
  await expect(page.locator("#demo-prompt-text")).toBeDisabled();
  expect(apiCalls).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
