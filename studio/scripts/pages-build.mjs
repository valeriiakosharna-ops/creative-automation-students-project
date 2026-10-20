import { readFile, writeFile } from "node:fs/promises";
const directory = new URL("../dist/", import.meta.url);
const projectId = (process.env.STUDIO_FIREBASE_PROJECT_ID || "").trim();
const apiKey = (process.env.STUDIO_FIREBASE_API_KEY || "").trim();
if (Boolean(projectId) !== Boolean(apiKey))
  throw Error(
    "Set both public Firebase repository variables, or neither for the locked setup page.",
  );
if (
  projectId &&
  (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) ||
    !/^AIza[A-Za-z0-9_-]{20,100}$/.test(apiKey))
)
  throw Error(
    "Use the Firebase project ID and public Firebase web API key. Never put an OpenAI key in build variables.",
  );
const firebase = projectId
  ? { apiKey, projectId, authDomain: `${projectId}.firebaseapp.com` }
  : null;
await writeFile(
  new URL("runtime.js", directory),
  `window.STUDIO_RUNTIME = ${JSON.stringify({ pages: true, serverManaged: false, clientKeysEnabled: true, aiConfigured: false, workspaceStorage: "browser", firebase })};\n`,
);
const frame = firebase
  ? `https://${firebase.authDomain}`
  : "https://*.firebaseapp.com";
const policy = `default-src 'self'; script-src 'self' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.openai.com https://*.googleapis.com ${frame}; frame-src ${frame} https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'self'`;
const html = (await readFile(new URL("index.html", directory), "utf8")).replace(
  "<head>",
  `<head>\n<meta name="studio-build" content="pages">\n<meta http-equiv="Content-Security-Policy" content="${policy}">\n<meta name="referrer" content="no-referrer">`,
);
await writeFile(new URL("index.html", directory), html);
const repository =
  "https://github.com/valeriiakosharna-ops/creative-automation-students-project/blob/main/";
for (const [source, target] of [
  ["PAGES_SETUP.md", "PAGES_SETUP.md"],
  ["QUICKSTART.md", "quickstart.md"],
]) {
  const text = (
    await readFile(new URL(`../${source}`, import.meta.url), "utf8")
  )
    .replaceAll(
      "(firebase/firestore.rules)",
      `(${repository}studio/firebase/firestore.rules)`,
    )
    .replaceAll("(../SECURITY.md)", `(${repository}SECURITY.md)`)
    .replaceAll("(../DEPLOYMENT.md)", `(${repository}DEPLOYMENT.md)`);
  await writeFile(new URL(target, directory), text);
}
console.log(
  firebase
    ? "Pages build ready: Google sign-in with a private Firebase access directory and local-only projects."
    : "Pages build ready: locked setup screen; add the two public Firebase repository variables to enable Google sign-in.",
);
