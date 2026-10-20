# Private corporate deployment

The default Docker image serves frontend and Java API at one HTTPS origin, with Google Workspace OIDC sign-in, an owner-managed exact-email access list, a company server-side OpenAI key and one encrypted shared library. Ordinary users install nothing. Google/GitHub/GitLab repositories alone do not run this server.

For the browser-only Render path, start with [First launch on Render](studio/RENDER_SETUP.md). It needs four private inputs; the detailed settings below are for administrators and other hosting platforms.

No production service, OAuth application or secret has been provisioned by this PR. An authorized company administrator completes the following setup in company-controlled accounts. Never send credentials in chat, commit them, put them in a PR, or expose them through a frontend `VITE_*` variable.

## 1. Configure corporate Google sign-in

1. In a company Google Cloud project belonging to the Workspace organization, configure Google Auth Platform with **Internal** audience. Follow the organization's application approval rules and enforce Google MFA through Workspace policy.
2. Create an OAuth client of type **Web application**. Choose the final Studio HTTPS origin before configuring the callback. Add exactly `https://YOUR-STUDIO-HOST/login/oauth2/code/corporate` as its authorized redirect URI. Replace the host; no trailing slash or additional path. The application requests only `openid` and `email`, with no Gmail or Drive permissions.
3. Store the client ID and secret privately in the hosting settings as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Render automatically supplies its HTTPS origin through `RENDER_EXTERNAL_URL`; leave `STUDIO_PUBLIC_URL` unset for the default Render host. On other hosts or for a custom domain, set `STUDIO_PUBLIC_URL` to that HTTPS origin, without a path or trailing slash. Explicit URL settings take precedence; invalid settings fail closed.
4. Set `STUDIO_OWNER_EMAIL` to the initial owner's exact primary Workspace address. Studio derives its corporate domain from that email. `STUDIO_EMAIL_DOMAIN` is an optional compatibility override and must match the owner's domain. These are private deployment values, not repository configuration. Initially only this account is approved. The owner adds others through **Team access** after signing in.

The server validates Google's signed ID token, issuer, audience, expiry, nonce, verified email and hosted-domain claim. A matching domain is necessary but not sufficient: the exact address must be active in the encrypted access directory. First successful login binds the entry to Google's stable account subject, preventing a recycled address from silently inheriting an existing grant. The server rechecks grants on authenticated requests; revocation applies to existing sessions. Use primary account addresses, not mailing lists or aliases.

The owner may revoke and deliberately restore access to re-enroll an account. An environment-variable edit cannot silently transfer ownership of an existing library: a mismatch fails startup. Plan owner migration with IT and a verified backup.

## 2. Run the container on company-controlled hosting

Use the repository's Dockerfile. Configure one replica with a persistent POSIX filesystem at `/var/lib/creative-studio`, writable by UID/GID `10001:10001`. The service sets directories to `0700`. No public object bucket or download directory is used. Multi-replica use, network filesystems lacking atomic moves, and distributed session storage are outside this MVP.

Expose one stable HTTPS origin; proxy **all** paths to port `8080` (or `PORT`). Restrict direct access to the container port and trust forwarded headers only from the controlled ingress. Set request and response timeouts to at least 150 seconds. Enforce upload limits at the ingress; the server streams ZIP uploads with 160 MiB aggregate, 25 MiB/image and 512 KiB metadata limits. Health checks use `/healthz`, returning only `{"status":"UP"}`. Do not publish Spring Actuator, debug endpoints or request/body/header logs.

Set these in the hosting secret manager/environment:

| Variable                       | Value / purpose                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SPRING_PROFILES_ACTIVE`       | `corporate` (image default). Do not enable `hosted` for company use.                                                                              |
| `STUDIO_REQUIRE_PRIVATE`       | `true` (image default). Refuses startup if the corporate profile is removed.                                                                      |
| `STUDIO_EMAIL_DOMAIN`          | Optional: defaults to the domain of `STUDIO_OWNER_EMAIL`; an override must match it.                                                              |
| `STUDIO_OWNER_EMAIL`           | Initial owner's exact primary address, private.                                                                                                   |
| `STUDIO_PUBLIC_URL`            | Optional on Render: defaults to `RENDER_EXTERNAL_URL`; required on other hosts/custom domains. HTTPS origin, no path.                             |
| `GOOGLE_CLIENT_ID`             | Google web client ID.                                                                                                                             |
| `GOOGLE_CLIENT_SECRET`         | Google web client secret.                                                                                                                         |
| `CREATIVE_OPENAI_API_KEY`      | Company OpenAI project key; server only.                                                                                                          |
| `STUDIO_STORAGE_KEY`           | Cryptographically random secret of at least 32 characters, generated using the hosting secret generator. Keep its original value with the backup. |
| `STUDIO_DATA_DIR`              | `/var/lib/creative-studio`; persistent mounted directory.                                                                                         |
| `STUDIO_STORAGE_QUOTA_BYTES`   | `5368709120` (5 GiB application quota). Provision extra disk headroom for uploads/staging/backups.                                                |
| `STUDIO_DAILY_USER_ATTEMPTS`   | `20`, persistent AI attempts per account per Kyiv day.                                                                                            |
| `STUDIO_DAILY_TEAM_ATTEMPTS`   | `100`, persistent team attempts per Kyiv day.                                                                                                     |
| `CREATIVE_OPENAI_MODEL`        | `gpt-4.1-mini`; must support Chat Completions structured JSON.                                                                                    |
| `PORT` / `STUDIO_BIND_ADDRESS` | `8080` / `0.0.0.0`, adjust target port to host.                                                                                                   |
| `JAVA_TOOL_OPTIONS`            | Preserve `-XX:MaxRAMPercentage=75.0`; add approved truststore options if required.                                                                |
| `HTTPS_PROXY`                  | Optional approved outbound HTTP CONNECT proxy.                                                                                                    |

The library encrypts project metadata, images, outputs, access directory, audit and quotas using AES-256-GCM. The key is required on every restart. A wrong key fails startup without replacing existing data. Losing/changing it makes prior data unreadable; this MVP has no key-rotation UI. Keep encrypted disk backups and the original key separately in company-controlled backup/secret systems; test restoration on isolated hosting. Back up before upgrades and preserve the stable URL. Use platform disk encryption too.

Allow outbound HTTPS to `accounts.google.com`, `oauth2.googleapis.com`, `www.googleapis.com` and `api.openai.com`. For TLS-inspecting proxies mount an approved Java truststore read-only and configure it without disabling certificate validation. Google sign-in also requires the browser to reach Google. Set provider budget alerts/caps in the company OpenAI project; application attempt limits are not a financial spend cap.

### Render option

`render.yaml` defines a paid **Starter** Docker service with a 10 GiB persistent disk. Review current hosting/storage charges before provisioning. Use a company-controlled Render account; fill private values in its protected settings, not YAML. `STUDIO_STORAGE_KEY` is generated by Render: preserve it securely before relying on the library. The Blueprint asks for owner email, Google Client ID/Secret and the company OpenAI key. It derives the corporate domain and uses Render's automatic `RENDER_EXTERNAL_URL`. Create the Google web client first, then deploy and add the actual Render callback to Google. For a custom domain, explicitly set `STUDIO_PUBLIC_URL` and update Google's callback to match it. A first deployment with missing values should fail closed until configuration is complete. Merges to `main` trigger rebuilds. Persistent disks require a single service instance and may cause downtime during deployments; plan company backups.

The HTTPS sign-in page is reachable publicly, but Studio pages, APIs and materials require an approved account. If company policy also requires the whole site to be inaccessible from the Internet, use company private hosting/VPN or an approved access gateway in addition to application authentication.

### Internal GitLab option

1. Import the repository with `Dockerfile` and `.gitlab-ci.yml`; restrict repository/registry access as required by the company.
2. Provide a runner supporting TLS-enabled Docker-in-Docker, including the shared `/certs/client` volume, or adapt to the company's approved builder. Do not disable TLS.
3. Merge-request pipelines build/test without publishing. Successful default-branch pipelines publish commit and `latest` images to the project registry using GitLab's built-in credentials. They run a private-mode smoke test with deliberately fake settings and no AI spend.
4. Company Kubernetes/OpenShift/container hosting pulls the commit image with approved registry credentials. Configure one replica, persistent storage, HTTPS, the secret settings above and a health-checked rollout trigger. CI cannot infer the company's cluster credentials or hosting target.
5. Share only the private Studio URL. Colleagues sign in with Google; no local setup or API key entry is involved.

GitHub builds the same image and publishes it on default-branch pushes. GitHub Pages serves documentation and a static landing page, not a working team Studio. No real colleague addresses or private configuration belong in CI variables used for builds/artifacts.

## 3. Verify before inviting the team

- Signed out: the root redirects to sign-in; API/session/library/file requests are denied. An unapproved corporate account, personal Gmail account and wrong-domain account cannot enter.
- Sign in as owner: open Team access, add one exact test colleague and copy the link. Sign in as that colleague in a separate browser profile; they see the shared project but cannot list or manage colleagues.
- Generate one small AI pack to verify the privately configured key, model and billing. CI tests use stubs and cannot prove production provider access.
- Revoke the test colleague and verify their next API/file request fails. Already downloaded copies remain with the colleague.
- Restart/redeploy and confirm the owner's access list and project/images/history survive. Test the isolated backup restore procedure before treating the library as durable storage.

If replacing an older public deployment, suspend it before private cutover. Old browser-only data is not automatically imported into the shared library; export important ZIPs first. Roll back only to a compatible **private** image. Never roll back to an unauthenticated public prototype with company data or a company key configured.

## Operator build checks

CI builds/tests the image, then starts it with fake private settings and runs `scripts/check_private.py`. Local operator equivalents (not user installation steps):

```sh
docker build -t creative-studio .
sh scripts/run_private_smoke.sh creative-studio studio-private-smoke
python3 scripts/check_private.py http://127.0.0.1:18080
docker rm -f studio-private-smoke
```

In the Codex managed environment only, builds may mount optional `proxy_ca`, `maven_settings` and `maven_truststore` BuildKit secrets. These preserve its proxy/CA configuration and are never copied into the runtime image. Production private credentials are runtime values, never Docker build arguments.
