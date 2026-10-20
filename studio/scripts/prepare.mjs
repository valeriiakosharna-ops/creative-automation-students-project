import { mkdir, readFile, writeFile, copyFile, cp } from "node:fs/promises";
const source = new URL("../../", import.meta.url),
  publicDir = new URL("../public/", import.meta.url),
  target = new URL("brief/", publicDir);
await mkdir(target, { recursive: true });
await writeFile(
  new URL("index.html", target),
  (await readFile(new URL("index.html", source), "utf8")).replaceAll(
    'href="studio/"',
    'href="../index.html"',
  ),
);
for (const file of ["styles.css", "script.js"])
  await copyFile(new URL(file, source), new URL(file, target));
await cp(new URL("assets/", source), new URL("assets/", target), {
  recursive: true,
});
for (const file of ["logo.svg", "favicon.svg"])
  await copyFile(new URL(`assets/${file}`, source), new URL(file, publicDir));
