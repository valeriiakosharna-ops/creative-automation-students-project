# Private Studio — browser-only use

Studio runs on company-controlled hosting. You and your colleagues need only a browser: no Java, Node.js, Docker or terminal on your computer.

## One-time setup

Ask the hosting/Google Workspace administrator to follow [Private deployment](../DEPLOYMENT.md). They connect a Google **Internal** OAuth application, set the initial owner's exact email privately, store the company OpenAI key in the hosting secret manager, and attach a persistent encrypted library disk. The repository contains no real domain, colleague addresses or keys. The Google connection and hosting still need this one-time configuration before a real team can sign in.

The application container is private by default and refuses to start without its required private settings. The public GitHub Pages site contains the student brief, style guide and a Studio landing page. It does not host your team workspace.

## Add a colleague

1. Open the private Studio HTTPS address and choose **Continue with Google**. Sign in with the owner account configured by your administrator.
2. Click **Team access** in the sidebar. Only the owner can open this panel.
3. Enter the colleague's exact corporate Google Workspace email and click **Add colleague**. No source change, deployment or restart is needed. Knowing the domain alone does not grant access.
4. Click **Copy Studio link** and send the link through your approved company channel. Studio does not send invitation emails.
5. The colleague opens the link and signs in with that exact Google account. All approved colleagues see the same projects, uploads, drafts, captions and completed visuals across devices.

Use **Revoke** to block a colleague's future requests, including requests from an existing signed-in session. Use **Restore access** to approve them again. The owner cannot remove or reassign their own account through this panel; ownership changes need an administrator-assisted migration. A colleague cannot manage the access list or view other colleagues' email addresses through the access API.

Revocation cannot erase copies someone has already downloaded or data already displayed in their browser. Approve only people who may view, edit, delete and export the shared library. The MVP has owner/member roles, without per-project permissions or read-only members.

## Create a content pack

1. Create a project, or choose **Use example brief**.
2. Upload your original logos and event photos (PNG/JPEG/WebP). Enter event details, dates, location, call to action, palette and visual direction.
3. Select the social formats, quantity, and **English, Ukrainian, or both**. Choosing a language is mandatory.
4. Select AI copy and generate. The company connection is already configured: colleagues do not enter or see the API key. Start with one format/language/variant to check copy quality and API billing.
5. Review the visuals and captions, then download the ZIP. History and original uploads are saved to the protected shared server library. Sign out when finished, especially on a shared computer.

Every uploaded logo appears on every visual. Photos are used at most once per social network/run across languages and variants; Instagram posts and stories share a pool. Extra visuals use information-only layouts. The same brand policy governs the renderer and AI instructions. ZIPs contain PNG/caption pairs, brief, manifest and `style-guide.json`.

Template mode uses no OpenAI request and does not translate your input. AI mode sends text and output requirements to OpenAI; uploaded logos/photos are not sent to the provider. Visuals are composed from your original assets, without generating synthetic photos. Keep the page open during generation; completed files survive interruption.

## Troubleshooting

| What you see                          | What to do                                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google access denied                  | Use the exact approved corporate account. Ask the owner to check Team access; the Workspace administrator may also need to allow the Google application.             |
| Corporate session unavailable/expired | Reload and sign in again. Idle sessions expire after 30 minutes; Google token expiry can require an earlier fresh login than the maximum 8-hour session.             |
| No Team access button                 | Only the configured owner manages colleagues.                                                                                                                        |
| A colleague updated this record       | Reload before editing; concurrent changes are rejected instead of overwriting another person's work.                                                                 |
| AI unavailable / provider error       | Ask the administrator to check the server key, model access and OpenAI API billing. Never send the key in chat. A ChatGPT subscription does not include API credits. |
| Daily AI limit reached                | Defaults are 20 attempts per person and 100 per team per Kyiv calendar day. Failed provider attempts count too. The administrator can adjust the limits.             |
| Private library is full               | Export/remove old projects or ask the administrator to increase disk capacity and the configured quota.                                                              |
| History shows an interrupted run      | After 15 minutes without saved progress, an abandoned run is marked interrupted. Completed files remain; reuse its brief to generate a new run.                      |
| Missing projects                      | Check you opened the private company Studio, rather than an older public prototype. Old browser-only projects are not automatically migrated.                        |

Important ZIPs are deliverables, not full workspace backups. Hosting administrators must back up the encrypted disk and the original storage key separately. See [Security boundaries](../SECURITY.md).
