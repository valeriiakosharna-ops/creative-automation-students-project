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
  let requests = 0;
  await page.route("https://api.openai.com/v1/chat/completions", (route) => {
    requests++;
    const req = route.request(),
      body = req.postDataJSON();
    expect(req.headers().authorization).toBe(`Bearer ${visitKey}`);
    expect(req.postData()).not.toContain(visitKey);
    expect(body.messages[0].content).toContain(
      "Creative Automation Social Style Guide",
    );
    const plan = JSON.parse(body.messages[1].content);
    expect(plan).not.toHaveProperty("assets");
    const outputs = plan.outputs.map((o) => ({
      id: o.id,
      headline: o.language === "uk" ? "Творча лабораторія" : "Creative Lab",
      subheading: "",
      cta: o.language === "uk" ? "Долучайтеся" : "Join us",
      caption: `${o.format} ${o.language} — Creative Lab`,
    }));
    return route.fulfill({
      json: {
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify({ outputs }) },
          },
        ],
      },
    });
  });
  await page.locator("#generate-button").click();
  await expect(page.locator("#run-mode-label")).toContainText("COMPLETED", {
    timeout: 45000,
  });
  expect(requests).toBe(1);
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
