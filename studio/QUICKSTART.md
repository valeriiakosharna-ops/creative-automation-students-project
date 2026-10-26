# Use Creative Automation Studio

The interface is English. Generated posts can be English, Ukrainian or both.

## First launch

The owner follows [Free Pages setup](PAGES_SETUP.md) once. It requires Firebase Console and two public GitHub repository variables; users need no local tools or Render deployment. Firebase/hosting free quotas apply. OpenAI generation is paid separately.

1. Open Studio and choose **Sign in with Google**, using the exact account the owner approved.
2. Choose **Connect OpenAI**, enter your key and select **Use key for this visit**. It stays in page memory. Refresh, sign-out and **Forget key** clear it. Never commit a key or paste it into chat.
3. Create a project. Follow the four links above the form: **Event details**, **Brand & photos**, **Formats & languages**, **Review & generate**.
4. Describe the event and choose one date, a range, several dates or a written schedule. Add optional location, link and visual direction.
5. Upload all logos and optional event photos. Select formats and set each card’s **Frames per language**. Choose English, Ukrainian or both. Check the total in **Your content pack**.
6. Start with a small pack. Review the images and shared post captions. Edit text directly; use a visual’s feedback box and **Regenerate visual · paid** only when needed.
7. Approve every image and caption. Then choose **Download ZIP**. It contains ordered PNGs, one text file per post/language, combined `posts.txt` and generation metadata.

Four Instagram frames in two languages mean eight visuals and two captions. A caption is shared by the carousel; it is not repeated under every image. Instagram Stories form a connected series with one accompanying exported message.

## What to check before approval

- All uploaded logos appear correctly on every image.
- A frame uses at most its assigned original photo. Each photo is used at most once per network/run, across languages; Instagram feed and Stories share that pool.
- Frames without photos use information/abstract design and contain no invented people. Check that photo frames have no added or replaced people.
- Designs use light backgrounds and a coherent campaign identity. Text is readable, factual and in the selected language, without an automatic promotional ending.

AI can make visual or spelling mistakes. Source isolation and prompts support these requirements; your approval confirms the actual result. The optional template mode makes local deterministic layouts, requires no API key and does not translate text.

## Costs and recovery

For **N visuals**, the default AI flow makes **2 campaign text requests + N per-frame planning requests + N high-quality image requests**. A revision reuses a valid saved plan and costs one image request; a missing/older plan adds one frame-planning request. Editing/approving text costs no AI call.

**Research current writing trends** is optional and off by default. Enabling it adds one Responses request and up to one web-search tool call. It searches only public format/date guidance, never the event or files. Search failure falls back to baseline advice without blocking images or captions. Fresh trend claims require returned sources.

There are no automatic paid retries. Cancellation cannot guarantee that an accepted provider request was not charged. Your key needs access to the configured text and image models; web-search access is needed only for optional research.

Successful content stays available if another item fails. Missing optional layout fields and advisory caption lengths do not reject the whole pack. Complete a missing caption manually without another AI request. Retry a failed visual individually. In **Original brief & generation details**, inspect or download saved paid text responses; these are local project data, not another API request. Earlier versions did not save rejected responses, so missing historical responses cannot be recovered retroactively.

## Projects and colleagues

The MVP stores projects, original files, responses and history in this browser, separately for each Google account. It has no cloud backup, cross-device sync, shared project database, Drive export or administrator prompt editor. Export important packs before clearing browser data. On shared computers, use separate browser profiles.

The owner opens **Team access**, enters an exact Google email and chooses **Add colleague**. Share **Copy Studio link** manually; Studio does not email invitations. **Revoke access** disables the normal app when it receives the change, but cannot recall local/downloaded copies.

GitHub Pages code is public. Firebase protects the private access directory; it receives no event content or OpenAI key. AI generation sends event information and original references directly to OpenAI under its provider terms. See [Security boundaries](../SECURITY.md).

The [student requirements](../docs/PRODUCT_REQUIREMENTS.md) describe a separate student assignment: Java backend and database are required from the MVP; a team library and prompt administration are extended scope, and Drive is optional. Studio provides a visual example only. The [optional corporate Java deployment](../DEPLOYMENT.md) is a separate hosting path and is not the completed full product.
