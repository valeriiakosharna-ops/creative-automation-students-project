# Optional local contributor setup

For normal use, follow [Quickstart](QUICKSTART.md) and open the hosted site. The following workstation setup is only for contributors. Run without the `hosted` profile when using a server-side developer key.

A complete local development setup is **one Java server serving the built app**. It keeps the key on your computer/server and needs no frontend backend-address configuration. These instructions assume the feature changes have been merged into `main`, or that you have checked out the corresponding PR branch.

## 1. Install the prerequisites

- Node.js **24 LTS** (or 22.12+), including npm: <https://nodejs.org/en/download>.
- A full **JDK 21**, including `javac`, not only a Java runtime: <https://adoptium.net/temurin/releases/?version=21>.
- Git. Maven is supplied by the repository's wrapper; no separate Maven install is required.
- An OpenAI API project with model access and active API billing. A ChatGPT subscription does not supply API credits.

Verify in a terminal:

```sh
node --version
npm --version
java --version
javac --version
```

`java` and `javac` should both report version 21. If several JDKs are installed, point `JAVA_HOME` to JDK 21 and put its `bin` directory first in `PATH`.

## 2. Get the repository and build the app

```sh
git clone https://github.com/valeriiakosharna-ops/creative-automation-students-project.git
cd creative-automation-students-project
cd studio
npm ci
npm run build
cd server
```

If you already have the repository, use that checkout and update it after saving your own changes. Do not clone over existing work. From this point, run server commands in **`studio/server/`**. The Java application reads local configuration relative to this working directory.

## 3. Create your private local configuration

**macOS / Linux / Git Bash**, from `studio/server/`:

```sh
test -f application-local.properties || cp application-local.properties.example application-local.properties
```

**Windows PowerShell**, from `studio/server/`:

```powershell
if (-not (Test-Path application-local.properties)) {
    Copy-Item application-local.properties.example application-local.properties
}
```

These commands preserve a configuration file that already exists. Open **`studio/server/application-local.properties`** in your editor, then replace the blank key value:

```properties
creative.openai.api-key=YOUR_API_KEY_HERE
creative.openai.model=gpt-4.1-mini
```

Replace `YOUR_API_KEY_HERE` with your actual key on your machine. Do not add quotes. Leave no spaces before/after the key. Do not send it in chat, take a screenshot of it, or paste it into the Studio browser settings.

The real local file is gitignored; the committed `.example` stays empty. Before any commit, `git status --short` should not list the real `application-local.properties`. You can check the ignore rule without printing its contents:

```sh
git check-ignore application-local.properties
```

An alternative is setting `CREATIVE_OPENAI_API_KEY` securely in the **Java server process environment**. A value in the local properties file overrides the default environment-variable binding. Use one method consistently; remove a local key override if you want to use only the environment variable. Do not use a `VITE_` variable for a secret.

## 4. Build and start the Java server

**macOS / Linux / Git Bash**, still in `studio/server/`:

```sh
./mvnw --batch-mode verify
java -jar target/studio-server-0.1.0.jar
```

**Windows PowerShell**, still in `studio/server/`:

```powershell
.\mvnw.cmd --batch-mode verify
java -jar target/studio-server-0.1.0.jar
```

The first build downloads dependencies and verifies the Maven distribution checksum. Leave the terminal running. Open `http://127.0.0.1:8080` on the same computer. Stop the app with Ctrl+C. Restart after changing the key, model, or server configuration.

The full JAR includes the app, the student brief, the social style guide, and the versioned generation policy. When changing the shared style guide, rebuild the frontend and JAR together so their versions agree.

## 5. Verify the connection and make a small first run

Open `http://127.0.0.1:8080/api/health`. You should see:

```json
{
  "service": "creative-automation-studio",
  "aiConfigured": true,
  "styleGuideVersion": "1.0.0"
}
```

JSON field order may differ. `aiConfigured: true` means a nonempty key was loaded; it does not prove billing or model access. Confirm those with the following small generation:

1. Open the app and create a project, or use the example brief.
2. Upload your original logos and a few event photos. Supported uploads are PNG/JPG/WebP, not SVG; export the logo as a transparent PNG first.
3. Enter the event details and choose **one format, one language, one variant** for the first test.
4. Select **AI · connected Java server** in Copy generation.
5. Create the content pack. Inspect the visual, matching caption and applied style-guide version.
6. Download the ZIP and check the PNG, text, `manifest.json` and `style-guide.json`.

All logos appear on every visual. Photo reuse is limited to once per social network/language/run. English and Ukrainian versions may each use the same original photo once. Extra outputs are information-only. Text-only event data is sent to the AI provider; original logos/photos stay in your browser.

AI drafts and translations use the shared style policy. Visuals are composed locally from your original assets; the MVP does not synthesize new photos. Keep the final human review before publication.

## 6. If you want frontend hot reload

Keep Java running in one terminal. In a second terminal, from the repository root:

```sh
cd studio
npm run dev
```

Use Vite's printed address, normally `http://127.0.0.1:5173`. Requests to `/api` are proxied to the Java server on port 8080. Leave the Studio backend address empty in this setup. The UI served at port 5173 and the UI served at port 8080 have different browser storage: projects do not automatically appear across those origins. Use one address consistently for real work.

## 7. Private production is separate

The preceding instructions intentionally use an unauthenticated contributor profile and browser-local storage. Never expose that setup to colleagues or use it for confidential company material. The default Docker image instead requires corporate mode; follow [Deployment](../DEPLOYMENT.md) for Google login, the owner access panel, a shared encrypted disk and private server key configuration.

GitHub Pages now runs the separate browser-only Studio described in [Free Pages setup](PAGES_SETUP.md), with per-account local projects and visit-only keys sent directly to OpenAI. It cannot run the private Java API or provide its encrypted shared library. Real Google/OpenAI integration needs approved outbound access and trusted CA configuration; never disable TLS verification.

## Troubleshooting

| What you see                                   | What to check                                                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `aiConfigured: false` / 503                    | Key is in the real local file, not only `.example`; server started from `studio/server/`; no blank local override; restart Java. |
| Provider HTTP 401                              | Actual API key is valid, unrevoked and loaded by the server. Never paste it into logs or chat.                                   |
| Provider HTTP 403 / 404                        | Project/model access and model name. Keep a model that supports Chat Completions structured JSON output.                         |
| Provider HTTP 429                              | API billing/credits or provider rate limit. Check the API account; a ChatGPT subscription is separate.                           |
| Provider timeout / network error               | Outbound access to `api.openai.com`, proxy/CA configuration, and provider status. No automatic retry is made.                    |
| 409 / style-guide mismatch                     | Rebuild both frontend and Java JAR from the same checkout and reload the browser.                                                |
| Style text cannot fit                          | Shorten the visual headline, summary, location or link; the renderer preserves minimum font sizes instead of clipping.           |
| Browser CORS / connection error                | Exact frontend origin allowed on the Java server, HTTPS URL, and no `/api` suffix in the saved backend address.                  |
| Java release 21 unsupported / missing compiler | Install the full JDK 21 and check `JAVA_HOME`, `PATH`, `java` and `javac`.                                                       |
| Port 8080 already in use                       | Stop the other local server or set `PORT`. Update the Vite proxy or backend address if changing the port.                        |
| Projects seem missing                          | Use the same browser/profile/origin/port. Data is in IndexedDB; clearing browser data removes it.                                |

No real key is needed for local tests. Live AI generation remains a separate check after you configure your own key and billing.

The Pages deployment uses a separate three-stage planner/image-generation/copywriter pipeline with uploaded references and per-item approval. The text-only/local-asset statement above describes this optional Java development mode. See [Pages setup](PAGES_SETUP.md) for the deployed browser workflow.
