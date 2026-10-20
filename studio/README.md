# Creative Automation Studio — private MVP

A corporate Google Workspace content studio in the student brief's brand palette. Frontend and Java 21 / Spring Boot API run at one HTTPS origin. Approved colleagues share projects and output history across devices, generate channel-specific English/Ukrainian captions and branded visuals, and download ZIP packs. No local installation or colleague API-key entry is required.

## Start here

[Quickstart](QUICKSTART.md) explains sign-in, **Team access**, adding/revoking colleagues and creating content packs. [Private deployment](../DEPLOYMENT.md) covers the one-time Google Internal OAuth registration, private owner/domain settings, company OpenAI key, persistent disk, backups and GitHub/GitLab hosting. The code does not provision a live service or Google credentials. [Security boundaries](../SECURITY.md) explains protections and limitations.

Only the owner manages the exact-email access list. All approved members share the library with edit/delete/export access; no project-specific permissions are implemented. Access and material APIs enforce authentication on the server, including direct image downloads. Revocation blocks future requests from existing sessions, but cannot recall previously downloaded files.

The [social style guide](../style-guide/README.md) is applied through shared `brand-policy.json`, bundled into frontend and Java. It controls dimensions, safe areas, type floors, logo layout and copy. Each run snapshots its effective policy; ZIPs include `style-guide.json` and layout measurements. Finished runs remain immutable.

## What works

- Create, rename and delete project folders. Drafts, original uploads, generation snapshots and output files persist in the encrypted shared server library in corporate mode.
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

**Template** works immediately without a key, using localized channel-specific structures. It does not translate your text. Optional English/Ukrainian title and description fields supply exact localized wording; otherwise a title stays as supplied, and the description is included only when its source language matches. Optional descriptions are shortened to each channel’s style-guide limits; the full original description remains in the saved brief. Essential details are preserved, and an output reports an error if they cannot fit. Variants change their hook and template accents.

**AI** uses the server-managed company key and sends only the text brief and requested output specifications to the Java server. The server requests structured output from OpenAI (`gpt-4.1-mini` by default) and validates count, identities and text limits. It translates and adapts copy for each selected channel and language. Uploaded photos/logos are never sent to the provider. An AI error stays an error; no template text is silently substituted. Timeouts and provider errors are not automatically retried, avoiding unexpected repeat requests.

Visuals use deterministic Canvas composition inspired by the supplied reference: branded headings, exact event details, diagonal photo layouts and an original-logo shelf. This MVP does not generate synthetic photos or offer arbitrary AI-designed layouts. The visual-direction field guides AI copy tone.

## Persistence and exports

Corporate mode saves metadata, original assets, outputs, access grants/audit and daily quotas to an AES-256-GCM encrypted persistent server disk. It does not open IndexedDB for team data. Record versions prevent silently overwriting a colleague's changes. Keep the same disk and original storage key across deployments; administrators must arrange and test backups. Legacy browser-only prototype projects are not automatically migrated.

ZIPs contain one PNG/caption pair per completed output, `brief.json`, `manifest.json`, `style-guide.json` and `README.txt`. They omit original source uploads and credentials, and are deliverables rather than re-importable workspace backups. Google Drive export is not included.

Generation uses the browser for Canvas composition and needs the page to stay open. Saved partial results survive interruptions. After 15 minutes without progress the server marks an abandoned run interrupted; reuse its brief for a new run. Selective per-output retry is not implemented.

## Contributor validation

Local development is optional: see [Local development](LOCAL_DEVELOPMENT.md). Legacy/development profiles are unauthenticated and must never host company data. Corporate production setup is described separately in Deployment.

```sh
npm ci
npm test
npx playwright install chromium
npm run test:e2e
npm run build
cd server
./mvnw --batch-mode verify
```

Use JDK 21 and Node 24 (minimum Node 22.12). `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selects an existing Chromium. Tests cover branded PNG/ZIP output, assets/languages, shared-library browser wiring, owner grant/revocation, Google OIDC token validation, CSRF, private file access, encrypted persistence, conflicts and quotas. Tests use fake accounts and local provider stubs, with no real credentials or API spend. Live Google/OpenAI access must be checked after private hosting configuration.

The root Dockerfile builds/tests frontend and Java together. GitHub/GitLab CI runs the private container smoke test. Pages deploys documentation and a landing page rather than the private application. Repository/registry hosting alone does not run an application server.
