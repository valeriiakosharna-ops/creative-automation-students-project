# Hosted deployment and internal GitLab handoff

## One portable application

The root `Dockerfile` builds the frontend with Node 24, verifies the Java 21 server and packages both in one non-root JRE container. It includes the student brief, social style guide, runtime configuration and ZIP workflow. No database, separate frontend origin, local machine, or OpenAI key is required to build it.

The default container runs the **hosted** Spring profile, binds `0.0.0.0`, and listens on `PORT` (8080 by default). The platform should terminate HTTPS and proxy the whole domain to that port. Serve the application at the **domain root**, including `/api` and `/runtime.js`; no repository subpath rewrite is needed. Do not route the frontend and API to different hosts. Health check: `GET /api/health`.

Visitors enter their own key through **Connect OpenAI**. It stays in page memory, travels only to this origin in `X-OpenAI-Key`, and is forwarded to OpenAI in its authorization header. Hosted generation rejects requests without that header and never uses a shared server key. Keys are not included in the JSON brief, provider prompt, logs or ZIP. The hosted profile disables cross-origin API access and constrains scripts/connections to the same site. Keep request-header/body tracing disabled/redacted at the reverse proxy and monitoring layer.

The service is an MVP with a shared one-request AI concurrency limit. There are no user accounts or cloud workspace storage. If access should be corporate-only, put it behind your company's VPN/SSO/access gateway. Browser IndexedDB stores each visitor's projects and output history.

## GitHub → Render: browser-only setup

Use the deploy button and steps in [Quickstart](studio/QUICKSTART.md). `render.yaml` creates a Docker web service with a health check and automatic deployment of `main`. The service needs **no OpenAI secret** in Render; visitors paste their own keys in Studio. `PORT=10000` is set for Render. HTTPS is supplied by the platform.

Hosting provision/account access and any provider billing confirmation belong to the owner. Committing this file does not create a live service by itself. Free-service availability and cold starts depend on Render. This workflow is suitable for GitHub or GitLab.com repositories the provider can access; a private internal GitLab needs the corporate route below or an approved reachable mirror.

## GitHub Container Registry

`.github/workflows/container.yml` builds and tests the image on pull requests. On `main`, after the container smoke test passes, it also publishes:

```text
ghcr.io/valeriiakosharna-ops/creative-automation-students-project:latest
ghcr.io/valeriiakosharna-ops/creative-automation-students-project:<full-commit-sha>
```

Publishing uses the built-in `GITHUB_TOKEN`; no manually configured registry secret is required. Enable Actions package publishing if organization policy blocks it. Package visibility/access controls are managed separately in GitHub; a private package needs pull access at the hosting platform. Point company hosting to the tested commit tag for a fixed release. Publishing a new image does not itself update an existing company deployment; configure that platform's rollout automation.

## Internal GitLab: one-time IT setup

1. Import/mirror this repository, including its root `Dockerfile`, `.dockerignore` and `.gitlab-ci.yml`.
2. Enable GitLab Container Registry and provide a runner that can use **TLS-enabled Docker-in-Docker**. The runner administrator enables privileged services and shares `/certs/client` between the job and Docker service. Do not disable TLS to fix runner setup. If company policy uses a different builder, adapt the build job; the application image contract stays the same.
3. Merge to the project's default branch. The pipeline builds the container (including Node/Java tests), starts it, and runs `scripts/check_hosted.py` without credentials or AI spend. Merge-request pipelines test without publishing. Successful default-branch pipelines publish `$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA` and `:latest` with GitLab's built-in registry credentials.
4. Configure the company's container platform (Kubernetes, OpenShift, Docker host, etc.) to pull the commit image using approved registry pull credentials. Run one replica for the MVP. Configure the platform's rollout trigger after a successful default-branch image push; this repository cannot infer a company's cluster credentials or deployment target.
5. Expose one stable HTTPS domain, proxy all paths, trust forwarded scheme/host headers only from the platform ingress, and allow a request/response timeout of at least 150 seconds. The hosted profile understands the proxy's forwarded HTTPS headers for same-origin checks. Health-check `/api/health`; it returns `clientKeysEnabled: true`, `aiConfigured: false`, and the style-guide version.
6. Allow outbound HTTPS to `api.openai.com`. Set the approved `HTTPS_PROXY` if required. For a corporate TLS-inspecting proxy, mount the approved Java truststore read-only and set `JAVA_TOOL_OPTIONS` with its path; preserve memory options and normal trusted roots. Never disable TLS verification. Configure access policy/VPN/SSO at the ingress if needed.
7. Share that one URL with users. They open Studio, paste their own key for the visit, and generate/download ZIPs. No workstation installation is involved.

Server variables (set in the hosting UI/secret manager, not committed with real values):

| Variable | Default / purpose |
| --- | --- |
| `SPRING_PROFILES_ACTIVE` | `hosted` in the image; keep this profile enabled. |
| `PORT` | `8080`; match the platform's target port. |
| `STUDIO_BIND_ADDRESS` | `0.0.0.0`; container interface, not loopback. |
| `CREATIVE_OPENAI_MODEL` | `gpt-4.1-mini`; model must support Chat Completions structured JSON. |
| `JAVA_TOOL_OPTIONS` | `-XX:MaxRAMPercentage=75.0`; preserve/add approved truststore options if needed. |
| `HTTPS_PROXY` | Optional approved outbound HTTP CONNECT proxy. |

Do **not** set `CREATIVE_OPENAI_API_KEY`, `VITE_*` secrets or an API key as a Docker build argument. Hosted mode requires the visitor's key even if an owner key was accidentally supplied. Original uploads stay in the browser; only text and output specifications go to OpenAI.

## Optional operator checks

These are commands for the hosting/CI team, not steps for ordinary users:

```sh
docker build -t creative-studio .
docker run --rm -p 8080:8080 creative-studio
# In another operator terminal:
python3 scripts/check_hosted.py http://127.0.0.1:8080
```

Use a health-checked rollout and keep the prior commit image for rollback. Browser data stays tied to the site's exact origin, so preserve its domain. Updating the server does not create cross-device project backups.

In the Codex managed environment only, Docker builds can mount optional `proxy_ca`, `maven_settings` and `maven_truststore` BuildKit secrets. These preserve the provided proxy/CA route and verification; they are not needed on standard hosting and are never copied into the runtime image.
