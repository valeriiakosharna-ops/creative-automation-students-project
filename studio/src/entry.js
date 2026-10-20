import "./style.css";
import { initializeInterface } from "./i18n.js";
initializeInterface();
const runtime = window.STUDIO_RUNTIME || {};
const app = document.querySelector("#studio-app"),
  gate = document.querySelector("#pages-signin");
if (
  document.querySelector('meta[name="studio-build"]')?.content === "pages" &&
  runtime.pages !== true
) {
  gate.hidden = false;
  document.querySelector("#google-signin").disabled = true;
  document.querySelector("#signin-status").textContent =
    "Pages configuration could not be loaded. Reload or contact the owner.";
} else if (!runtime.pages) {
  app.hidden = false;
  await import("./main.js");
} else {
  gate.hidden = false;
  const status = document.querySelector("#signin-status");
  const login = document.querySelector("#google-signin"),
    logout = document.querySelector("#google-signout");
  if (!runtime.firebase?.apiKey || !runtime.firebase?.projectId) {
    status.textContent =
      "The owner must finish Firebase setup before sign-in is available. Follow the free Pages setup guide.";
    login.disabled = true;
  } else {
    try {
      const service = await import("./pages-auth.js");
      let opened = false;
      await service.initializePagesAuth(
        runtime.firebase,
        async (account, signedIn) => {
          logout.hidden = !signedIn;
          if (account) {
            if (opened) return;
            opened = true;
            runtime.accountId = account.uid;
            gate.hidden = true;
            app.hidden = false;
            try {
              await import("./main.js");
            } catch {
              app.hidden = true;
              gate.hidden = false;
              status.textContent =
                "Studio could not start. Reload and try again.";
            }
          } else if (opened) {
            window.dispatchEvent(new Event("studio:access-lost"));
            window.location.reload();
          } else
            status.textContent = signedIn
              ? "Checking access…"
              : "Sign in with a Google account approved by the owner.";
        },
        (message) => {
          status.textContent = message;
        },
      );
      login.addEventListener("click", async () => {
        login.disabled = true;
        try {
          await service.signInPages();
        } catch {
          status.textContent =
            "Google sign-in did not finish. Allow the popup and try again, or ask the owner to check Firebase setup.";
        } finally {
          login.disabled = false;
        }
      });
      login.disabled = false;
      logout.addEventListener("click", () =>
        service.signOutPages().then(() => window.location.reload()),
      );
    } catch {
      status.textContent =
        "Google sign-in is unavailable. Ask the owner to check the Firebase configuration.";
      login.disabled = true;
    }
  }
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });
}
