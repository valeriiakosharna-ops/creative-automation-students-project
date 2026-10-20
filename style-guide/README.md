# Creative Automation — Social Style Guide v1.0.0

A proposed project style guide based on the original NIX logo/favicon and the supplied corporate palette. The standalone web guide includes composition studies, English/Ukrainian caption examples, a safe-area overlay, contrast reference, palette copy, and Print / Save PDF.

The mandatory brand-policy source of truth is [`studio/brand-policy.json`](../studio/brand-policy.json). It is bundled into both the frontend renderer and Java AI server. Update the policy, increment its version, rebuild both components, and check the visual guide when changing generation rules.

## Brand identity

Use `assets/logo.svg` as the full signature and `assets/favicon.svg` as the compact interface icon. Preserve original proportions, geometry and colors. Use a white logo shelf, contain-fit images, and clear space of at least one quarter of the displayed logo height. This spacing is a project rule, not an official corporate standard.

All uploaded logos appear on every generated visual. The favicon is an application icon, not a replacement for the full social-content logo. The current MVP accepts PNG/JPEG/WebP uploads; export an approved SVG logo to a sufficiently large transparent PNG before uploading it.

## Palette

| Color | HEX       | Role                                    |
| ----- | --------- | --------------------------------------- |
| Cyan  | `#00A6EB` | Main accents, geometry, highlights      |
| Red   | `#E60036` | One focal accent or short CTA treatment |
| Sky   | `#81D0F4` | Soft supporting panels                  |
| Peach | `#EF958C` | Warm supporting details                 |
| Ocean | `#2A668E` | Readable blue text on white             |
| Mauve | `#937C8A` | Decorative secondary accents            |
| Ink   | `#302A40` | Body text, dark backgrounds             |
| Wine  | `#951B3C` | Readable red emphasis on white          |

Start around 70% white/light space, 20% blue and 10% red in designed areas, excluding photos and original logos. Additional colors are optional. Project palettes override the three generation defaults; text colors are darkened as needed for contrast. Original logo colors stay unchanged.

Regular text needs 4.5:1 contrast; large text needs 3:1. Exact examples: ink on cyan 5.00:1; white on red 4.75:1; ocean on white 6.20:1. White on cyan is 2.74:1 and fails both thresholds. Ink on red is 2.89:1; use white. Mauve on white is suitable only for large type at 3.82:1. Recheck photographs, transparency and gradients separately.

## Format and generation rules

Sizes and safe areas are source pixels. These are project export defaults and conservative safety margins, not universal platform limits.

| Format          | Size        | Critical-content margins L/R/T/B | Headline preferred / minimum | Summary preferred / minimum | Summary max | Caption maximum |
| --------------- | ----------- | -------------------------------- | ---------------------------- | --------------------------- | ----------- | --------------- |
| Instagram post  | 1080 × 1080 | 65 / 65 / 65 / 65                | 76 / 48 px                   | 32 / 24 px                  | 100 chars   | 650 chars       |
| Instagram story | 1080 × 1920 | 90 / 90 / 250 / 320              | 88 / 60 px                   | 36 / 28 px                  | 100 chars   | 180 chars       |
| Facebook        | 1200 × 630  | 72 / 72 / 72 / 72                | 56 / 34 px                   | 26 / 24 px                  | 70 chars    | 900 chars       |
| Google Chat     | 1200 × 675  | 72 / 72 / 72 / 72                | 58 / 36 px                   | 26 / 24 px                  | 60 chars    | 450 chars       |

Use Arial with a sans-serif fallback and full Latin/Cyrillic support. Headlines are bold; support copy is regular/medium. Keep titles short and use one clear CTA (at most 40 characters). The renderer fits text within the policy's minimum sizes and fails an output with an actionable error if essential copy cannot fit. It never silently crops essential text.

Keep the logo shelf inside the safe area. Place one original photo in a diagonal split where allocated; use a clean information-only composition after the photo pool runs out. Story UI, native link stickers and final crops still need a destination-app preview before publishing.

## Channel-specific copy

- **Instagram feed:** benefit/question hook, short paragraphs, practical event details, one CTA, and 1–3 relevant hashtags. Target 250–650 characters.
- **Instagram story:** a very short message and one next step, around 40–180 characters. Story caption text is exported separately; add a native link sticker manually when publishing.
- **Facebook:** welcoming community announcement; audience, value, practical details and one clear next step. Target 350–900 characters, complete sentences, no hashtag block.
- **Google Chat:** concise team message, optional `*bold*` title, essential event details and one real event link. Target 180–450 characters, no hashtag block.

Targets guide AI writing; maxima are enforced for generated captions. Preserve factual essentials. Template mode shortens optional description text to fit. If essentials alone exceed a channel's maximum, shorten the event name, location or URL rather than hiding details.

## English and Ukrainian

Language selection is mandatory: English (`en`), Ukrainian (`uk`), or both. “UA” is a display label. Each selected language produces a separate image and matching caption. Localize month names and CTA wording, respect provided translations, and preserve dates, venues, time zones, speaker names and URLs. Invent no missing facts. Check Ukrainian apostrophes, І/Ї/Є/Ґ glyphs and line breaks in the PNG.

Template mode uses supplied localized titles/descriptions. AI mode translates and adapts copy using the bundled policy. A model error remains an error; there is no silent template substitution.

## Logo and photo allocation

Every original logo appears on every visual. A photo is used at most once per social network per run, across all variants, formats and languages. Instagram feed and story share one pool. Cross-network reuse is allowed. A new run starts a new allocation.

Example: 2 uploaded photos, with 2 Instagram formats × 2 languages × 2 variants, produce 8 outputs: 2 with photos, 6 information-only. Facebook starts its own photo pool.

## How the guide is applied

- `studio/src/brand.js` imports and freezes the shared policy.
- The planner uses its format dimensions/networks and language list.
- Canvas rendering reads safe areas, typography, contrast, logo shelf and clear-space rules.
- Template copy follows per-format summary/caption maxima.
- The Java server bundles the same JSON into the JAR, includes it in the AI system instructions, and validates per-format text maxima.
- Browser/server policy-version mismatches are rejected before spending AI credits.
- Runs save the full effective policy snapshot. ZIP exports include `style-guide.json`, the policy version in the manifest, and per-output layout/font measurements.
- Earlier runs keep their original files and are marked as having no policy version if they predate this feature. Reusing an old brief creates a new run with the current policy.

## Final review

Check event facts, original logo integrity, per-network photo uniqueness, language, contrast, mobile readability and destination-app safe areas. Every delivered PNG needs a matching UTF-8 caption. The manifest records allocation, failures and the applied policy. Source uploads and API keys are excluded from the ZIP.

See [`studio/QUICKSTART.md`](../studio/QUICKSTART.md) for key setup and launch instructions. Style-guide edits take effect in generation through the policy JSON and a rebuild of both components, not through editing this prose alone.

## Connected AI posts and approval (Pages)

Frame counts are independent per format (1–10 per language, 24 total per run). Four frames mean one four-frame carousel with a shared caption; Stories are a connected sequence. Plan an opening hook, complementary context/benefits/details, and a closing CTA without repeating the full announcement on every frame.

The versioned repository prompts are [`planner.js`](../studio/src/prompts/planner.js), [`visual.js`](../studio/src/prompts/visual.js) and [`social-copy.js`](../studio/src/prompts/social-copy.js). [`channel-styles.js`](../studio/src/prompts/channel-styles.js) defines distinct visual direction per social format and model settings. The full brand policy and effective palette are appended to the planner and copywriter, and included in each image-edit request.

Planner and copywriter run as separate parallel calls. The planner returns ordered visual JSON with narrative role, composition direction and on-image copy; the copywriter returns one shared caption per format/language. Images API edits receive the plan, the assigned event photo (or none for information-only frames), and all logos. The image model creates the artwork; a local finalizer fits it inside safe areas without cropping and adds every original logo unchanged. AI typography, colors and photo fidelity still require human review; minimum type sizes cannot be reliably measured in model-generated raster artwork.

Results appear in the browser. Per-visual feedback regenerates just that image using its prior version and original references, costing one additional request. Posts can be edited locally. Every visual and post must be complete and individually approved before ZIP download. New/edited content requires renewed approval. ZIPs contain ordered PNGs, `posts.txt`, per-post `post.txt`, `storyboard.json`, and the manifest/policy snapshot. No keys or original upload files are included.

Event dates can be single, ranges, multiple dates or free-text schedules. Include the year, preserve all event facts in both languages and verify actual image lettering before approval. AI generation sends referenced assets to OpenAI; only Template mode keeps all processing local.
