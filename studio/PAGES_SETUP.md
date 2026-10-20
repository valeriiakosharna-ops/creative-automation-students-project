# Free GitHub Pages Studio — first launch

This version runs on GitHub Pages. No Render, Java server, local tools or corporate email are required. Use Firebase's **Spark** plan for Google sign-in and a private access directory, within its free quotas. OpenAI API usage is billed separately. Do not enable paid Firebase Storage, Cloud Functions or upgrade to Blaze for this version: event files stay in the browser.

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
3. Create a project, upload PNG/JPEG/WebP logos/photos, enter event details, and choose formats, variants and **English, Ukrainian, or both**. Generate a small first pack and download its ZIP.
4. The browser sends text and requested output specifications directly to the fixed OpenAI HTTPS endpoint. Original photos/logos stay local. The shared style guide is included in AI instructions and visual composition. No public proxy receives your key, and provider failures are not automatically retried.
5. **Forget key** clears the active key. On shared computers, sign out and use separate browser profiles; local file storage is not encrypted and does not protect against someone with access to your browser profile/device. A key in use can be inspected by that browser user or privileged extensions. Do not distribute a company-wide secret if you do not trust its users to know it.

OpenAI API billing/model access is required; a ChatGPT subscription is separate. Template mode needs no key and does not translate your text. No live Google/OpenAI access is verified until you finish this setup and try it.

## 6. Add or revoke colleagues

Open **Team access**, enter an exact Google account email and click **Add colleague**. Any Google-account domain is supported; a corporate address is not required. Click **Copy Studio link** and send it manually. No invitation email is sent.

Approved users get separate IndexedDB libraries by Firebase project and Google UID within their browser. They do not see your projects, share history across devices or get your API key. Each enters a visit key. Old prototype browser data is not automatically imported. Export ZIPs before clearing browser data; ZIPs are deliverables, not re-importable workspace backups.

**Revoke access** updates the private directory and the normal running app clears its visit key/blocks its UI when it receives the change. Restoring access deliberately resets the account binding so the owner can re-enroll an identity. An access-directory network failure blocks the normal app too; sign in again when connected.

## Security limits of Pages

The HTML, JavaScript, brand assets and Firebase public configuration are public. A client-side sign-in screen cannot make Pages private: someone can copy/modify the app and use it with their own inputs/key. Google/Firebase rules protect the private access directory; there is no server-held company key or shared material library to access. Revocation cannot prevent use of a copied app or erase local/downloaded files. UID-separated local databases prevent normal account mix-ups, not malicious inspection of a shared browser profile.

Firebase sees sign-in identities and the private roster. OpenAI sees text briefs and generated copy under its own API terms; `store: false` is requested but does not promise zero provider logging/retention. Neither receives original event photos/logos from this app. GitHub hosts public code/assets, not your event uploads.

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
