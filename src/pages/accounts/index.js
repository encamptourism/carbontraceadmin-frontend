import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { Avatar, Card, DataTable, Empty, Icon, PageHead, Pager, Skeleton, Tabs, Tiles, ago, findArray, pick, rowId, toneOf, useApi } from "@/lib/ui";

const LIMIT = 20;
const PERSONAL = /^(gmail|yahoo|outlook|hotmail|icloud|proton(mail)?|carbontrace)\./i;

// Logo: the API's own field if it sends one, else public/clients/<email domain>.png (drop files there).
const logoOf = (c, email) => {
  const url = pick(c, /logo|avatar|image/i);
  if (url) return url;
  const domain = String(email || "").split("@")[1]?.toLowerCase();
  return domain && !PERSONAL.test(domain) ? `/clients/${domain}.png` : undefined;
};

function ClientCard({ c }) {
  const name = pick(c, /^(name|companyName|company|clientName)$/i) || "Unnamed client";
  const email = pick(c, /email/i);
  const phone = pick(c, /contact|phone|mobile/i);
  const place = pick(c, /location|city|address/i);
  const status = pick(c, /status/i);
  const since = pick(c, /^created_?at$/i);
  return (
    <Link href={`/accounts/${rowId(c)}`} className="client-card">
      <div className="client-top">
        <Avatar name={name} size={44} src={logoOf(c, email)} />
        <div className="client-name">
          <strong>{name}</strong>
          {since && <small>Client {ago(since)}</small>}
        </div>
        {status != null && <span className={`pill ${toneOf(status)}`}>{String(status)}</span>}
      </div>
      <ul className="client-meta">
        {email && <li><Icon name="mail" size={14} /><span>{email}</span></li>}
        {phone && <li><Icon name="phone" size={14} /><span>{phone}</span></li>}
        {place && <li><Icon name="pin" size={14} /><span>{place}</span></li>}
      </ul>
      <span className="client-go">Open account <Icon name="arrow" size={14} /></span>
    </Link>
  );
}

export default function Accounts() {
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [view, setView] = useState("grid");
  const overview = useApi("/accounts/overview");
  const clients = useApi(tab ? null : "/accounts/clients", { page, limit: LIMIT, ...(q && { q }) });
  const audit = useApi(tab ? "/accounts/audit/confirmed-transactions" : null);
  const rows = findArray(clients.data);

  return (
    <>
      <Head><title>Accounts · CarbonTrace</title></Head>
      <PageHead title="Accounts" sub="Client organisations, their ledgers and confirmed on-chain transactions" icon="accounts" />
      <Card title="Overview" icon="pulse" state={overview}><Tiles data={overview.data} /></Card>
      <Tabs tabs={["Clients", "Confirmed transactions audit"]} value={tab} onChange={setTab} />

      {tab ? (
        <Card title="Confirmed transactions" icon="check" state={audit}>
          <DataTable rows={findArray(audit.data)} name="Confirmed-transactions" empty="No confirmed transactions." />
        </Card>
      ) : (
        <>
          <div className="toolbar">
            <form className="search-box" onSubmit={(e) => { e.preventDefault(); setQ(new FormData(e.target).get("q")); setPage(1); }}>
              <Icon name="search" size={16} />
              <input name="q" type="search" placeholder="Search clients by name or email" defaultValue={q} aria-label="Search clients" />
            </form>
            <div className="segmented" role="group" aria-label="View">
              <button aria-pressed={view === "grid"} onClick={() => setView("grid")} aria-label="Card view"><Icon name="grid" size={15} /></button>
              <button aria-pressed={view === "table"} onClick={() => setView("table")} aria-label="Table view"><Icon name="list" size={15} /></button>
            </div>
          </div>

          {clients.loading ? <section className="card"><Skeleton lines={4} /></section>
            : clients.error ? <Card title="Clients" state={clients} />
            : !rows.length ? <section className="card"><Empty icon="accounts" title={q ? `No clients match “${q}”` : "No clients yet"}>Clients appear here once they’re created or an inquiry is converted.</Empty></section>
            : view === "grid" ? <div className="client-grid">{rows.map((c) => <ClientCard key={rowId(c)} c={c} />)}</div>
            : (
              <Card title="Clients" state={clients}>
                <DataTable rows={rows} name="Clients" exportRows={async () => findArray(await api("/accounts/clients", { page: 1, limit: 1000, ...(q && { q }) }))} action={(r) => <Link className="btn" href={`/accounts/${rowId(r)}`}>View</Link>} />
              </Card>
            )}
          <Pager page={page} setPage={setPage} data={clients.data} rows={rows} limit={LIMIT} />
        </>
      )}
    </>
  );
}
