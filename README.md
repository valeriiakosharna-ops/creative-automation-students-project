# Creative Automation · Student Project

A responsive, English-language project brief for students learning Java and JavaScript. It covers the product, user journey, MVP, architecture, implementation milestones, and acceptance criteria. The interactive brief explorer is an educational example; it does not call AI services or store uploads.

## Social style guide and launch instructions

The separate [social style guide](style-guide/README.md) covers our palette, original logo/icon, format-specific composition and English/Ukrainian copy. Its shared [generation policy](studio/brand-policy.json) drives visual rendering and Java AI instructions. Follow [MVP Quickstart](studio/QUICKSTART.md) for browser-only hosted use: deploy once, open the site and paste your key for the visit.

## Working MVP

The separate application is in [`studio/`](studio/README.md): project folders, local history, original-logo composition, unique photo allocation per social network, English/Ukrainian output, channel-specific captions, and ZIP export. It builds independently and is published under `studio/` alongside this brief. The hosted version packages frontend and Java AI server into one container. Visitors paste their own API key in the site; no local installation is needed. Keys stay in page memory and are sent only to that deployment for the provider request.

## Use the MVP without installing anything

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fvaleriiakosharna-ops%2Fcreative-automation-students-project)

After the hosting changes are merged, deploy the repository using this button, sign in to Render and confirm the service. Render builds and starts the full app and gives it an HTTPS URL. Open that URL → **Connect OpenAI** → paste your API key → **Use key for this visit**. No Java, Node.js, terminal, backend URL, or secret committed to Git is needed. Template mode needs no key. See [Quickstart](studio/QUICKSTART.md) for step by step instructions and free-service limitations.

GitHub Pages and GitLab Pages remain static demo/documentation sites. The complete AI app runs on Render or your company's container hosting. [Internal GitLab deployment](DEPLOYMENT.md) uses the same Dockerfile and bundled frontend/server. GitHub and GitLab CI build and verify the image; placing code in a repository alone does not provision a server.

## Preview the student brief locally (optional)

The student brief has no dependencies. From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000`. All asset paths also work under a GitHub Pages repository subpath.

## Automatic deployment

`.github/workflows/pages.yml` validates and builds the static site on pull requests. Every push to `main` rebuilds and deploys it to GitHub Pages. Manual deployment is available from `main`.

In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. The workflow uses GitHub's built-in token; no deployment secret is required. Pull requests build without deploying. The Pages workflow also installs and builds the Studio frontend with Node.js 24. The `deploy` job reports the published URL after deployment succeeds.

This brief is static. The working Studio frontend is also included in the Pages build. Its optional Java AI server needs separate hosting; GitHub Pages cannot run Spring Boot.

## Branding

- Replace `assets/logo.svg` with the corporate logo, keeping the filename.
- Replace `assets/favicon.svg` with the favicon, keeping the filename, or update the icon link in `index.html` for another format.
- All eight corporate colors are CSS custom properties at the start of `styles.css`.

No external fonts, analytics, CDN scripts, API credentials, or runtime packages are used.

## Editing and validation

- `index.html`: English project brief and learning content.
- `styles.css`: brand palette, responsive design, and print layout.
- `script.js`: sample brief, mobile navigation, milestone tabs, and checklist.

The example brief lives only in memory. The self-assessment checklist is stored in this browser's local storage. **Reset checklist** clears it. No form data leaves the page.

```sh
node --check script.js
python3 scripts/check_site.py
```

The checker verifies HTML parsing, internal navigation, linked local assets, form labels, and unique IDs. Also verify mobile navigation, milestone tabs, brief validation, checklist persistence/reset, and small-screen overflow in a browser.
