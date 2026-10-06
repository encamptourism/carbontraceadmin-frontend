import Head from "next/head";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, findArray, fmt, FormDialog, PageHead, rowId, useApi } from "@/lib/ui";

const TONES = [[/success|complete|done/i, "good"], [/warn/i, "warn"], [/error|fail|critical|danger/i, "bad"]];
const toneOf = (t = "") => TONES.find(([re]) => re.test(t))?.[1] || "info";
const ICONS = {
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  good: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  warn: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></>,
  bad: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
};
const Svg = ({ children, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);

const isRead = (n) => Boolean(n.read ?? n.isRead);
const when = (n) => new Date(n.createdAt || n.created_at || n.date || 0);
const dayKey = (d) => d.toDateString();

function dayLabel(d) {
  const diff = Math.round((new Date(new Date().toDateString()) - new Date(d.toDateString())) / 864e5);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
function ago(d) {
  const s = (d - Date.now()) / 1000;
  for (const [unit, size] of [["day", 86400], ["hour", 3600], ["minute", 60]]) if (Math.abs(s) >= size) return rtf.format(Math.round(s / size), unit);
  return "just now";
}

// Day -> identical (title + message) notifications collapsed into one entry.
function group(list) {
  const days = new Map();
  for (const n of [...list].sort((a, b) => when(b) - when(a))) {
    const k = dayKey(when(n));
    if (!days.has(k)) days.set(k, new Map());
    const items = days.get(k);
    const sig = `${n.title}|${n.message}|${n.type}`;
    if (!items.has(sig)) items.set(sig, []);
    items.get(sig).push(n);
  }
  return [...days].map(([k, items]) => [k, [...items.values()]]);
}

function Item({ items, onChange }) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const n = items[0];
  const unread = items.filter((x) => !isRead(x));
  const tone = toneOf(n.type);

  async function run(fn, question) {
    if (question && !window.confirm(question)) return;
    setBusy(true);
    try {
      await Promise.all(fn());
    } catch (e) {
      alert(e.message);
    }
    setBusy(false);
    onChange();
  }
  const markRead = () => run(() => unread.map((x) => api(`/notifications/${encodeURIComponent(rowId(x))}/read`, null, { method: "PATCH" })));
  const remove = () =>
    run(() => items.map((x) => api(`/notifications/${encodeURIComponent(rowId(x))}`, null, { method: "DELETE" })), items.length > 1 ? `Delete these ${items.length} notifications?` : "Delete this notification?");

  return (
    <li className={`notif${unread.length ? " unread" : ""}${busy ? " busy" : ""}`}>
      <span className={`notif-icon ${tone}`}><Svg>{ICONS[tone]}</Svg></span>
      <div className="notif-body">
        <div className="notif-title">
          <strong>{n.title || "Notification"}</strong>
          {items.length > 1 && (
            <button className="count" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} title={`${items.length} identical notifications — show times`}>
              ×{items.length}
            </button>
          )}
        </div>
        {n.message && <p>{n.message}</p>}
        {expanded && (
          <ul className="occurrences">
            {items.map((x) => (
              <li key={rowId(x)} className={isRead(x) ? "" : "unread"}>
                {when(x).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="notif-side">
        <time dateTime={when(n).toISOString()} title={when(n).toLocaleString("en-IN")}>{ago(when(n))}</time>
        {unread.length > 0 && <span className="unread-dot" aria-label="Unread" />}
      </div>
      <div className="notif-actions">
        {unread.length > 0 && <button className="icon-btn" onClick={markRead} disabled={busy} aria-label="Mark as read" title="Mark as read"><Svg size={16}><path d="m5 12 5 5L20 7" /></Svg></button>}
        <button className="icon-btn danger" onClick={remove} disabled={busy} aria-label="Delete" title="Delete"><Svg size={16}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg></button>
      </div>
    </li>
  );
}

const TONE_LABEL = { info: "Info", good: "Success", warn: "Warning", bad: "Error" };

export default function Notifications() {
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [tone, setTone] = useState(null);
  const list = useApi("/notifications");
  const all = findArray(list.data);
  const unreadCount = all.filter((n) => !isRead(n)).length;
  const shown = all.filter((n) => (!onlyUnread || !isRead(n)) && (!tone || toneOf(n.type) === tone));
  const byTone = Object.keys(TONE_LABEL)
    .map((t) => [t, all.filter((n) => toneOf(n.type) === t)])
    .filter(([, l]) => l.length);

  async function markAll() {
    try {
      await api("/notifications/read-all", null, { method: "PATCH" });
    } catch (e) {
      alert(e.message);
    }
    list.reload();
  }

  const feed = !shown.length ? (
    <section className="card notif-empty">
      <span className="notif-icon good"><Svg size={22}>{ICONS.good}</Svg></span>
      <strong>{onlyUnread || tone ? "Nothing matches this filter" : "No notifications yet"}</strong>
      <p className="muted">New activity from projects, orders and billing shows up here.</p>
    </section>
  ) : (
    group(shown).map(([day, items]) => (
      <section key={day} className="notif-day">
        <h2>{dayLabel(new Date(day))}</h2>
        <ul className="card notif-list">
          {items.map((g) => <Item key={rowId(g[0])} items={g} onChange={list.reload} />)}
        </ul>
      </section>
    ))
  );

  return (
    <>
      <Head><title>Notifications · CarbonTrace</title></Head>
      <PageHead title="Notifications" sub="System activity across projects, orders, billing and wallets" icon="bell">
        <FormDialog
          label="+ New notification"
          title="Send a notification"
          path="/notifications"
          submitLabel="Send"
          onDone={list.reload}
          fields={[
            ["title", "Title", { required: true, placeholder: "Scheduled maintenance" }],
            ["userId", "Recipient user ID", { placeholder: "Optional", hint: "Leave blank to send it to yourself / the system feed" }],
            ["message", "Message", { type: "textarea", required: true }],
          ]}
        />
      </PageHead>

      {list.loading || list.error ? <Card title="Notifications" state={list} /> : (
        <div className="notif-layout">
          <div className="notif-feed">
            <div className="feed-bar">
              <div className="segmented" role="group" aria-label="Filter">
                <button aria-pressed={!onlyUnread} onClick={() => setOnlyUnread(false)}>All</button>
                <button aria-pressed={onlyUnread} onClick={() => setOnlyUnread(true)}>Unread</button>
              </div>
              {tone && <button className="filter-chip" onClick={() => setTone(null)}>{TONE_LABEL[tone]} ✕</button>}
            </div>
            {feed}
          </div>

          <aside className="card notif-aside">
            <div className="aside-stats">
              <div><strong>{fmt(unreadCount)}</strong><span>Unread</span></div>
              <div><strong>{fmt(all.length)}</strong><span>Total</span></div>
            </div>
            {all.length > 0 && (
              <div className="unread-bar" role="img" aria-label={`${unreadCount} of ${all.length} unread`}>
                <i style={{ width: `${(unreadCount / all.length) * 100}%` }} />
              </div>
            )}
            {byTone.length > 0 && (
              <div className="aside-types">
                <h3>By type</h3>
                {byTone.map(([t, l]) => (
                  <button key={t} className={`type-row${tone === t ? " active" : ""}`} onClick={() => setTone(tone === t ? null : t)} aria-pressed={tone === t}>
                    <span className={`notif-icon sm ${t}`}><Svg size={14}>{ICONS[t]}</Svg></span>
                    <span>{TONE_LABEL[t]}</span>
                    <span className="type-count">{l.length}</span>
                  </button>
                ))}
              </div>
            )}
            <button className="btn aside-btn" onClick={markAll} disabled={!unreadCount}>
              {unreadCount ? "Mark all as read" : "All caught up ✓"}
            </button>
          </aside>
        </div>
      )}
    </>
  );
}
