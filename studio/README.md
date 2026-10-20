# Creative Automation Studio — MVP

A working single-user content studio in the same palette as the student project brief. The frontend works on GitHub Pages. A separate Java 21 / Spring Boot server adds OpenAI copy generation and translation; it can also serve the complete built frontend.

## What works

- Create, rename and delete project folders. Drafts, original uploads, generation snapshots and output files persist in IndexedDB in this browser.
- Upload 1–8 logos and up to 20 photos (PNG/JPEG/WebP, 10 MB and 24 MP per file, 100 MB per brief). Duplicate image bytes are rejected within each upload group.
- Choose Instagram post/story, Facebook and Google Chat independently. Choose **English, Ukrainian, or both**; a language choice is mandatory.
- Request 1–3 variants per format and language, up to 24 PNG/caption pairs per run.
- Preview the branded layout, inspect generated visuals, copy channel-specific captions and download an individual PNG or a complete ZIP.
- Reopen history, reuse an earlier brief as a new run, cancel a running generation and keep completed files after partial failure or interruption.

### Exact asset rules

Every uploaded logo is composited from the original file, contained without cropping, on a white logo shelf on **every** visual. Logos are never redrawn by AI.

A photo is used **at most once per social network per run**, across formats, variants and languages. Instagram post and story share one network pool. Photos can be used again on a different network or a new run. Allocation follows selected format order, then language order, then variant number. Photos are not repeated to fill the requested count: remaining outputs are information-only designs, still including all logos. Assignments are recorded in `manifest.json`.

Example: 2 photos + Instagram post and story + 2 languages + 2 variants = 8 Instagram outputs. Exactly 2 have a photo and 6 are information-only. Selecting Facebook as well starts a separate photo pool for Facebook.

### Copy modes

**Template** works immediately without a key, using localized channel-specific structures. It does not translate your text. Optional English/Ukrainian title and description fields supply exact localized wording; otherwise a title stays as supplied, and the description is included only when its source language matches. Full descriptions stay in captions; visual summaries are shortened to 160 characters. Variants change their hook and template accents.

**AI** sends only the text brief and requested output specifications to the Java server. The server requests structured output from OpenAI (`gpt-4.1-mini` by default) and validates count, identities and text limits. It translates and adapts copy for each selected channel and language. Uploaded photos/logos are never sent to the provider. An AI error stays an error; no template text is silently substituted. Timeouts and provider errors are not automatically retried, avoiding unexpected repeat requests.

Visuals use deterministic Canvas composition inspired by the supplied reference: branded headings, exact event details, diagonal photo layouts and an original-logo shelf. This MVP does not generate synthetic photos or offer arbitrary AI-designed layouts. The visual-direction field guides AI copy tone.

## Start the frontend

Requirements: Node.js 22.12+ (CI uses 24).

```sh
cd studio
npm ci
npm run dev
```

Use the address printed by Vite. **Use example brief** creates a local demo campaign with a clearly marked example logo. Replace it with your own assets.

```sh
npm test
npm run build
npm run preview
```

`dist/` is the separate deployable web build. All paths are relative, including when hosted at `/repository/studio/`. Build/dev preparation copies the student brief and root branding assets; replace the logo/favicon in the repository's root `assets/` directory to update both sites.

## Add your API key (server only)

The API key placeholder is intentionally empty in `server/application-local.properties.example`.

```sh
cd studio/server
cp application-local.properties.example application-local.properties
```

Edit the ignored `application-local.properties` file and set `creative.openai.api-key=` to your key. Alternatively set the server environment variable `CREATIVE_OPENAI_API_KEY`. Never place the key in frontend code, a `VITE_` variable, GitHub Pages files, or a committed properties file.

With a full **JDK 21** installed:

```sh
# Build the frontend first, from studio/:
npm ci
npm run build

# Then, from studio/server/:
./mvnw --batch-mode verify
java -jar target/studio-server-0.1.0.jar
```

On Windows use `mvnw.cmd`. The Maven wrapper downloads Maven 3.9.11 and verifies its pinned SHA-256 checksum. The JAR includes the built frontend. Open the server's local address on port 8080, choose **AI** in Copy generation, and generate a pack. When running Vite, `/api` is proxied to port 8080.

For a GitHub Pages frontend, open **Connection settings** in Studio and set the HTTPS URL of your separately hosted Java server. Configure `STUDIO_ALLOWED_ORIGINS` on the server to the exact frontend origin, such as `https://your-account.github.io` (no repository path). GitHub Pages cannot execute Java or protect a browser-delivered key.

The server binds to `127.0.0.1` by default. For hosted use, configure `STUDIO_BIND_ADDRESS`, `PORT`, HTTPS and authenticated access at your hosting/reverse-proxy layer. This local single-user MVP does not implement accounts or public multi-user access controls. `CREATIVE_OPENAI_MODEL` selects another model supporting Chat Completions structured JSON output. Outbound access to `api.openai.com` and an API-enabled account/billing are required for live AI.

In a managed environment Java/Maven may need the provided HTTPS proxy and trusted CA configuration. The AI client respects `HTTPS_PROXY`; Maven uses standard `~/.m2/settings.xml` proxy settings. Keep TLS and checksum verification enabled. Do not commit environment-specific proxy configuration or CA files.

## Data and exports

Clearing browser data removes the workspace. A different browser, origin, device or port has a separate workspace. There is no cloud sync or Google Drive export in this MVP. ZIP files are deliverables, not re-importable workspace backups.

Archives contain:

```text
instagram_post/en/variant-01.png
instagram_post/en/variant-01.txt
... (one pair for each completed output)
brief.json
manifest.json
README.txt
```

The manifest includes the input snapshot, mode/model/prompt version, language/format/variant, logo IDs, photo assignment, status and any error for each output. Original source uploads and credentials are not included. Regeneration creates a new immutable history entry. Closing the page during a run marks it interrupted on the next visit; completed files remain available. Reuse the brief to start a new run (selective per-output retry is not part of this MVP).

## Validation and automation

```sh
cd studio
npm test
npx playwright install chromium
npm run test:e2e
npm run build
cd server
./mvnw --batch-mode verify
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when using an existing system Chromium. Tests cover photo allocation, mandatory languages/logos, per-channel/localized copy, actual PNG sizes, pixels from every original logo, ZIP contents, persisted history, isolated projects, cancellation/interruption, and AI success/failure contracts. Java tests use a local HTTP stub; they never spend API credits. Live OpenAI generation requires your key and remains an integration to verify after configuration.

`.github/workflows/studio.yml` builds/tests the frontend and Java server as separate downloadable artifacts. `.github/workflows/pages.yml` publishes the student brief at the site root and the Studio app at `studio/` after changes land on `main`.
