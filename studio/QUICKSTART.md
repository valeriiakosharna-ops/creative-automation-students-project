# Use the free Pages Studio

First launch: follow [Free Pages setup](PAGES_SETUP.md). It uses Firebase Console and two public GitHub repository variables, without Render, a Java server or local tools. Google/Firebase free quotas apply; OpenAI API generation is billed separately.

1. Open the GitHub Pages **Studio** URL and click **Sign in with Google**. Use the exact account approved by the owner. Gmail and other Google account domains are supported.
2. Click **Connect OpenAI**, enter your API key and choose **Use key for this visit**. Never put it in GitHub configuration or chat. Refresh, sign-out, normal access loss and closing the page clear it; **Forget key** clears it immediately.
3. Create a project, upload original PNG/JPEG/WebP logos/photos, enter event details and choose formats, quantity and **English, Ukrainian or both**.
4. Generate a small pack first. Review the previews, edit/approve post texts and approve every visual. ZIP unlocks only after every item is completed and approved. Per-image feedback/regeneration costs one new image request. Template mode needs no key and does not translate your text.
5. Projects and assets stay in this browser, separately for each Google account. They do not sync or form a shared team library. Export important ZIPs before clearing browser data; use a separate browser profile on shared computers.

The owner opens **Team access**, enters an exact Google email, clicks **Add colleague** and shares **Copy Studio link** manually. No email is sent automatically. **Revoke access** blocks the normal app when it receives the change; **Restore access** approves the account again. Only the owner can list/manage access. Revocation cannot recall local/downloaded files or prevent use of a copied public app.

Every uploaded logo appears on every visual. A photo appears at most once per social network/run across variants and languages; Instagram posts/stories share a photo pool. Extra outputs are information-only. The shared brand policy drives both visuals and AI copy. Approved AI ZIPs contain ordered PNGs, `posts.txt`, one `post.txt` per format/language, storyboard, brief, manifest and effective style policy, without original uploads or credentials.

AI mode sends event text, assigned photos, all logos, and revision instructions/previous visuals directly to OpenAI. Local project storage is separate from this provider upload. A key in use can be inspected by the browser user/extensions. Firebase sees Google sign-in identities and the private access roster, never event content or OpenAI keys. Pages HTML/code/assets are public; see [Security boundaries](../SECURITY.md).

For a private shared server library, use the separate [Corporate deployment](../DEPLOYMENT.md) instead. It requires hosting and different setup.

## New editor controls

Choose **Interface language** (English / Українська) in the header; this preference is remembered in this browser. Post languages are a separate required selection.

Under **Event schedule**, choose one date, a date range, several dates, or write the schedule. A range has start/end calendar fields. Several dates and free text accept your wording, including the year; the full schedule remains in the brief and captions; the visual planner spreads event details naturally across the series.

Select formats, then set each format’s frame count (1–10). Counts apply separately to each selected post language, with 24 frames maximum in a pack. Four Instagram frames mean **one four-frame carousel and one shared caption**. Stories form a connected sequence. AI plans a hook, development and closing CTA with complementary copy and supported layouts; Template mode remains a deterministic offline fallback.

AI starts a shared visual-identity planner and public writing research in parallel. Copywriting uses the research while images are generated from the plan. Each image is one separate Images API edit. Review the actual PNGs and post texts in the browser. Captions have editable text fields and approval buttons. Each visual has a feedback field, a **Regenerate visual · paid** button and its own **Approve visual** button. A revision makes one new image request using the prior visual, source references, plan and your feedback. It creates a new history run and must be approved again; other unchanged approvals remain.

Typing visual feedback or changing a caption revokes its approval. Clear unused feedback or regenerate before approving a visual. Text edits/approval are local and do not call OpenAI. Every requested image and post must be completed and individually approved before ZIP download; partial results remain previewable but do not enable ZIP. Model-generated artwork can contain misspelled text or incorrect details, so check them before approval. The image model integrates the uploaded logos itself; the app adds no white frame or duplicate logo block. Check logo accuracy as part of approval.

Use an API key with Chat Completions, Responses/web search and `gpt-image-2.5-flare` image-edit access, billing and any required organization verification. Initial generation makes **3 text requests + N high-quality image requests**, plus the web-search tool fee; revisions cost another image request each. Provider failures are shown without automatic retries or template replacements. Aborting a request cannot guarantee that OpenAI has not already processed or charged it.

## Natural design and caption length

Describe your desired mood in **Visual direction**, choose the palette and upload logos/photos. The planner creates a common campaign identity for all posts, formats and languages. Compositions can vary naturally; no fixed font sizes, pixel grids or logo shelf are imposed on AI. The reference guide is optional inspiration.

Post text fields show an advisory character count. The old 650-character rejection is removed; 651 characters does not block images, approval or ZIP. Text remains complete and editable. Suggested ranges can adapt to current public writing research; sources and the check date appear above the posts. The search sends only format names and the date, not your event or files. Without search access, generation continues using baseline advice and shows that live research was unavailable. Trends are context, not a promise of engagement.

Open a saved pack again to recover a caption rejected solely by the old budget. Existing generated images do not change on deployment: to replace an old framed image, enter feedback such as “Redesign as one full-canvas composition with integrated logos, keeping the campaign mood” and regenerate that visual, or reuse the brief for a fresh campaign. Both image actions are paid and require approval again.
