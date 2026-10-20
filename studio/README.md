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

In Pages AI mode every original logo is supplied as a reference and requested once in the model-designed composition. The app does not redraw, append or duplicate logos after generation. Check logo spelling, identity and completeness before approval: a generative model cannot guarantee pixel-exact reproduction. Offline Template mode still composites originals locally.

A photo is used **at most once per social network per run**, across formats, variants and languages. Instagram post and story share one network pool. Photos can be used again on a different network or a new run. Allocation follows selected format order, then language order, then variant number. Photos are not repeated to fill the requested count: remaining outputs are information-only designs, still including all logos. Assignments are recorded in `manifest.json`.

Example: 2 photos + Instagram post and story + 2 languages + 2 variants = 8 Instagram outputs. Exactly 2 have a photo and 6 are information-only. Selecting Facebook as well starts a separate photo pool for Facebook.

### Copy modes

**Template** works immediately without a key, using localized channel-specific structures. It does not translate your text. Optional English/Ukrainian title and description fields supply exact localized wording; otherwise a title stays as supplied, and the description is included only when its source language matches. Optional descriptions are shortened to each channel’s style-guide limits; the full original description remains in the saved brief. Essential details are preserved, and an output reports an error if they cannot fit. Template frames vary supported layouts and accents; narrative planning and translated copy require AI mode. All frames of a post share one caption.

**AI in Pages mode** starts the visual planner and generic caption research concurrently. The planner returns one shared creative identity for the entire campaign plus an ordered narrative per post. Image edits start as soon as the planner finishes. The copywriter uses the public research when available and runs independently of image generation. References contain only the assigned event photo and all original logos; revisions also use the previous image.

Defaults are `gpt-4.1-mini` for text and **`gpt-image-2.5-flare` at high quality** for image edits. The latter is in the latest GPT Image 2.5 family listed in the [official OpenAI SDK](https://github.com/openai/openai-node/blob/master/src/resources/images.ts) and [OpenAPI specification](https://github.com/openai/openai-openapi/blob/master/openapi.yaml), checked 20 October 2026. No silent downgrade is used if the account lacks access. Model IDs and quality live in `src/prompts/channel-styles.js`; access, billing and any verification remain provider requirements. A ChatGPT subscription is not API credit.

The image model designs the complete image, including naturally integrated logos. It receives the desired style, effective palette, shared campaign identity, event content and references, without the old mandatory brand-policy JSON, font limits, safe-area grid, fixed composition or logo shelf. Channel direction adapts the common aesthetic rather than changing brands between networks. Native requests preserve the destination aspect ratios: 1024×1024 feed, 1152×2048 Stories, 1280×672 Facebook, 1280×720 Chat. A full-canvas resize produces the destination export size; the app adds no border, cropping or second logo block. Review typography, logo fidelity, facts and photo identity. Previously saved images remain unchanged until explicitly regenerated.

### Caption length and current writing advice

Caption ranges are editorial targets: Instagram feed 250–900, Story accompanying text 40–180, Facebook 300–1000, Chat 160–600 characters. They are starting points for event announcements, not platform limits or evidence of a universal optimum. Live source-backed research may refine them. Captions have no style-guide maxlength, no length-based failure status, and no manual shortening requirement to unlock approval. Essential facts/URLs are never cut just to hit a target. An empty/missing post still needs correction. Actual publication limits and destination previews must be checked before posting; the MVP exports files rather than publishing.

Text failures never mark a successfully generated visual as failed. Saved review packs rejected solely by the old caption budgets are recovered on opening, preserving text, images and approval state without any API request.

### Review, feedback and approval

All generated visuals and post texts appear in the browser. A visual feedback field and **Regenerate visual · paid** button request only that image again, using the existing campaign identity, previous image, original references and feedback. A revision creates a new history run and resets only its approval. No planner/copy/research rerun or automatic paid image retry is made.

Each post has an editable caption and its own approval button. Editing and approving text is local and costs no API request; changed text creates a new run and keeps the original/generated caption in history. It updates the shared caption for every frame of that post. Typing text or visual feedback revokes the corresponding approval and blocks ZIP. Clear unused visual feedback or apply it before approving that visual.

**ZIP export stays blocked until every requested visual and post is complete and individually approved.** A partial run keeps successful previews/texts for review and recovery, but cannot bypass approval with a partial archive. Approval is browser workflow state, not a cryptographically signed organizational approval system. Review again whenever content changes. Legacy runs retain their previous export behavior.

Initial generation makes **3 text requests (public web research, planner, copywriter) + N image requests**. The research Responses request allows at most one web-search tool call, billed separately by OpenAI, and times out after 45 seconds. It sends ONLY selected format IDs and the date, never the event brief, private identity, images or key as search content. Results retain the check date and URLs actually returned by search; fabricated/unsafe sources are discarded. If research fails, baseline channel advice is used and the UI explicitly says live research was unavailable. This is not a universal optimal-length guarantee or permission to invent trending hashtags. Images time out after five minutes; other text calls after two. Cancellation cannot recall already accepted work or guarantee no charge.

## Persistence and exports

In Pages mode, IndexedDB stores original assets, drafts and completed/partial runs per Firebase project and Google UID. The library is local and unencrypted; Google sign-in does not hide it from someone with access to the same browser profile/device. Use separate browser profiles on shared computers. Clearing browser data or changing account/site/device separates or removes the library. There is no shared library, cloud project sync or Google Drive export.

Approved AI ZIPs contain ordered PNGs, shared post text files, combined `posts.txt`, `storyboard.json`, `brief.json`, `manifest.json`, `creative-direction.json` and `README.txt`. They include prompt/model versions, shared creative identity and public research provenance, excluding source uploads and credentials. Legacy/template packs retain their existing policy files. The original style guide is now an optional inspiration/template reference and is not injected into AI generation.

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
