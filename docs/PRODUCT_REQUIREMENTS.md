# Creative Automation — Student Assignment

Build a Java-backed platform that turns an event brief and original brand assets into approved social visuals and captions. Studio is a visual reference only; its browser-based architecture is not the student backend architecture.

## MVP requirements

- **Backend and storage.** Build a Java backend with a database. Store users, projects, briefs, files or file references, generation history, captions and approvals on the server. Saved work must survive refresh and service restarts.
- **Access and shared library.** Provide sign-in, administrator-managed access and user roles. All admitted colleagues can browse the shared project library, search/filter projects and open their assets, results and history. Enforce permissions in the backend.
- **Event brief.** Collect the title, description, schedule, optional location/link, visual direction and brand colors. Support one date, a range, several dates or a written schedule. Allow uploading logos and optional event photos.
- **Output selection.** Support Instagram posts, Instagram Stories, Facebook and Google Chat. Require English, Ukrainian or both. Set a separate frame count for each format; show the total before generation. A carousel or Story sequence has one shared caption per language.
- **Three AI requests.** Use exactly three prompt templates: a JSON visual plan, post text generation and visual generation. Send them as separate API requests. Planning and caption generation can run in parallel; image generation uses the completed plan. Keep the templates in backend files in the MVP.
- **Original assets and visual quality.** Use every uploaded logo on every visual and at most one assigned original photo per frame. Use each photo once per network and language in a run. English and Ukrainian versions may reuse the same photos; Instagram posts and Stories share a pool within each language. Extra frames are information-only. Use light backgrounds and a coherent brand style; do not invent people or add a promotional call to action.
- **Preview and approval.** Show ordered visuals and one editable shared caption per post/language. Allow manual caption edits without an AI request. Require approval of every visual and caption before export.
- **Delivery.** Download approved visuals and post text as a ZIP. Also support saving the approved pack to a Google Drive folder selected by the user, with permission checks and useful file links. Keep project metadata in the database, not in Drive folder names.
- **History and failures.** Preserve briefs, results and versions in the shared library. Show generation progress and clear errors. Keep successful results after a partial failure; retry only failed requests when explicitly requested. Show paid request counts and avoid duplicate submissions or hidden retries.
- **Security and delivery quality.** Keep provider keys and Drive credentials protected on the backend; exclude them from frontend code, logs and exports. Protect all project files. Deliver documented APIs, database migrations, tests with mocked AI responses and clear setup instructions. Use English for the interface and documentation.

## Full product requirements

The full product includes every MVP requirement and adds only these two capabilities:

- **Edit the three prompts through the UI.** Users with the Editor role can update the visual-plan, post-text and visual-generation prompt templates in the interface. Administrators manage who has this permission. Save prompt versions and record the version used by each generation; changes apply to new requests.
- **Revise finished content through AI.** Let users enter change instructions for an individual generated visual or post caption and send a new request to the appropriate AI API. Preserve the previous version, update only the selected result and require approval again. Make the extra cost visible.

## Implementation steps

1. **Set up Java and the database.** Create the service, schema and migrations for users/roles, projects, briefs, assets, runs, posts, visuals and approvals.
2. **Build access and the library.** Implement authentication, permissions, project management, uploads, search and saved history through the backend API.
3. **Build the event form.** Connect the frontend to the API. Add schedules, logos/photos, brand colors, formats, languages and frame counts.
4. **Connect the three AI stages.** Create the three prompt templates. Generate the JSON plan and captions, validate photo allocation, then generate each visual from its plan, all logos and only its assigned photo.
5. **Add review and delivery.** Persist results, show previews, allow manual text edits and save approvals. Export approved packs to ZIP or the selected Drive folder.
6. **Verify the MVP.** Test database persistence, permissions, photo reuse, output counts, approval enforcement, exports and partial failures. Document how to run the backend, database and frontend.
7. **Add the full-product features.** Implement Editor access to the three prompt templates and AI-based revisions of individual visuals/captions, keeping versions and renewed approvals.
