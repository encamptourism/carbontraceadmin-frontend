import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { WalletCard } from "./wallet";
import { CountUp, ErrorNote, Skeleton, Card, compact, DataTable, findArray, fmt, humanize, KeyValues, PageHead, useApi } from "@/lib/ui";

const RANGES = [[7, "7D"], [30, "30D"], [90, "90D"], [365, "12M"]];

// Clean axis step (1/2/2.5/5 × 10ⁿ) giving about 4 gridlines.
function niceStep(max) {
  const raw = (max || 1) / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
}

function ColumnChart({ labels, values }) {
  const [hover, setHover] = useState(null);
  const step = niceStep(Math.max(...values));
  const top = Math.ceil(Math.max(...values, step) / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step).reverse();
  const every = Math.ceil(values.length / 6); // at most ~6 x labels

  return (
    <div className="chart">
      <div className="chart-y" aria-hidden>{ticks.map((t) => <span key={t}>{compact(t)}</span>)}</div>
      <div className="chart-plot">
        <div className="chart-grid" aria-hidden>{ticks.map((t) => <i key={t} />)}</div>
        <div className="chart-cols" onMouseLeave={() => setHover(null)}>
          {values.map((v, i) => (
            <button
              key={i}
              className="col"
              aria-label={`${labels[i]}: ${fmt(v)}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              <i style={{ height: `${(v / top) * 100}%` }}>
                {hover === i && <span className="tip"><small>{labels[i]}</small>{fmt(v)}</span>}
              </i>
            </button>
          ))}
        </div>
        <div className="chart-x" aria-hidden>
          {labels.map((l, i) => <span key={i}>{i % every ? "" : l}</span>)}
        </div>
      </div>
    </div>
  );
}

// Known /dashboard groups. Each has a fixed slot (grid area) in the overview layout;
// unknown groups the API adds later render as plain cards underneath.
const CATEGORIES = {
  carbonMetrics: { title: "Carbon", href: "/sales" },
  orders: { title: "Orders", href: "/sales" },
  projects: { title: "Projects", href: "/projects" },
  clients: { title: "Clients", href: "/accounts" },
  wallets: { title: "Wallets", href: "/wallet" },
  rewards: { title: "Rewards", href: "/rewards" },
};
const NETWORK = ["clients", "wallets", "rewards"];

// Labels where the raw key would be ambiguous next to its siblings.
const LABELS = { "orders.pending": "Pending orders", "orders.pendingKg": "Pending footprint", "orders.adjustedKg": "Adjusted footprint", "carbonMetrics.pendingKg": "Pending footprint" };

// "totalKgAdjusted" -> ["Total adjusted", "kg"]; "amountAlgo" -> ["Amount", "ALGO"]
function metricLabel(group, key) {
  const unit = /kg/i.test(key) ? "kg" : /algo/i.test(key) ? "ALGO" : "";
  const label = LABELS[`${group}.${key}`] || humanize(key.replace(/kg|algo/gi, "") || key).trim().toLowerCase().replace(/^./, (c) => c.toUpperCase());
  return [label, unit];
}

function Metric({ group, k, v, big }) {
  const [label, unit] = metricLabel(group, k);
  return (
    <div className={big ? "metric big" : "metric"}>
      <span>{label}</span>
      <strong title={fmt(v)}><CountUp value={v} format={(x) => (Math.abs(v) >= 1e5 ? compact(x) : fmt(x))} />{unit && <small> {unit}</small>}</strong>
    </div>
  );
}

// Two-part ring: adjusted (accent) vs pending (lighter step of the same hue), 2px surface gap between.
function Donut({ done, pending }) {
  const r = 52, C = 2 * Math.PI * r, gap = done && pending ? 2 : 0;
  const share = done / (done + pending);
  const arcs = [
    ["done", done, share * C, 0],
    ["pending", pending, (1 - share) * C, share * C],
  ];
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 128 128" className="donut" role="img" aria-label={`${Math.round(share * 100)}% of footprint adjusted`}>
        {arcs.map(([cls, v, len, offset]) => len > 0 && (
          <circle key={cls} className={cls} cx="64" cy="64" r={r} strokeDasharray={`${Math.max(len - gap, 0)} ${C}`} strokeDashoffset={-offset - gap / 2}>
            <title>{`${cls === "done" ? "Adjusted" : "Pending"}: ${fmt(v)} kg`}</title>
          </circle>
        ))}
        <text x="64" y="62" className="donut-value">{Math.round(share * 100)}%</text>
        <text x="64" y="80" className="donut-label">adjusted</text>
      </svg>
      <ul className="legend">
        <li><i className="done" /> Adjusted <strong>{fmt(done)} kg</strong></li>
        <li><i className="pending" /> Pending <strong>{fmt(pending)} kg</strong></li>
      </ul>
    </div>
  );
}

function CategoryCard({ id, data }) {
  const meta = CATEGORIES[id] || { title: humanize(id) };
  const metrics = Object.entries(data).filter(([, v]) => typeof v === "number");
  if (!metrics.length) return null;
  const [first, ...others] = metrics;
  // Carbon: adjusted vs pending footprint as a ring; pending then lives in the legend, not the row.
  const done = data.totalKgAdjusted, pending = data.pendingKg;
  const ring = id === "carbonMetrics" && done + pending > 0;
  const rest = ring ? others.filter(([k]) => k !== "pendingKg") : others;

  const body = (
    <>
      <Metric group={id} k={first[0]} v={first[1]} big />
      {rest.length > 0 && <div className="metric-row">{rest.map(([k, v]) => <Metric key={k} group={id} k={k} v={v} />)}</div>}
    </>
  );

  return (
    <section className={`card cat area-${id}`}>
      <div className="card-head">
        <h2>{meta.title}</h2>
        {meta.href && <Link href={meta.href} className="cat-link">View →</Link>}
      </div>
      {ring ? <div className="cat-split"><div className="cat-main">{body}</div><Donut done={done} pending={pending} /></div> : body}
    </section>
  );
}

// Clients, wallets and rewards share one card, split into sections.
function NetworkCard({ data }) {
  const parts = NETWORK.filter((k) => data[k]);
  if (!parts.length) return null;
  return (
    <section className="card area-network network">
      {parts.map((k) => {
        const [first, ...rest] = Object.entries(data[k]).filter(([, v]) => typeof v === "number");
        return (
          <div key={k} className="network-part">
            <div className="card-head"><h2>{CATEGORIES[k].title}</h2><Link href={CATEGORIES[k].href} className="cat-link">View →</Link></div>
            {first && <Metric group={k} k={first[0]} v={first[1]} big />}
            {rest.map(([mk, v]) => <Metric key={mk} group={k} k={mk} v={v} />)}
          </div>
        );
      })}
    </section>
  );
}

// Item count of a list response: an explicit total if the API sends one (top level or one object deep,
// e.g. pagination.total), else the number of rows returned.
const TOTAL_KEYS = ["total", "totalItems", "totalDocs", "totalCount", "totalRecords", "count"];
const itemCount = (d) => {
  if (!d || typeof d !== "object") return undefined;
  const levels = [d, ...Object.values(d).filter((v) => v && typeof v === "object" && !Array.isArray(v))];
  for (const o of levels) for (const k of TOTAL_KEYS) if (Number.isFinite(o[k])) return o[k];
  return findArray(d).length;
};

const SALES = [
  ["Total sales", "/salesRegisters"],
  ["Pending", "/orders/pending"],
  ["Adjusted", "/orders/adjusted"],
  ["Failed UCR", "/orders/failed-ucr"],
];
// /salesRegisters reports a total, so one row is enough. The /orders/* lists send no total, so fetch
// them whole and count rows. ponytail: 1000-row cap; ask the backend for a total if these lists grow.
const ONE = { page: 1, limit: 1 };
const ALL = { page: 1, limit: 1000 };

function SalesCounts() {
  const states = [useApi(SALES[0][1], ONE), useApi(SALES[1][1], ALL), useApi(SALES[2][1], ALL), useApi(SALES[3][1], ALL)];
  const counts = states.map((st) => itemCount(st.data));
  const [, pending, adjusted] = counts;
  const share = pending != null && adjusted != null && pending + adjusted > 0 ? adjusted / (pending + adjusted) : null;
  return (
    <section className="card cat area-sales">
      <div className="card-head"><h2>Sales</h2><Link href="/sales" className="cat-link">View →</Link></div>
      <nav className="sales-list" aria-label="Sales counts">
        {SALES.map(([label], i) => {
          const { loading, error } = states[i], n = counts[i];
          return (
            <Link key={label} href={`/sales?tab=${i}`} className={`sales-row${i === 3 && n > 0 ? " bad" : ""}`}>
              <span>{label}</span>
              <strong title={error || (n == null && !loading ? "Count not in API response" : undefined)}>{loading ? "…" : error || n == null ? "—" : <CountUp value={n} />}</strong>
            </Link>
          );
        })}
      </nav>
      {share != null && (
        <div className="dist">
          <div className="dist-bar" role="img" aria-label={`${Math.round(share * 100)}% of orders adjusted`}><i style={{ width: `${share * 100}%` }} /></div>
          <span className="muted">{Math.round(share * 100)}% of orders adjusted</span>
        </div>
      )}
    </section>
  );
}

// Same ALGO balance hero as the Wallet page.
function DashboardWallet() {
  const balance = useApi("/wallet-balance");
  const details = useApi("/getwalletdetails");
  if (balance.loading || details.loading) return <section className="card area-wallet"><Skeleton lines={4} /></section>;
  if (balance.error && details.error) return <section className="card area-wallet"><ErrorNote>{balance.error}</ErrorNote></section>;
  const ct = balance.data?.ctCoins;
  return (
    <div className="area-wallet">
      <WalletCard balance={balance.data} details={details.data}>
        {ct && (
          <div className="wallet-stats">
            <div><span>CTC treasury</span><strong>{fmt(Number(ct.treasuryBalance))}</strong></div>
            <div><span>CTC distributed</span><strong>{fmt(Number(ct.distributed))}</strong></div>
          </div>
        )}
      </WalletCard>
    </div>
  );
}

function Overview({ data }) {
  const d = data || {};
  const isGroup = (v) => v && typeof v === "object" && !Array.isArray(v);
  const extra = Object.entries(d).filter(([k, v]) => isGroup(v) && !CATEGORIES[k] && k !== "notifications");
  return (
    <>
      <div className="overview">
        {["carbonMetrics", "orders", "projects"].map((k) => isGroup(d[k]) && <CategoryCard key={k} id={k} data={d[k]} />)}
        <SalesCounts />
        <DashboardWallet />
        <NetworkCard data={d} />
      </div>
      {extra.length > 0 && <div className="cat-grid">{extra.map(([k, v]) => <CategoryCard key={k} id={k} data={v} />)}</div>}
    </>
  );
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export default function Dashboard() {
  const [range, setRange] = useState(30);
  const kpis = useApi("/dashboard");
  const counts = useApi("/counts");
  const stats = useApi("/salesRegisters/stats", { range, groupBy: range > 90 ? "month" : "day" });
  const sales = useApi("/salesRegisters", { limit: 8 });

  // "2026-09-01" -> "1 Sep"; "2026-09" -> "Sep 26"; anything else as-is.
  const labels = (stats.data?.labels || []).map((l) =>
    /^\d{4}-\d\d-\d\d/.test(l) ? new Date(l).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : /^\d{4}-\d\d$/.test(l) ? new Date(`${l}-01`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
    : l);
  const values = (stats.data?.values || stats.data?.data || []).map(Number);
  const total = values.reduce((a, b) => a + b, 0);
  const peak = values.length ? Math.max(...values) : 0;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <Head><title>Dashboard · CarbonTrace</title></Head>
      <PageHead title={greeting()} sub={`${today} · here’s how CarbonTrace is doing`} icon="dashboard">
        {kpis.data?.notifications?.unread > 0 && (
          <Link href="/notifications" className="notice-pill">
            <span className="dot" aria-hidden /> {fmt(kpis.data.notifications.unread)} unread notifications
          </Link>
        )}
      </PageHead>

      {kpis.loading ? <section className="card"><Skeleton lines={4} /></section>
        : kpis.error ? <section className="card"><ErrorNote>{kpis.error}</ErrorNote></section>
        : <Overview data={kpis.data} />}

      <div className="grid-2">
        <Card
          title="Sales trend"
          state={stats}
          actions={
            <div className="segmented" role="group" aria-label="Range">
              {RANGES.map(([d, l]) => (
                <button key={d} aria-pressed={range === d} onClick={() => setRange(d)}>{l}</button>
              ))}
            </div>
          }
        >
          {values.length ? (
            <>
              <div className="chart-summary">
                <div><span className="muted">Total</span><strong>{fmt(total)}</strong></div>
                <div><span className="muted">Peak</span><strong>{fmt(peak)}</strong></div>
                <div><span className="muted">Average</span><strong>{fmt(Math.round(total / values.length))}</strong></div>
              </div>
              <ColumnChart labels={labels} values={values} />
              <details className="table-view">
                <summary>View as table</summary>
                <DataTable rows={labels.map((l, i) => ({ period: l, value: values[i] }))} />
              </details>
            </>
          ) : <p className="empty">No sales in this range.</p>}
        </Card>

        <Card title="At a glance" state={counts}><KeyValues data={counts.data} empty="No counts returned." /></Card>
      </div>

      <Card title="Recent sales" state={sales} actions={<Link className="btn" href="/sales">View all</Link>}>
        <DataTable rows={findArray(sales.data)} empty="No sales registers yet." />
      </Card>
    </>
  );
}
