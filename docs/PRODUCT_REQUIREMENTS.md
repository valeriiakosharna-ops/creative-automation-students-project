# Creative Automation — Product Requirements

## Product goal and users

Help event organizers and communications teams turn one event brief and existing brand assets into a coherent, reviewed set of social visuals and captions. The product creates downloadable content; it does not publish to social networks automatically.

Primary user: an admitted colleague who creates and approves content. MVP owner: controls who is admitted to the product. Full-product administrators: manage access, prompts and spending; editors create content; viewers inspect approved work according to permissions.

## Scope and implementation status

The student assignment requires a Java backend and a database in the MVP. Studio is only a visual/interaction example: its GitHub Pages/Firebase/browser-storage architecture differs deliberately from the student project and must not define the backend requirements. The repository’s optional Java server is also not a completed implementation of this assignment. OpenAI generation is paid separately from hosting.

This document is the acceptance baseline for the student assignment. Requirements describe observable business behavior; the Studio demonstration is not an implementation or acceptance baseline for the Java backend. Keep the student page and these IDs aligned when scope changes.

## MVP requirements — Java backend and database are mandatory

### MVP-01 — Authenticated personal workspace

Users sign in and work with their own projects. The Java backend verifies identity and authorization on every protected operation and file download; hiding interface controls is not access control. An owner manages who may use the product. A shared team-wide project library is extended scope.

### MVP-02 — Mandatory database and durable history

Create, name, rename and delete projects. Persist users, project ownership, event briefs, assets/file references, generation runs, frame order, captions, approvals and prompt versions in a database from the first MVP. Store files in protected server/file storage. Saved work must survive refresh, a different device and a backend restart; revisions preserve previous versions.

### MVP-03 — Complete event brief

Require an event title, description and schedule. Support one date, a date range, several dates or a written schedule. Capture a time zone; allow optional time, location, event link and creative direction. Preserve the supplied facts.

### MVP-04 — Brand assets

Require 1–8 original logos; allow 0–20 photos. Support PNG, JPEG and WebP, up to 10 MB and 24 megapixels per file, and 100 MB total. Show uploaded assets and allow removal before generation. Let users choose brand colors.

### MVP-05 — Formats, languages and quantities

Offer Instagram post, Instagram Story, Facebook and Google Chat as independent selections. Require English, Ukrainian or both for generated content. Let users choose 1–10 frames per selected format and language, up to 24 visuals in one run. The application interface and assignment are English.

### MVP-06 — One story, one shared caption

Treat multiple frames as one ordered carousel or connected sequence per format/language. Generate one shared, channel-specific caption for that sequence; do not repeat the caption under every frame. Show expected frame and caption counts before submission.

### MVP-07 — Original assets and people

Include every supplied logo on every visual. Allocate at most one uploaded photo to a frame. Use each photo at most once per social network within a run, including both languages; Instagram feed and Stories share that pool. Remaining frames are information-only. Never request invented people or replacement faces; no-photo frames contain no people.

### MVP-08 — Coherent creative direction

Use light backgrounds, the supplied palette, logos and a shared campaign identity. Adapt the composition to each channel without rigid grids or typography rules. Frames should contribute different points to the same story. Do not add a promotional call to action or closing invitation.

### MVP-09 — Backend AI orchestration

The Java backend owns AI requests and generation status. Keep versioned prompts in the repository. Create a campaign outline and a separate caption request. Before generating each visual, plan that frame with all original logos and only its assigned photo, then pass the plan and the same originals to image generation. Copy generation and visual work can progress independently.

### MVP-10 — Review before export

Display generated images and editable shared captions in the browser. Provide a feedback field and paid regeneration action for each visual. Reuse a valid frame plan when revising its image; re-plan only when required. Manual caption edits make no AI call. Explicitly approve every visual and caption before ZIP export.

### MVP-11 — Useful ZIP delivery

Export approved PNGs in frame order, one text file per format/language, a combined posts.txt and run metadata. Use identifiable file names and include the brief, source allocation and generation versions. Never include API keys or original source uploads in the delivery archive.

### MVP-12 — Recoverable failures and visible costs

Keep successful images, captions and paid planning responses when another item fails. Missing styling fields, response ID differences and advisory caption lengths must not discard useful content. Show stage-specific status and allow an explicit retry of only the failed visual. No hidden paid retries. Show request counts and explain that OpenAI usage is paid, even when hosting is free.

### MVP-13 — Provider keys and private data

Keep the provider key in protected backend configuration; never put a service key in the frontend, database records, logs, exports or repository. If user-supplied keys are supported, forward them transiently and never persist them. Authorize access to every project and file. Explain which event content and images are sent to the AI provider.

### MVP-14 — Practical post copy

Write in the requested language and adapt the tone to the channel. Use recommended caption lengths as editorial guidance, not blocking character budgets. Preserve facts and complete URLs. Do not claim current trends unless a separately enabled public research request returns supporting sources.

### MVP-15 — A Java service with a clear API

Implement the product backend in Java. Expose a documented API for projects, uploads, generation/status, text edits, per-visual revisions, approvals and ZIP export. Validate inputs on the server, enforce export approval there and return actionable errors. Reopening a generation must not silently submit a second paid job.

### Export dimensions

| Format          | PNG dimensions | Text unit                                      |
| --------------- | -------------- | ---------------------------------------------- |
| Instagram post  | 1080 × 1080    | One caption per carousel/language              |
| Instagram Story | 1080 × 1920    | One accompanying message per sequence/language |
| Facebook        | 1200 × 630     | One caption per ordered set/language           |
| Google Chat     | 1200 × 675     | One internal message per ordered set/language  |

A Story accompanying message is an export artifact, not a claim that Stories have a native caption field. This MVP does not validate every destination’s live publishing restrictions because it does not publish directly.

## Extended-product requirements and optional Drive integration

The full product retains the mandatory Java backend, database, private file storage and ZIP delivery from the MVP. It adds a shared team library, richer roles, prompt administration and operational controls. Google Drive integration (FULL-04–FULL-06) is an optional extension: it is not required to pass the MVP or the core extended-product delivery.

### FULL-01 — Shared team library

Extend the mandatory MVP database with team membership, project sharing and collaboration. Admitted colleagues can browse the same permitted project library across devices. Keep project permissions and export records in the database; Google Drive folder names are not database records.

### FULL-02 — Roles and project permissions

Provide owner, administrator, editor and viewer roles. Define who can view, generate, revise, approve, export, delete and manage access. Enforce permissions on every backend operation and asset download. Approved colleagues can browse the common library; editing and administrative actions follow their roles.

### FULL-03 — A usable team library

Provide searchable project cards/list views, filters for event, owner, date, language, format and status, and clear draft/approved/exported states. Show the brief, ordered visuals, shared captions, history and exports together. Support tags, archive/restore and clear empty/loading/error states.

### FULL-04 — Google Drive connection and folder picker — optional

Let an authorized user connect Google Drive and select an accessible destination folder per project or export. Show the selected folder, validate write permission, support changing it and explain ownership. Request the narrowest workable OAuth scopes. Shared Drives are optional unless confirmed in the delivery scope.

### FULL-05 — Reliable Drive delivery — optional

Save approved images, per-post text, ZIP and manifest to the selected folder. Record Drive file IDs and export status in the database, return useful links and avoid duplicate uploads on retries. Preserve results when permission, quota or network errors occur; offer ZIP download and explicit upload retry without regenerating AI content.

### FULL-06 — Secure Drive credentials — optional

Handle the OAuth callback and any refresh tokens in a protected service. Encrypt stored tokens, keep them out of frontend bundles and logs, support disconnect/revocation and state what happens to existing Drive files. Re-check authorization before delivery; the sign-in session alone does not grant Drive access.

### FULL-07 — Administrator prompt editor

Let administrators edit campaign, frame-planning, image and caption prompts in an authenticated interface. Provide variable validation, draft preview, a deliberately triggered paid test and publish/rollback controls. Keep the original-reference, people, credential and access protections outside editable prompt text.

### FULL-08 — Versioned prompt governance

Save an immutable prompt version for every generation. Prompt changes affect new work only; historical results and approval states remain reproducible. Audit who changed and published a prompt and when. Prevent ordinary editors/viewers from reading secret configuration or publishing prompt changes.

### FULL-09 — Private managed generation

Run AI calls and job orchestration in a protected backend. Use a managed organization key or a documented per-user policy; never deliver stored service credentials to the browser. Add role-based spending limits, concurrency limits, cost reporting and explicit paid-retry controls.

### FULL-10 — Durable jobs and collaboration

Continue accepted jobs after a tab closes. Persist progress, handle timeouts and prevent duplicate submissions/exports. Use version checks or a clear conflict-resolution flow for simultaneous edits. A revision preserves previous output and resets the relevant approval.

### FULL-11 — Private files and reliable operations

Protect source uploads and outputs with authenticated delivery, storage rules and retention/deletion policies. Back up the database and files, test restoration, monitor job failures and maintain an audit trail without keys or confidential content in logs.

### FULL-12 — Team onboarding and administration

Provide an understandable setup flow, colleague invitation/access management, usage visibility and support information. Define ownership transfer and what happens when a colleague loses access. Verify the full deployment, authentication, storage and export flow before calling it production-ready.

## Acceptance scenarios

1. **Counts and text:** request 4 Instagram feed frames and 2 Story frames in English and Ukrainian. Receive 12 ordered visuals and 4 shared captions, with the appropriate sizes and labels. No caption is repeated under each frame.
2. **Photo allocation:** upload 3 photos and request 6 Instagram visuals across feed, Stories and languages. Exactly 3 frames use one different original photo each; the other 3 contain information without people. Every frame uses every logo. A different network may reuse those photos.
3. **Source isolation:** inspect mocked requests. Each frame planner and image request receives all logos and at most its one assigned original photo. No other event photo or previous AI image is uploaded. Visually review logo fidelity, readable text and original people before approval.
4. **Review and cost:** revise one image. Only its necessary planning/image calls run; other images and captions remain. A manual text edit costs no AI call. ZIP remains unavailable until all requested visuals and shared captions are complete and approved.
5. **Partial failure:** simulate a missing planner field, an incorrect response ID, a 651-character caption and a single failed image call. Useful output remains visible; stylistic/schema differences do not fail the whole run. The failed request is identified, and no hidden paid retry is made.
6. **Mandatory database and security:** save a project, reopen it on another device and restart the Java backend; its brief, assets, captions, approvals and run history remain. Demonstrate the persisted records and relationships. Another user cannot access it by guessing IDs or calling the API directly. Provider credentials appear in neither the frontend bundle, business tables, logs, exports nor source control.
7. **Full product — library and roles:** a colleague sees a project explicitly available through the common team library. Viewer/editor/admin operations follow the permission matrix. Concurrent edits do not silently overwrite one another. History survives service restarts and tested backup restoration.
8. **Optional Drive extension:** choose a writable folder, export approved content and verify files and database links. Revoke Drive access mid-export: results stay available, ZIP still works, and retrying delivery after reconnect creates no duplicate generation or upload.
9. **Full product — prompts:** publish a tested administrator prompt version, generate a new run and verify its recorded version. Previous runs stay unchanged. Roll back. An ordinary editor cannot publish prompts or access service credentials.

## Delivery plan for students

1. **Understand the workflow:** interview one organizer, identify required inputs and agree on MVP scope, cost expectations and success measures. Sketch brief → generation → review → ZIP. Design the database and API before implementing the first generation.
2. **Deliver a vertical slice:** a Java service and database, one persisted project, one format/language, uploaded logos, one generated visual and caption, preview and ZIP. Use fake assets and mocked provider responses while developing.
3. **Complete the MVP:** add independent counts, languages, schedules, deterministic photo allocation, per-frame planning, revisions, server-enforced approvals and database-backed history. Exercise failures before adding cloud storage.
4. **Verify and hand over:** demonstrate the acceptance scenarios, a clean deployment, keyboard/mobile use and clear setup instructions. Report known limitations and actual cost per accepted pack. Use tests for risky logic rather than styling snapshots alone.
5. **Build the full product separately:** agree on roles/data ownership, then extend the existing Java backend/database with the common library, prompt administration and operational controls. Add Google Drive only if that optional extension is selected. Do not label an unfinished integration as an MVP requirement.

## Required technical delivery

- **Java backend:** implement the application service in Java; Spring Boot is recommended. JavaScript/HTML/CSS provide a thin client. The frontend calls the backend for product operations; it does not own persistence, authorization, approval enforcement or the AI provider secret.
- **Database from MVP:** use a real persistent database; PostgreSQL is recommended. Provide versioned migrations and an entity/relationship diagram. Include users, project ownership, briefs, assets/file locations, runs, posts, ordered visuals, approvals and prompt-version metadata. Explain foreign keys, constraints and transactions; do not treat browser storage or a folder tree as a database.
- **Private files:** keep upload/generated binaries in protected server/object storage, or the database if justified. Store stable references and metadata in the database. Require authorization to retrieve them. Drive is not required.
- **API contract:** document request/response examples, authentication, validation errors, generation status and protected ZIP export, preferably using OpenAPI. Persist requested counts, source assignment and run status; do not trust client-supplied ownership, approval flags or provider credentials.
- **Tests and reproducible setup:** test allocation, permissions, approval transitions, repository/database persistence, partial provider failures and export contents. Use real database integration tests and mocked AI responses, with no live paid key in CI. Supply setup instructions, sample non-confidential data and a repeatable migration/test command.
- **Deployment:** the Java service and database need suitable hosting. GitHub Pages can host a frontend only. The demonstration Studio’s free browser architecture is not the required student architecture.

## Out of scope unless explicitly agreed

Automatic social publishing, analytics dashboards, billing subscriptions, video generation, arbitrary output languages, unattended bulk campaigns and a complete social-media scheduler. Google Drive is a delivery/storage integration, not a substitute for the project database or access-control service.

## Evaluation

Measure time from brief to approved pack, first-pass approval rate, factual/brand accuracy and cost per accepted pack against the organizer’s manual workflow. Agree on target values with the user; do not invent universal engagement or trend guarantees.
