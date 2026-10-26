# Brand inspiration — a flexible creative direction

This reference is inspiration, not a mandatory AI design specification. The earlier fixed margins, font-size floors, three layouts and white logo shelf remain only in the optional offline Template renderer. They are not injected into AI planner or image prompts.

## One recognizable campaign

Use the supplied cyan/red palette as a starting point, balanced with the additional brand colors and natural photo colors. Decide a shared mood, typographic character, photo treatment and a small family of recurring motifs. Carry that identity across networks, languages and successive posts. A Story may be taller and more immersive, and Chat quieter, while both still belong to the same campaign. Vary compositions and narrative ideas without switching visual brands.

Let the model design the entire canvas, integrating all uploaded logos organically. Do not shrink an already completed design into another frame or append a second logo strip. The model must preserve logo identity, but exact pixels/spelling cannot be guaranteed: review every output. Favicon remains an interface icon, not an additional required post logo.

## Useful text, not character gates

Baseline event-copy ranges are Instagram feed 250–900 characters, Story accompanying text 40–180, Facebook 300–1000 and Chat 160–600. They are contextual writing targets, not universal optimal lengths or platform limits. Keep useful facts and complete links; shorter complete messages need no padding. The app never rejects a caption solely for exceeding a target. A 651-character Instagram caption is valid for review.

Public web research at generation time can refine writing advice. Its date and attested source links appear alongside post texts. Without fresh evidence, use durable readable writing and make no live trend claims. Instagram's usual 2200-character publishing allowance is a separate reference; this MVP exports text and does not publish automatically. Native Story stickers are added during publication.

## Handoff

Choose the desired style, palette, logos and photos in Studio. The planner stores one shared `campaignStyle` and narrative frames; the image model receives those suggestions and original references, without the old hard style policy. Each photo is assigned at most once per network and language; English and Ukrainian versions may reuse the originals, while Instagram formats share a pool within each language. Extra frames are information-led. Preview, revise and approve every visual and caption before ZIP. New AI packs include `creative-direction.json`, sources in the manifest and the ordered content. Source files and visit keys are excluded.

See [Studio quickstart](../studio/QUICKSTART.md) and [versioned prompts](../studio/src/prompts/README.md). Defaults use GPT Image 2.5 Flare at high quality; a local finalizer only resizes the whole image to the destination dimensions. It adds no white border, fixed layout or logos.


Current defaults use light/white/pale-tint backgrounds, no promotional CTA, and no invented people. Each image has a separate plan informed by its actual original logos and single assigned photo. Information-only frames use abstract/typographic designs without people. Source photo assignment is deterministic and non-repeating. Older generated images are not reused as references during revisions. The common caption appears once per post/language in the review section.
