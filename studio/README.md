# Creative Automation Studio — free Pages MVP

A branded browser-based studio with Google sign-in, an owner-managed private Google access list, local per-account projects and ZIP exports. It runs on GitHub Pages with Firebase Spark for identity/access, within free quotas. No Render or local workstation tools are required; OpenAI API usage is billed separately.

## Start here

Follow [Free Pages setup](PAGES_SETUP.md) for the one-time Firebase Console and GitHub settings. No manual Google Cloud Console/OAuth secret configuration or corporate email is required. Google registration still exists underneath Firebase. No real Firebase project or provider credentials are provisioned by the code itself.

Users enter an OpenAI key for the visit. It remains in page memory, is sent only to the fixed OpenAI HTTPS endpoint, and is cleared by refresh/sign-out/normal access loss/page exit. It never enters local project records, Firebase, GitHub or exports. Original assets stay local; only event text/output requirements go to OpenAI. [Quickstart](QUICKSTART.md) covers normal use.

Each Google UID has a separate library at the same browser/site origin. The owner manages exact email grants through Team access; members cannot list other emails or grant themselves access. Firebase rules protect the roster, while Pages code/assets remain public. Client-side auth cannot prevent someone copying/modifying the app, inspect-proof local storage or erase downloaded files. Read [Security boundaries](../SECURITY.md).

The optional [corporate Java deployment](../DEPLOYMENT.md) remains available for a truly private application and shared encrypted server library. It has separate infrastructure requirements and is not used by Pages.

## What works

- Create, rename and delete project folders. Drafts, original uploads, generation snapshots and output files persist in a separate local IndexedDB library for each Google account in Pages mode. The optional corporate profile uses encrypted shared server storage.
- Upload 1–8 logos and up to 20 photos (PNG/JPEG/WebP, 10 MB and 24 MP per file, 100 MB per brief). Duplicate image bytes are rejected within each upload group.
- Choose Instagram post/story, Facebook and Google Chat independently. Choose **English, Ukrainian, or both**; a language choice is mandatory.
- Set **1–10 frames independently for each format**, per selected language, with at most 24 visuals per run. Frames form one carousel or connected Story sequence with a shared caption.
- Switch the interface between English and Ukrainian without changing the post languages or your event wording.
- Choose one date, a start/end range, several dates, or a free-text schedule. Custom schedule text appears on visuals exactly as entered; include the year and keep it concise.
- Preview the branded layout, inspect generated visuals, copy channel-specific captions and download an individual PNG or a complete ZIP.
- Reopen history, reuse an earlier brief as a new run, cancel a running generation and keep completed files after partial failure or interruption.

### Exact asset rules

Every uploaded logo is composited from the original file, contained without cropping, on a white logo shelf on **every** visual. Logos are never redrawn by AI.

A photo is used **at most once per social network per run**, across formats, variants and languages. Instagram post and story share one network pool. Photos can be used again on a different network or a new run. Allocation follows selected format order, then language order, then variant number. Photos are not repeated to fill the requested count: remaining outputs are information-only designs, still including all logos. Assignments are recorded in `manifest.json`.

Example: 2 photos + Instagram post and story + 2 languages + 2 variants = 8 Instagram outputs. Exactly 2 have a photo and 6 are information-only. Selecting Facebook as well starts a separate photo pool for Facebook.

### Copy modes

**Template** works immediately without a key, using localized channel-specific structures. It does not translate your text. Optional English/Ukrainian title and description fields supply exact localized wording; otherwise a title stays as supplied, and the description is included only when its source language matches. Optional descriptions are shortened to each channel’s style-guide limits; the full original description remains in the saved brief. Essential details are preserved, and an output reports an error if they cannot fit. Template frames vary supported layouts and accents; narrative planning and translated copy require AI mode. All frames of a post share one caption.

**AI** in Pages mode uses a visit-only key and sends only the text brief and requested output specifications directly to OpenAI. The request uses structured output from OpenAI (`gpt-4.1-mini` by default) and validates count, identities and text limits. Separate storyboard-planner and social-copywriter prompts produce structured JSON: one post per format/language, one shared caption, and ordered visuals with a narrative role, supported layout, concrete direction and concise on-image copy. The prompt receives each format’s exact character budget, photo availability and logo count, alongside the mandatory brand policy. Uploaded photos/logos are never sent to the provider. An AI error stays an error; no template text is silently substituted. Timeouts and provider errors are not automatically retried, avoiding unexpected repeat requests.

Visuals use deterministic Canvas composition inspired by the supplied reference: branded headings, exact event details, diagonal photo layouts and an original-logo shelf. This MVP does not generate synthetic photos or offer arbitrary AI-designed layouts. The visual-direction field guides the storyboard and copy. The renderer applies the selected split-right, split-left or poster layout; free-text plan directions are recorded for review rather than interpreted as arbitrary drawing commands.

If one output exceeds its format’s copy limits, other valid outputs still render. **Edit copy & render** shows the exact field/limit, preserves the original response and creates a new run without another AI call. Editing a shared caption updates every frame in that post and can unblock its other frames; old history stays unchanged. Essential event facts are not silently truncated.

## Persistence and exports

In Pages mode, IndexedDB stores original assets, drafts and completed/partial runs per Firebase project and Google UID. The library is local and unencrypted; Google sign-in does not hide it from someone with access to the same browser profile/device. Use separate browser profiles on shared computers. Clearing browser data or changing account/site/device separates or removes the library. There is no shared library, cloud project sync or Google Drive export.

ZIPs contain ordered PNG/caption pairs, one `post.txt` per format/language, `storyboard.json` for narrative roles/layouts/directions, `brief.json`, `manifest.json`, `style-guide.json` and `README.txt`. They omit source uploads and credentials and are deliverables, not re-importable workspace backups. Preserve important exports. The style policy applies to the deterministic Canvas renderer and AI prompt. Generation needs the page to stay open; saved outputs survive interruption.

## Contributor validation

Use Node 24 (minimum 22.12). These commands are optional for contributors; users need no local tools:

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run build:pages
```

`build` retains development/Java compatibility; `build:pages` produces the Pages runtime with public Firebase repository configuration, or a locked setup screen when unconfigured. Java builds use JDK 21. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selects an existing Chromium.

CI runs frontend/PNG/ZIP/key-isolation tests, Java compatibility tests, a private corporate container smoke, and Firestore rules in the official isolated emulator with fake Google identities. Rules can be checked locally with JDK 21:

```sh
npx --yes firebase-tools@15.34.0 emulators:exec --only firestore --project demo-creative-studio --config firebase/firebase.json "npm run test:rules"
```

No live credentials/API spend is used in tests. Real Google sign-in and OpenAI access must be checked after Firebase setup. Legacy Java/development modes are documented in [Local development](LOCAL_DEVELOPMENT.md); never expose unauthenticated developer profiles with company data.
