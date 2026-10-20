# Creative Automation · Student Project

A responsive, English-language project brief for students learning Java and JavaScript. It covers the product, user journey, MVP, architecture, implementation milestones, and acceptance criteria. The interactive brief explorer is an educational example; it does not call AI services or store uploads.

## Private working MVP

The separate [Studio application](studio/README.md) creates branded PNG/caption packs and ZIP exports. It supports corporate Google Workspace sign-in, owner-managed colleague access, a shared encrypted project library and a server-managed company OpenAI key. Colleagues need only a browser and never enter or see the key.

The owner opens **Team access**, adds an exact corporate email and shares the protected Studio link. They can revoke or restore access without changing code or restarting. Only approved accounts enter; knowing the corporate domain is insufficient. Real email addresses, domains and secrets are private hosting settings and are absent from this repository.

Start with [First launch on Render](studio/RENDER_SETUP.md): only four private fields, with the domain and Render address resolved automatically. Follow [Quickstart](studio/QUICKSTART.md) for daily use and [Private deployment](DEPLOYMENT.md) for advanced Google/hosting administrator setup. No live host or Google OAuth credentials are provisioned by the code itself. The default container requires corporate mode and a persistent disk. The included Render template uses a paid service/storage; the same image runs on company infrastructure with GitLab CI.

The separate [social style guide](style-guide/README.md) and shared [generation policy](studio/brand-policy.json) control original-logo composition, format-specific visuals and English/Ukrainian AI copy. Every logo appears on every visual; photos are never repeated within a network/run. Extra visuals are information-only.

GitHub Pages publishes the student brief, style guide and a Studio landing page. The private working application runs at its own company-controlled HTTPS address. See [Security boundaries](SECURITY.md).

## Preview the student brief locally (optional)

The student brief has no dependencies. From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000`. All asset paths also work under a GitHub Pages repository subpath.

## Automatic deployment

`.github/workflows/pages.yml` validates and builds the static site on pull requests. Every push to `main` rebuilds and deploys it to GitHub Pages. Manual deployment is available from `main`.

In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. The workflow uses GitHub's built-in token; no deployment secret is required. Pull requests build without deploying. The Pages workflow also installs and builds the Studio frontend with Node.js 24. The `deploy` job reports the published URL after deployment succeeds.

This brief is static. Pages includes a Studio landing page; it does not publish the private working application or accept team uploads/keys. GitHub Pages cannot run Spring Boot.

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
