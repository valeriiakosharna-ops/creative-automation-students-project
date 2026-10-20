# Creative Automation · Student Project

A responsive, English-language project brief for students learning Java and JavaScript. It covers the product, user journey, MVP, architecture, implementation milestones, and acceptance criteria. The interactive brief explorer is an educational example; it does not call AI services or store uploads.

## Free Pages MVP

[Studio](studio/README.md) now runs on GitHub Pages, with Google sign-in through Firebase's Spark plan and an owner-managed private list of approved Google emails. Corporate accounts and Render are not required. Start with [Free Pages setup](studio/PAGES_SETUP.md): enable Google in Firebase Console, publish the included Firestore rules, seed the owner privately and add two public Firebase repository variables.

Each Google account keeps separate projects, uploads and history in its browser. There is no shared library or cross-device sync in this version. Users enter an OpenAI key for the visit; it stays in page memory and is sent directly to OpenAI, never saved to Firebase, GitHub, projects or ZIPs. API generation is billed by OpenAI separately from free hosting/auth quotas.

The owner can add/revoke exact Google account emails through **Team access**. Firebase rules protect the private access directory. Pages HTML/code/assets are public and client-side gating cannot prevent someone using a copied app; local files cannot be remotely erased. See [Security boundaries](SECURITY.md).

The [social style guide](style-guide/README.md) and shared [generation policy](studio/brand-policy.json) control original-logo composition and English/Ukrainian copy. Every logo appears on every visual; photo use is limited to once per network/run and extra visuals are information-only.

The optional [corporate Java deployment](DEPLOYMENT.md) retains Google Workspace SSO, an encrypted shared server library and a company server-side key, requiring separate hosting. Its paid Render setup is not needed for the free Pages path.

## Preview the student brief locally (optional)

The student brief has no dependencies. From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000`. All asset paths also work under a GitHub Pages repository subpath.

## Automatic deployment

`.github/workflows/pages.yml` validates and builds the static site on pull requests. Every push to `main` rebuilds and deploys it to GitHub Pages. Manual deployment is available from `main`.

In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. The workflow uses GitHub's built-in token; no deployment secret is required. Pull requests build without deploying. The Pages workflow also installs and builds the Studio frontend with Node.js 24. The `deploy` job reports the published URL after deployment succeeds.

This brief is static. Pages includes the browser-only Studio app. Missing Firebase settings show a locked setup screen. Event files stay local and an entered key is sent directly to OpenAI. GitHub Pages cannot run Spring Boot.

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
