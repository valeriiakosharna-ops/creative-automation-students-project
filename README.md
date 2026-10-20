# Creative Automation · Student Project

A responsive, English-language project brief for students learning Java and JavaScript. It covers the product, user journey, MVP, architecture, implementation milestones, and acceptance criteria. The interactive brief explorer is an educational example; it does not call AI services or store uploads.

## Run locally

No dependencies or build tools are required. From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000`. All asset paths also work under a GitHub Pages repository subpath.

## Automatic deployment

`.github/workflows/pages.yml` validates and builds the static site on pull requests. Every push to `main` rebuilds and deploys it to GitHub Pages. Manual deployment is available from `main`.

In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. The workflow uses GitHub's built-in token; no deployment secret is required. Pull requests build without deploying. The `deploy` job reports the published URL after deployment succeeds.

This brief is static. The students' future Java backend, database, and file storage need separate hosting; GitHub Pages cannot run Spring Boot.

## Branding

- Replace `assets/logo.svg` with the corporate logo, keeping the filename. The current asset is a neutral placeholder mark.
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
