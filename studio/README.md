# Creative Automation Studio — free Pages MVP

A branded browser-based studio with Google sign-in, an owner-managed private Google access list, local per-account projects and ZIP exports. It runs on GitHub Pages with Firebase Spark for identity/access, within free quotas. No Render or local workstation tools are required; OpenAI API usage is billed separately.

## Start here

Follow [Free Pages setup](PAGES_SETUP.md) for the one-time Firebase Console and GitHub settings. No manual Google Cloud Console/OAuth secret configuration or corporate email is required. Google registration still exists underneath Firebase. No real Firebase project or provider credentials are provisioned by the code itself.

Users enter an OpenAI key for the visit. It remains in page memory, is sent only to the fixed OpenAI HTTPS endpoint, and is cleared by refresh/sign-out/normal access loss/page exit. It never enters local project records, Firebase, GitHub or exports. AI generation sends event text, the assigned photo, all uploaded logos and (for revisions) the previous visual and feedback directly to OpenAI. Storage remains local. [Quickstart](QUICKSTART.md) covers normal use.

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

**AI in Pages mode** follows three distinct stages. The storyboard planner and social copywriter are separate parallel Chat Completions requests. Each uses its own repository prompt plus the shared brand policy and format-specific rules. As soon as the planner finishes, up to two image-edit requests run concurrently; they do not wait for the caption request. Every frame gets its own Images API request with that frame’s ordered storyboard context, its assigned event photo (if available) and all original logos.

Defaults are `gpt-4.1-mini` for text and `gpt-image-1.5` with medium quality/high input fidelity for image edits. Access/billing and possible organization verification are required on the user’s OpenAI API account. A ChatGPT subscription does not provide API credits. Model settings live in [`src/prompts/channel-styles.js`](src/prompts/channel-styles.js); the three versioned instructions live in [`src/prompts/`](src/prompts/README.md). No API key belongs in those files. Review current provider model support and pricing before changing defaults.

The image model creates the artwork and on-image wording. A local finalizer contain-fits it into the target social dimensions/safe area without cropping text and composites every original logo unchanged on a separate white shelf. Logos are also sent as brand references, but the image prompt forbids redrawing them in the artwork. The assigned-photo rule is enforced on request inputs; review actual outputs for hallucinations, text errors and photo fidelity. Information-only frames get no event photo and are instructed to use typography/brand geometry rather than fictional people or event scenes. Different per-network visual directions are included in planner and image prompts. The optional Java mode retains its earlier copy-plus-template workflow.

### Review, feedback and approval

All generated visuals and post texts appear in the browser. Each visual has its own feedback textarea and a **Regenerate visual · paid** button. A revision sends the current visual, original assigned assets, storyboard, brand policy and feedback in **one additional image request**, without rerunning the planner or copywriter. It creates a new history run, retains unchanged results and approvals, and clears approval of the revised image. Failed image requests can be retried individually, also with an explicit paid action. There is no automatic paid retry or template substitution.

Each post has an editable caption and its own approval button. Editing and approving text is local and costs no API request; changed text creates a new run and keeps the original/generated caption in history. It updates the shared caption for every frame of that post. Typing text or visual feedback revokes the corresponding approval and blocks ZIP. Clear unused visual feedback or apply it before approving that visual.

**ZIP export stays blocked until every requested visual and post is complete and individually approved.** A partial run keeps successful previews/texts for review and recovery, but cannot bypass approval with a partial archive. Approval is browser workflow state, not a cryptographically signed organizational approval system. Review again whenever content changes. Legacy runs retain their previous export behavior.

The initial API request count is **2 text requests + one image request per visual**. A six-frame campaign makes eight requests, not three HTTP requests. Image requests time out after five minutes, text after two; cancellation stops new work and aborts active requests, but cannot recall provider work already accepted or guarantee no charge. Keep the page open during generation. Source uploads and keys are excluded from ZIP.

## Persistence and exports

In Pages mode, IndexedDB stores original assets, drafts and completed/partial runs per Firebase project and Google UID. The library is local and unencrypted; Google sign-in does not hide it from someone with access to the same browser profile/device. Use separate browser profiles on shared computers. Clearing browser data or changing account/site/device separates or removes the library. There is no shared library, cloud project sync or Google Drive export.

Approved AI ZIPs contain ordered `frame-01.png` visuals, a combined `posts.txt`, one `post.txt` per format/language, `storyboard.json` for narrative roles/layouts/directions, `brief.json`, `manifest.json`, `style-guide.json` and `README.txt`. They omit source uploads and credentials and are deliverables, not re-importable workspace backups. Preserve important exports. The style policy is supplied to both text stages and every image request, and controls final safe areas and original-logo placement. Generation needs the page to stay open; saved outputs survive interruption.

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
