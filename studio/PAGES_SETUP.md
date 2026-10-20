# Free GitHub Pages Studio — first launch

This version runs on GitHub Pages. No Render, Java server, local tools or corporate email are required. Use Firebase's **Spark** plan for Google sign-in and a private access directory, within its free quotas. OpenAI API usage is billed separately. Do not enable paid Firebase Storage, Cloud Functions or upgrade to Blaze for this version: event files are stored in the browser; AI-mode reference images are also transmitted to OpenAI.

Google sign-in still requires registering an application. Firebase Console manages the underlying Google project/OAuth setup, so you do not need to configure Google Cloud Console manually. You must control the GitHub and Firebase projects. Nothing in the repository provisions your real Firebase service or credentials.

## 1. Merge the Pages PR

Merge the free Pages PR into `main` after its checks pass. The previous Render setup PR is not required for this path. GitHub Actions builds the full app at the site's `studio/` path. With no Firebase settings it shows a locked setup screen, not an open workspace.

In GitHub **Settings → Pages → Build and deployment**, select **GitHub Actions**. After a successful deployment, the Pages settings/workflow shows the actual site URL. Bookmark the application at its `studio/` path. Never use the GitHub repository URL as the app URL.

## 2. Create Firebase, staying on Spark

1. Open [Firebase Console](https://console.firebase.google.com/), create a project with an arbitrary non-confidential name, and stay on **Spark** without enabling billing. Google Analytics is not needed.
2. Open **Build → Authentication → Get started → Sign-in method / Sign-in providers**. Enable **Google**. Choose an approved support contact and save. Personal Gmail and Workspace Google accounts can both be invited.
3. In Authentication **Settings → Authorized domains**, add your Pages hostname only, such as `your-account.github.io`. Do not include `https://` or the repository path. Keep Firebase's default project auth domain.
4. Google/Firebase may show the application's public name/support contact on sign-in screens. Choose information you are comfortable showing; this is separate from your private access roster.

## 3. Protect the private access directory

1. Open **Build → Firestore Database → Create database**. Use the **Standard** database, ID **(default)**, an appropriate region and **production mode**. Stay on Spark; no file Storage bucket is used.
2. Open Firestore **Rules**. Copy the entire [firestore.rules](firebase/firestore.rules) file from this repository into the editor and click **Publish**. Do not use test mode or `allow read, write: if true`.
3. In Firestore **Data**, create collection **studioSettings**, document ID **access**.
4. Add one field: **ownerEmail**, type **string**, value **your exact primary Google account email in lowercase**. Enter the value only in Firebase Console, never in GitHub or chat. Save.

No need to enter `ownerUid`: the first verified Google sign-in with that exact owner email binds it automatically. After binding, a different Firebase identity cannot silently inherit the owner's access. The app does not permit changing the owner or removing that binding. The console administrator remains trusted and can manage the database directly.

The rules permit only the owner to list/grant/revoke colleagues. Each Google user can read/bind only their own exact invitation. They cannot approve themselves, browse others' addresses or write project files/API keys to Firestore. All unrelated collections are denied. Firebase Authentication also holds sign-in identities; it can contain accounts that attempted sign-in even if they were not approved for Studio.

## 4. Connect the Pages build with two PUBLIC Firebase values

1. In Firebase **Project settings → General**, find **Project ID**.
2. Under **Your apps**, register a **Web app** (the `</>` icon). No Firebase Hosting or Analytics is needed. In its web configuration, find **apiKey**. This is a public Firebase application identifier, **not your OpenAI API key**. The app uses the default `PROJECT_ID.firebaseapp.com` auth domain.
3. In GitHub **Settings → Secrets and variables → Actions → Variables**, add these two **Repository variables**:

| Name                         | Value                                                            |
| ---------------------------- | ---------------------------------------------------------------- |
| `STUDIO_FIREBASE_PROJECT_ID` | The Firebase Project ID.                                         |
| `STUDIO_FIREBASE_API_KEY`    | The public Firebase web `apiKey`, normally starting with `AIza`. |

Never add owner/colleague emails, an OpenAI key, Firebase service-account JSON or a Google client secret to the Pages build. These two Firebase values are intentionally visible in the published site's runtime file. Firestore rules, not secrecy of that configuration, protect the access directory.

4. Open GitHub **Actions → Build and deploy project site → Run workflow**, select **main** and run it. Updating repository variables alone does not redeploy the site. Wait for deployment to pass, then refresh the Pages Studio address.

## 5. Sign in and generate

1. Click **Sign in with Google**, allow the popup and select the exact `ownerEmail` account. Until Firebase/rules/owner setup is complete, access stays blocked.
2. Click **Connect OpenAI**, paste your API key and choose **Use key for this visit**. The field clears after submission. The key stays in page memory only; refreshing, signing out, revocation in the normal app or closing the page clears it. It is never written to browser storage, Firebase, GitHub, history or ZIPs.
3. Create a project, upload PNG/JPEG/WebP logos/photos, enter event details, and choose formats, variants and **English, Ukrainian, or both**. Generate a small first pack, review/approve every visual and post, then download its ZIP.
4. The browser starts separate planner and copywriter requests in parallel, then generates each visual through OpenAI image edits with the plan, assigned photo and all logos. Revisions also send the previous visual and user feedback. All calls use fixed OpenAI HTTPS endpoints. The shared style guide is included in all three prompt stages. No public proxy receives your key, and provider failures are not automatically retried.
5. **Forget key** clears the active key. On shared computers, sign out and use separate browser profiles; local file storage is not encrypted and does not protect against someone with access to your browser profile/device. A key in use can be inspected by that browser user or privileged extensions. Do not distribute a company-wide secret if you do not trust its users to know it.

OpenAI API billing/model access is required; a ChatGPT subscription is separate. Template mode needs no key and does not translate your text. No live Google/OpenAI access is verified until you finish this setup and try it.

## 6. Add or revoke colleagues

Open **Team access**, enter an exact Google account email and click **Add colleague**. Any Google-account domain is supported; a corporate address is not required. Click **Copy Studio link** and send it manually. No invitation email is sent.

Approved users get separate IndexedDB libraries by Firebase project and Google UID within their browser. They do not see your projects, share history across devices or get your API key. Each enters a visit key. Old prototype browser data is not automatically imported. Export ZIPs before clearing browser data; ZIPs are deliverables, not re-importable workspace backups.

**Revoke access** updates the private directory and the normal running app clears its visit key/blocks its UI when it receives the change. Restoring access deliberately resets the account binding so the owner can re-enroll an identity. An access-directory network failure blocks the normal app too; sign in again when connected.

## Security limits of Pages

The HTML, JavaScript, brand assets and Firebase public configuration are public. A client-side sign-in screen cannot make Pages private: someone can copy/modify the app and use it with their own inputs/key. Google/Firebase rules protect the private access directory; there is no server-held company key or shared material library to access. Revocation cannot prevent use of a copied app or erase local/downloaded files. UID-separated local databases prevent normal account mix-ups, not malicious inspection of a shared browser profile.

Firebase sees sign-in identities and the private roster. OpenAI receives text briefs, assigned photos, original logos, generated visuals used for revisions, and user feedback under its API terms. Text requests use `store: false`; image edits do not support that parameter. Neither setting promises zero provider logging/retention. Firebase receives no event images or content from this app. GitHub hosts public code/assets, not your event uploads.

Stay on Spark for a no-billing Firebase setup. Free quotas are finite: exhaustion may temporarily block access. Provider plans/policies can change. No card-free unlimited storage or API generation is promised. For a genuinely private application and shared server library, keep the separate corporate Java deployment instead.

## Troubleshooting

| Problem                                      | Check                                                                                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Locked setup screen                          | Add both public repository variables and rerun the Pages workflow.                                                                     |
| Google unauthorized-domain error             | Add the exact Pages hostname in Firebase Auth authorized domains.                                                                      |
| Popup blocked/closed                         | Allow the Google popup and retry the sign-in button.                                                                                   |
| Account not approved / directory unavailable | Check the signed-in primary email, private `ownerEmail` or invitation, published Firestore rules, Spark quotas and network connection. |
| No Team access button                        | Only the configured owner manages colleagues.                                                                                          |
| OpenAI 401/403/404/429                       | Check key, model access, API billing and provider limits. Never send a key in chat.                                                    |
| Projects missing                             | Use the same Google account, Firebase project, site origin and browser profile. There is no cloud workspace sync.                      |

## Staying signed in after refresh: available options

The current build deliberately uses Firebase `inMemoryPersistence`, so a refresh requires Google sign-in again. This is separate from the OpenAI key lifetime. No persistence change is applied automatically by these instructions.

| Option                          | What it keeps                                                                             | Appropriate use                  |
| ------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------- |
| `inMemoryPersistence` (current) | Current loaded page only                                                                  | Shared/untrusted browser profile |
| `browserSessionPersistence`     | Google sign-in through refresh in the same tab; normally ends when that tab/window closes | Recommended convenience option   |
| `browserLocalPersistence`       | Google sign-in across browser restarts until sign-out/session invalidation                | Trusted personal device only     |

A developer can change the imported persistence provider and the `setPersistence` call in `src/pages-auth.js`, then merge/redeploy. The private Firestore allowlist must still be checked against the server after restoring a login, and revocations must still block the normal app. **Never persist the OpenAI key with the Firebase session**: it stays in memory and clears on refresh regardless of the selected login mode. Any persisted sign-in token is sensitive browser data, so users should sign out on shared devices.

## Free cloud storage options for a future shared library

The current version has local libraries only. Existing Firestore rules explicitly deny project/file collections: the following are design options, not enabled features.

- **Firestore on Spark:** useful for project names, run metadata, captions and file references within the current free quotas. Documents are limited to 1 MiB; do not put photos/PNGs or base64 archives in them. New rules must restrict reads/writes to approved team members and define deletion/ownership. Confirm current quotas in Firebase Console before relying on the free tier. Firebase file Storage currently requires a billing-enabled Blaze project, so it is not promised as a completely free file solution.
- **Shared Google Drive folder:** JSON files can hold briefs/manifests and folders can hold PNGs/ZIPs. A future integration can let the user choose a folder through Google Picker and use the least-privilege `drive.file` scope for app-created/user-selected files. Firebase sign-in alone grants no Drive access. Drive API/Picker and OAuth consent setup are separate and can require Google Cloud Console; this adds setup again. Avoid permanent refresh-token storage in Pages. Personal Drive has limited capacity shared with other Google services; Workspace capacity/policies vary.
- **Manual Drive handoff now:** download the ZIP, upload it to a private shared folder and grant exact Google accounts access. This needs no additional APIs, deployment or app changes. It is a practical free starting point within existing Drive capacity, but does not synchronize the app’s local project history.

Drive is file storage rather than a transactional database: concurrent edits need version/conflict handling, search/indexing needs design, and folder permissions are separate from the Studio allowlist. Revoking Studio access does **not** revoke Drive sharing or delete files already downloaded. A truly shared library therefore needs both app access checks and correctly configured storage permissions. Do not enable public or “anyone with the link” sharing for confidential event materials.

Reference: [Firebase Auth persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence), [Firestore quotas](https://firebase.google.com/docs/firestore/quotas), [Firebase Storage billing changes](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [Google Picker](https://developers.google.com/drive/picker/guides/overview), and [Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

## Generation and approval after setup

Use **Create content pack** to start two parallel text requests, followed by one image edit per visual. See [Quickstart](QUICKSTART.md) for the per-image feedback and post-text approval workflow. An API key needs image-model access, billing and any organization verification required by OpenAI. This changes the data sent to OpenAI compared with the older text-only MVP: review the provider terms before uploading confidential materials. API keys remain memory-only and are never stored with the history/approval state.

ZIP is generated only when every requested visual and post is complete and approved. Regeneration is a separate explicit paid action for one image. No live provider setup or real Firebase changes are performed by this repository update.
