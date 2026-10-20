import { mkdir, readFile, writeFile, copyFile, cp } from "node:fs/promises";
const source = new URL("../../", import.meta.url),
  publicDir = new URL("../public/", import.meta.url),
  target = new URL("brief/", publicDir);
await mkdir(target, { recursive: true });
await writeFile(
  new URL("index.html", target),
  (await readFile(new URL("index.html", source), "utf8"))
    .replaceAll('href="studio/"', 'href="../index.html"')
    .replaceAll('href="style-guide/"', 'href="../style-guide/index.html"'),
);
for (const file of ["styles.css", "script.js"])
  await copyFile(new URL(file, source), new URL(file, target));
await cp(new URL("assets/", source), new URL("assets/", target), {
  recursive: true,
});
for (const file of ["logo.svg", "favicon.svg"])
  await copyFile(new URL(`assets/${file}`, source), new URL(file, publicDir));

const guideDir = new URL("style-guide/", publicDir);
await cp(new URL("style-guide/", source), guideDir, { recursive: true });
const guideHtml = (await readFile(new URL("index.html", guideDir), "utf8"))
  .replaceAll("../assets/", "../brief/assets/")
  .replaceAll('href="../index.html"', 'href="../brief/index.html"')
  .replaceAll('href="../studio/"', 'href="../index.html"')
  .replaceAll("../studio/brand-policy.json", "../brand-policy.json")
  .replaceAll("../studio/QUICKSTART.md", "../quickstart.md");
await writeFile(new URL("index.html", guideDir), guideHtml);
await copyFile(
  new URL("../brand-policy.json", import.meta.url),
  new URL("brand-policy.json", publicDir),
);
const repositoryDocs =
  "https://github.com/valeriiakosharna-ops/creative-automation-students-project/blob/main/";
for (const [input, output] of [
  ["QUICKSTART.md", "quickstart.md"],
  ["RENDER_SETUP.md", "RENDER_SETUP.md"],
])
  await writeFile(
    new URL(output, publicDir),
    (await readFile(new URL(`../${input}`, import.meta.url), "utf8"))
      .replaceAll("(QUICKSTART.md)", "(quickstart.md)")
      .replaceAll("(../DEPLOYMENT.md)", `(${repositoryDocs}DEPLOYMENT.md)`)
      .replaceAll("(../SECURITY.md)", `(${repositoryDocs}SECURITY.md)`),
  );

await writeFile(
  new URL("README.md", guideDir),
  (await readFile(new URL("README.md", guideDir), "utf8"))
    .replaceAll("../studio/brand-policy.json", "../brand-policy.json")
    .replaceAll("../studio/QUICKSTART.md", "../quickstart.md"),
);
