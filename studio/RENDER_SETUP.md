# First launch on Render — no local tools

This guide is for the project owner. You need only a browser. The same private architecture stays in place: corporate Google sign-in, an exact-email access list, a server-only OpenAI key and an encrypted shared library. No real account addresses or secrets belong in the repository, screenshots, PRs or chat.

## 1. Merge the setup PR

On GitHub, open the setup PR, wait for its checks to pass and choose **Merge pull request**. Render uses `main`. If it is already merged, continue. You do not need to download the repository or install anything.

## 2. Prepare the corporate Google login

Open [Google Cloud Console](https://console.cloud.google.com/) using your corporate account. The project must belong to your company's Google Workspace organization.

1. Select a company-approved project, or ask IT to create one for Studio.
2. Open **Google Auth Platform** (it may also be reached through **APIs & Services → OAuth consent screen**).
3. Configure the application name and support/contact addresses in Google's private configuration. Set **Audience → Internal**. Request only `openid` and `email`; Studio needs no Gmail or Google Drive permissions.
4. Open **Clients → Create client**, choose **Web application**, and name it **Creative Automation Studio**.
5. If the final Studio address is not known yet, leave the URI lists empty for now. Create the client; you will add its exact redirect URI in step 4 below. Authorized JavaScript origins are not required for this server-based sign-in flow.
6. Save **Client ID** and **Client Secret** in the company's approved password manager. Copy the secret when Google displays it. These are configuration values for Render, never code to paste into GitHub.

If you cannot select **Internal**, do not switch to External as a workaround. Ask the Workspace administrator to create/approve the application in the company organization. Google may require IT to approve the app even when it is Internal; company MFA rules still apply.

## 3. Create the Render service

1. Open [Render Dashboard](https://dashboard.render.com/) in a company-controlled account. Enable two-factor authentication for that account.
2. Choose **New → Blueprint**, connect GitHub if requested, and select this repository: `valeriiakosharna-ops/creative-automation-students-project`.
3. Choose branch **main** and the root **render.yaml** template.
4. Review the paid **Starter** web service and **10 GB persistent disk**. Confirm the current hosting/storage price before creating it. Do not replace the disk with temporary storage or switch this private library to a free service without a persistent disk.
5. Fill only these four private values when prompted:

| Field                     | What to paste                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `STUDIO_OWNER_EMAIL`      | Your exact primary corporate Google Workspace email. This account becomes the owner. |
| `GOOGLE_CLIENT_ID`        | Client ID from step 2.                                                               |
| `GOOGLE_CLIENT_SECRET`    | Client Secret from step 2.                                                           |
| `CREATIVE_OPENAI_API_KEY` | The company's OpenAI API project key.                                                |

Render provides the site address automatically, the application derives the corporate domain from the owner's email, and the template generates `STUDIO_STORAGE_KEY`. You do not need to add domain/URL fields, build commands or local configuration files. A ChatGPT subscription does not include OpenAI API credits: the API project needs model access and API billing.

6. Create/deploy the Blueprint. Wait for the service to become **Live**. Open the HTTPS service address shown in its Overview and bookmark it. Until you add Google's callback in the next step, the page can load but Google sign-in will not work.

Do not manually create or rotate `STUDIO_STORAGE_KEY`: Render generates it once for the library. Preserve the original value privately in your approved secret backup. Losing/changing it makes saved material unreadable. Keep the persistent disk and arrange a tested backup/restore procedure with IT; downloading a content ZIP is not a full workspace backup.

## 4. Connect Google to the actual site address

1. Copy the exact HTTPS site address from Render, without a trailing slash or extra path.
2. Return to **Google Auth Platform → Clients** and open the web client created in step 2.
3. Under **Authorized redirect URIs**, add the site address followed by:

```text
/login/oauth2/code/corporate
```

For example only, if Render gave you `https://your-studio.onrender.com`, the full URI is:

```text
https://your-studio.onrender.com/login/oauth2/code/corporate
```

Replace the example host with your actual Render host. Do not use the GitHub repository address, a GitHub Pages address, or `/signin.html`. Do not add a slash at the end of the callback.

4. Save the Google client configuration. Google changes can take a little time to apply. No new Render secret or rebuild is needed for this callback-only change.
5. Return to Studio, click **Continue with corporate Google**, and select the exact owner account from `STUDIO_OWNER_EMAIL`.

Render's default HTTPS address is the simplest first launch. For a custom domain later, IT sets `STUDIO_PUBLIC_URL` to the custom HTTPS origin in Render, updates Google's exact redirect URI, and saves/redeploys. Existing explicit settings remain supported. Non-Render company hosting also sets `STUDIO_PUBLIC_URL` manually; see [Deployment](../DEPLOYMENT.md).

## 5. Check the private workspace

1. Signed in as owner, create a test project and save a draft.
2. Use an incognito/private browser window to open the Studio address: it must show sign-in, without your project or uploaded material. A colleague not added by you must not enter, even with a company address.
3. Generate a small test pack: one format, one language and one variant. Review its PNG and caption, then download the ZIP. This checks real OpenAI key/model/billing access and spends API credits.
4. Refresh and confirm the project and history remain. Ask IT to check persistence across a service restart and validate backups before relying on the library for important work.

The public site address reveals the sign-in page and branding; projects, files and APIs require approved sign-in. All approved colleagues share view/edit/delete/export access to the library. Revocation cannot recall downloaded files.

## 6. Add colleagues and use the product

1. In Studio's sidebar, open **Team access**.
2. Enter a colleague's exact primary corporate Google email and click **Add colleague**.
3. Click **Copy Studio link** and send the link using your approved company channel. No invitation email is sent automatically.
4. The colleague opens the link and signs in with that exact Google account. They need no API key or local tools.
5. Use **Revoke access** to block future requests or **Restore access** to approve them again. No restart or deployment is needed.

Only the owner can see/manage the access list. Do not change `STUDIO_OWNER_EMAIL` to invite someone: it does not transfer ownership of an existing encrypted library.

## Updates and common problems

After a code change is merged into `main`, Render builds and deploys automatically. The four private values and persistent library do not need re-entry. This template redeploys on commits; the independent GitHub checks are not an additional rollout gate. Keep the disk and original encryption key across updates.

| What you see                      | What to check                                                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google `redirect_uri_mismatch`    | Google's redirect URI must exactly match the current Render HTTPS address plus `/login/oauth2/code/corporate`.                                       |
| Google says the app is blocked    | IT must approve the Internal application and account permissions. Do not make it public to bypass company policy.                                    |
| Corporate account is not approved | Select the owner account or ask the owner to add the exact primary address in Team access.                                                           |
| Render deployment fails           | Check all four fields and persistent disk. Ask IT to inspect logs without sharing keys or private configuration. The server refuses unsafe fallback. |
| Provider error during generation  | Check OpenAI API billing, key and model permissions. Do not paste the key in the browser or chat.                                                    |
| An upgrade fails                  | Ask IT to restore a compatible private version with the same disk/key. Never fall back to the old unauthenticated public prototype.                  |

For everyday creation and languages/assets/ZIP rules, see [Quickstart](QUICKSTART.md). Advanced hosting, backups and internal GitLab instructions are in [Deployment](../DEPLOYMENT.md).
