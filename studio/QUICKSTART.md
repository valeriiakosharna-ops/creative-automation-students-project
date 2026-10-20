# Use Studio online — no installation

You do not need Java, Node.js, Docker, a terminal, or a local server on your computer. A hosting service runs the complete app. You open its HTTPS address and paste your own OpenAI API key for the visit.

## First time: create your hosted site

Do this after the hosting PR is merged into the repository's `main` branch.

1. Open **[Deploy to Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fvaleriiakosharna-ops%2Fcreative-automation-students-project)** in your browser.
2. Sign in or create a Render account. Connect GitHub if prompted and give it access to this repository. Private repositories require access through the owning account/organization.
3. Review the `creative-automation-studio` web service and confirm deployment. The committed `render.yaml` selects the Free plan and the Docker build. No OpenAI key or other secret is required in this form.
4. Wait until the service is **Live**. The initial build takes several minutes.
5. Open the **HTTPS service URL** shown by Render. Bookmark it. This is your complete Studio site, including its AI server.

If Render asks for a Blueprint rather than showing the deploy-button flow: Dashboard → **New → Blueprint** → connect this repository → select `main` and `render.yaml` → review → deploy.

Render controls account verification, plan availability and pricing. Review any billing prompt before accepting it. Free services can sleep when idle and take about a minute to wake. Your own OpenAI API usage is billed separately. For an always-on site, choose an appropriate hosted plan or use company infrastructure.

## Every visit: paste your key and create a pack

1. Open your bookmarked Studio HTTPS URL.
2. Click **Connect OpenAI** at the top.
3. Paste your OpenAI API key and click **Use key for this visit**.
4. Create a project or click **Use example brief**. Upload your logos and event photos, enter event details, and choose formats, quantity and **English, Ukrainian, or both**.
5. Keep **AI · your OpenAI key** selected and generate the pack. Start with one format/language/variant for your first test.
6. Review the visuals and channel-specific captions, then download the ZIP.

No backend address, local configuration file or server restart is needed. **Check server** checks availability only; OpenAI verifies your key/model access during your first generation. A ChatGPT subscription does not include OpenAI API credits.

To try the whole image/ZIP workflow without spending API credits, choose **Template · no API key needed**. It uses supplied English/Ukrainian wording and does not translate text automatically.

## Where the key and work live

- Your key stays in the open page's memory. **Forget key**, refreshing or closing that page clears it. Paste it again on a new visit. Studio does not save it in browser storage, projects, history, exports or application logs.
- The key is sent over HTTPS to **this site's server**, which forwards it in the OpenAI request header. It is not sent to a separately entered backend URL. Only enter a key on a Studio deployment you trust. Hosting administrators control that server.
- Each visitor supplies their own key. Hosted mode never falls back to an owner's shared key, even if one was accidentally set in the hosting environment. There is no shared account or sign-in in this MVP.
- Projects, uploads and history remain in IndexedDB in your browser, at this site's origin. They survive a normal server restart, but are not synced across browsers/devices. Clearing browser data or changing the domain separates/removes the workspace. Keep important ZIPs.

Every visual contains every uploaded logo. A photo is used at most once per social network/run across variants and languages; Instagram post and Story share a pool. Extra outputs use information-only layouts. The shared brand policy applies to visuals and AI copy; ZIPs contain PNG/caption pairs, the brief, manifest and `style-guide.json`.

## Future changes build online

On GitHub, pushes to `main` build/test the site and the complete container. Render is configured to redeploy from `main` automatically. A PR builds without publishing a container. GitHub Pages still serves the student brief and static Template demo; its URL is different from your full hosted Studio URL.

For an **internal GitLab**, ask IT to follow `DEPLOYMENT.md` in the repository: the same Dockerfile builds the app, the included GitLab pipeline tests/publishes it to the project registry, and the company's container platform runs it behind HTTPS. Users then get one internal URL and enter their own key. IT needs to configure the runner/hosting once; users need no local tools. Internal hosting must allow outbound `api.openai.com`.

Do not deploy this as a Pages-only site and expect it to execute Java. GitHub/GitLab repositories and registries store code/images; they do not by themselves run an always-on application server.

## If something does not work

| What you see | What to do |
| --- | --- |
| Site is waking up | Wait for the free hosted service to start, then reload. |
| No Connect OpenAI button | Open the full hosted Studio URL, not its GitHub/GitLab Pages demo. |
| Add your key for this visit | Paste it through Connect OpenAI; refresh/new tabs intentionally forget it. |
| Provider HTTP 401 | Check that the complete API key was pasted without quotes/spaces and has not been revoked. |
| Provider HTTP 403/404 | Check OpenAI project/model access. Hosting defaults to `gpt-4.1-mini`. |
| Provider HTTP 429 | Check API credits/billing or wait for a provider rate limit. ChatGPT billing is separate. |
| Server is handling another run | Wait for that run to finish. The MVP processes one AI request at a time. |
| Network/timeout error | Check hosting logs/provider status; IT should check outbound HTTPS, proxy and trusted CA. |
| Text does not fit | Shorten the visual title, optional summary or location. Minimum brand type sizes are preserved. |
| Projects are missing | Use the same browser/profile and exactly the same bookmarked domain. There is no cloud workspace sync. |

For optional contributor-only local development, see `studio/LOCAL_DEVELOPMENT.md` in the repository. Local setup is not required for hosted use.
