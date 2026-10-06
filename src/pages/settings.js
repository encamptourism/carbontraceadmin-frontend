import Head from "next/head";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, Empty, ErrorNote, Icon, KeyValues, PageHead, Skeleton, fmt, humanize, useApi } from "@/lib/ui";

// Health values -> light colour. Booleans and up/ok/connected words are green, their opposites red.
const light = (v) =>
  v === true || /^(ok|up|healthy|connected|ready|running|online|true|success|active)$/i.test(String(v)) ? "good"
  : v === false || /down|error|fail|disconnected|offline|false|unhealthy/i.test(String(v)) ? "bad"
  : "";

// 482211 (seconds) -> "5d 13h 56m"
const duration = (sec) => [[86400, "d"], [3600, "h"], [60, "m"]].reduce((out, [n, u]) => { const q = Math.floor(sec / n); sec %= n; return q || out.length ? [...out, `${q}${u}`] : out; }, []).join(" ") || `${sec}s`;
const show = (k, v) => typeof v === "boolean" ? (v ? "Yes" : "No") : /uptime/i.test(k) && typeof v === "number" ? duration(/ms|milli/i.test(k) ? v / 1000 : v) : fmt(v);

function Health({ data }) {
  const scalars = Object.entries(data || {}).filter(([k, v]) => typeof v !== "object" && k !== "success");
  const groups = Object.entries(data || {}).filter(([, v]) => v && typeof v === "object" && !Array.isArray(v));
  const items = [...scalars, ...groups.flatMap(([g, o]) => Object.entries(o).filter(([, v]) => typeof v !== "object").map(([k, v]) => [`${humanize(g)} · ${humanize(k)}`, v]))];
  if (!items.length) return <Empty icon="server" title="No health data returned" />;
  const bad = items.some(([, v]) => light(v) === "bad");
  return (
    <>
      <div className={`health-banner ${bad ? "bad" : "good"}`}>
        <span className="pulse-dot" aria-hidden />
        <strong>{bad ? "Some services need attention" : "All systems operational"}</strong>
      </div>
      <div className="health-grid">
        {items.map(([k, v]) => (
          <div key={k} className={`health ${light(v)}`}>
            <span className="health-light" aria-hidden />
            <div><span>{humanize(k).replace(/ seconds?$/i, "")}</span><strong>{show(k, v)}</strong></div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Settings() {
  const settings = useApi("/settings");
  const health = useApi("/health");
  const [msg, setMsg] = useState({});

  async function testEmail(e) {
    e.preventDefault();
    setMsg({ text: "Sending…" });
    try {
      const res = await api("/settings/test-email", null, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_to: new FormData(e.target).get("email_to") }),
      });
      setMsg({ text: res.message || "Test email sent.", ok: true });
    } catch (err) {
      setMsg({ text: `Failed: ${err.message}`, bad: true });
    }
  }

  return (
    <>
      <Head><title>Settings · CarbonTrace</title></Head>
      <PageHead title="Settings" sub="Backend status, email delivery and platform configuration" icon="settings">
        <button className="btn" onClick={health.reload}><Icon name="refresh" size={14} /> Re-check</button>
      </PageHead>

      <section className="card">
        <div className="card-head"><h2><Icon name="pulse" size={16} />System health</h2></div>
        {health.loading ? <Skeleton lines={3} /> : health.error ? <ErrorNote>{health.error}</ErrorNote> : <Health data={health.data} />}
      </section>

      <div className="settings-grid">
        <section className="card mail-card">
          <div className="card-head"><h2><Icon name="mail" size={16} />Email delivery (SMTP)</h2></div>
          <p className="muted">Send a test message to confirm invoices, reminders and reward emails can go out.</p>
          <form className="send-row" onSubmit={testEmail}>
            <span className="input-icon"><Icon name="mail" size={15} /><input name="email_to" type="email" placeholder="you@company.com" required aria-label="Recipient" /></span>
            <button className="btn primary"><Icon name="send" size={14} /> Send test</button>
          </form>
          {msg.text && <p className={`save-msg${msg.ok ? " ok" : msg.bad ? " bad" : ""}`} role="status">{msg.ok && <Icon name="check" size={14} />} {msg.text}</p>}
        </section>

        <Card title="Configuration" icon="settings" state={settings}><KeyValues data={settings.data} empty="No settings returned." /></Card>
      </div>
    </>
  );
}
