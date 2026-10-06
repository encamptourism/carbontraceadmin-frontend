import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { login } from "@/lib/api";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const { username, password } = Object.fromEntries(new FormData(e.target));
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <Head><title>Sign in · CarbonTrace</title></Head>

      <aside className="login-hero">
        <div className="brand"><span className="logo" aria-hidden>●</span>CarbonTrace</div>
        <div>
          <h2>Track every tonne, from project to payout.</h2>
          <ul>
            <li>Sales, billing and accounts in one place</li>
            <li>Wallet balances and credit retirements</li>
            <li>Rewards, inquiries and audit logs</li>
          </ul>
        </div>
        <small>© {new Date().getFullYear()} CarbonTrace</small>
      </aside>

      <main className="login-main">
        <form onSubmit={onSubmit} onChange={() => error && setError("")} aria-busy={busy}>
          <div className="brand login-mobile-brand"><span className="logo" aria-hidden>●</span>CarbonTrace</div>
          <header>
            <h1>Welcome back</h1>
            <p className="muted">Sign in to the admin console.</p>
          </header>

          <label>
            <span>Email or username</span>
            <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus placeholder="you@company.com" />
          </label>

          <label>
            <span>Password</span>
            <div className="pw">
              <input
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
                aria-describedby={caps ? "caps-hint" : undefined}
              />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
                {show ? "Hide" : "Show"}
              </button>
            </div>
            {caps && <small id="caps-hint" className="warn">Caps Lock is on</small>}
          </label>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="submit" disabled={busy}>
            {busy && <span className="spinner" aria-hidden />}
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </main>
    </div>
  );
}
