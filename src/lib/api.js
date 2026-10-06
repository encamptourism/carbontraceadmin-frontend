import Router from "next/router";

// The backend authenticates with an httpOnly session cookie (set via the /auth proxy),
// so JS can't see it. This flag only decides whether to show the app or /login.
export const isAuthed = () => {
  try { return localStorage.getItem("authed") === "1"; } catch { return false; }
};
export const setAuthed = (on) => {
  try { on ? localStorage.setItem("authed", "1") : localStorage.removeItem("authed"); } catch {}
};

// Pages that work without signing in (client-facing payment and reward-claim links).
export const PUBLIC_ROUTES = ["/login", "/pay/[token]", "/claim"];

// `path` is relative to /api/v1, except /backend/* which is proxied as-is.
export async function api(path, params, init) {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`${path.startsWith("/backend/") ? "" : "/api/v1"}${path}${qs}`, init);
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && !PUBLIC_ROUTES.includes(Router.pathname)) {
    setAuthed(false);
    Router.replace("/login");
  }
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  // Unwrap { data: {...} }, but keep the envelope when data is a list so pagination stays visible.
  return json.data && !Array.isArray(json.data) ? json.data : json;
}

// Backend web login: 302 + session cookie on success, 400 with an HTML page on failure.
export const post = (path, body) =>
  api(path, null, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });

export async function login(username, password) {
  const res = await fetch("/auth/login", {
    method: "POST",
    body: new URLSearchParams({ username, password }),
    redirect: "manual",
  });
  if (res.type !== "opaqueredirect" && !res.ok) throw new Error("Invalid username or password");
  setAuthed(true);
}

export async function logout() {
  await fetch("/auth/logout", { method: "POST", redirect: "manual" }).catch(() => {});
  setAuthed(false);
}
