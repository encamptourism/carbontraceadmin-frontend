import Head from "next/head";
import { useState } from "react";
import { ActionButton, Empty, ErrorNote, Icon, KeyValues, PageHead, Skeleton, StatusChips, Tabs, ago, findArray, humanize, pick, rowId, toneOf, useApi } from "@/lib/ui";

const TABS = [["Email logs", "/email-logs", "mail"], ["System logs", "/system-logs", "server"]];
const STATUS = /^(status|level|severity|state|result)$/i;

function Entry({ r, email, onResent }) {
  const title = pick(r, /subject|title|message|event|action|type/i) || "Log entry";
  const who = pick(r, /^(to|recipient|email_?to|user|actor)$/i);
  const kind = pick(r, /^(type|category|template|source)$/i);
  const statusKey = Object.keys(r).find((k) => STATUS.test(k));
  const status = statusKey && r[statusKey];
  const when = pick(r, /created_?at|timestamp|time|date|sent_?at/i);
  const tone = toneOf(status) || "info";
  return (
    <li className={`log ${tone}`}>
      <span className="log-dot" aria-hidden />
      <details>
        <summary>
          <div className="log-main">
            <strong>{String(title)}</strong>
            <span className="log-meta">
              {status && <span className={`pill ${tone}`}>{String(status)}</span>}
              {kind && kind !== title && <span>{humanize(String(kind))}</span>}
              {who && <span><Icon name={email ? "mail" : "accounts"} size={12} /> {String(who)}</span>}
            </span>
          </div>
          {when && <time title={new Date(when).toLocaleString("en-IN")}>{ago(when)}</time>}
        </summary>
        <div className="log-detail">
          <KeyValues data={r} />
          {email && <ActionButton label="Resend email" path={`/email-logs/${encodeURIComponent(rowId(r))}/resend`} confirm="Resend this email?" onDone={onResent} />}
        </div>
      </details>
    </li>
  );
}

export default function Logs() {
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const list = useApi(TABS[tab][1]);
  const all = findArray(list.data);
  const statusKey = all[0] && Object.keys(all[0]).find((k) => STATUS.test(k));
  const rows = all
    .filter((r) => !status || String(r[statusKey]) === status)
    .filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <Head><title>Logs · CarbonTrace</title></Head>
      <PageHead title="Logs" sub="Outgoing email and backend activity, newest first" icon="logs">
        <button className="btn" onClick={list.reload}><Icon name="refresh" size={14} /> Refresh</button>
      </PageHead>
      <Tabs tabs={TABS.map(([l]) => l)} value={tab} onChange={(t) => { setTab(t); setStatus(""); setQ(""); }} />

      <div className="toolbar">
        <label className="search-box">
          <Icon name="search" size={16} />
          <input type="search" placeholder={`Search ${TABS[tab][0].toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search logs" />
        </label>
      </div>
      {statusKey && <StatusChips rows={all} field={statusKey} value={status} onChange={setStatus} />}

      <section className="card">
        {list.loading ? <Skeleton lines={6} />
          : list.error ? <ErrorNote>{list.error}</ErrorNote>
          : !rows.length ? <Empty icon={TABS[tab][2]} title={all.length ? "No entries match" : "No log entries yet"} />
          : <ol className="timeline">{rows.map((r, i) => <Entry key={rowId(r) || i} r={r} email={tab === 0} onResent={list.reload} />)}</ol>}
      </section>
    </>
  );
}
