let token;
export function isCorporate() {
  return (
    typeof window !== "undefined" && window.STUDIO_RUNTIME?.corporate === true
  );
}
export async function session() {
  const response = await fetch("/api/session", {
    credentials: "same-origin",
    mode: "same-origin",
    redirect: "error",
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.csrfToken || data.csrfHeader !== "X-CSRF-TOKEN")
    throw Error(
      "Your corporate session is unavailable. Reload Studio and sign in again.",
    );
  token = data.csrfToken;
  return data;
}
export async function csrfHeaders() {
  if (!isCorporate()) return {};
  if (!token) await session();
  return { "X-CSRF-TOKEN": token };
}
export async function privateFetch(path, options = {}) {
  if (!path.startsWith("/api/"))
    throw Error("Private requests must use this site's own API.");
  const write = options.method && !["GET", "HEAD"].includes(options.method);
  return fetch(path, {
    ...options,
    credentials: "same-origin",
    mode: "same-origin",
    redirect: "error",
    cache: "no-store",
    headers: { ...(write ? await csrfHeaders() : {}), ...options.headers },
  });
}
export async function jsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Error(
      data.message ||
        (response.status === 401
          ? "Your session expired. Reload Studio and sign in again."
          : "The protected library is unavailable. Contact the project owner."),
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
