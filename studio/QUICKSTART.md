# Use the free Pages Studio

First launch: follow [Free Pages setup](PAGES_SETUP.md). It uses Firebase Console and two public GitHub repository variables, without Render, a Java server or local tools. Google/Firebase free quotas apply; OpenAI API generation is billed separately.

1. Open the GitHub Pages **Studio** URL and click **Sign in with Google**. Use the exact account approved by the owner. Gmail and other Google account domains are supported.
2. Click **Connect OpenAI**, enter your API key and choose **Use key for this visit**. Never put it in GitHub configuration or chat. Refresh, sign-out, normal access loss and closing the page clear it; **Forget key** clears it immediately.
3. Create a project, upload original PNG/JPEG/WebP logos/photos, enter event details and choose formats, quantity and **English, Ukrainian or both**.
4. Generate a small pack first. Review visuals/captions and download the ZIP. Template mode needs no key and does not translate your text.
5. Projects and assets stay in this browser, separately for each Google account. They do not sync or form a shared team library. Export important ZIPs before clearing browser data; use a separate browser profile on shared computers.

The owner opens **Team access**, enters an exact Google email, clicks **Add colleague** and shares **Copy Studio link** manually. No email is sent automatically. **Revoke access** blocks the normal app when it receives the change; **Restore access** approves the account again. Only the owner can list/manage access. Revocation cannot recall local/downloaded files or prevent use of a copied public app.

Every uploaded logo appears on every visual. A photo appears at most once per social network/run across variants and languages; Instagram posts/stories share a photo pool. Extra outputs are information-only. The shared brand policy drives both visuals and AI copy. ZIPs contain PNG/caption pairs, brief, manifest and the effective style policy, without original uploads or credentials.

The browser sends text directly to OpenAI; photos/logos stay local. A key in use can be inspected by the browser user/extensions. Firebase sees Google sign-in identities and the private access roster, never event content or OpenAI keys. Pages HTML/code/assets are public; see [Security boundaries](../SECURITY.md).

For a private shared server library, use the separate [Corporate deployment](../DEPLOYMENT.md) instead. It requires hosting and different setup.
