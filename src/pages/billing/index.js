import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { ActionButton, Card, DataTable, Icon, Menu, PageHead, StatusChips, Tabs, Tiles, CountUp, compact, findArray, fmt, rowId, useApi } from "@/lib/ui";

const STATUS = /^(status|payment_?status|billing_?status)$/i;
const AMOUNT = /^(total|amount|total_?amount|grand_?total|net_?amount|invoice_?amount)$/i;
const money = (v) => `₹${Math.abs(v) >= 1e5 ? compact(v) : fmt(Math.round(v))}`;

// Totals from the invoices on screen; skipped when rows carry no amount field.
function Summary({ rows, statusKey }) {
  const amountKey = rows[0] && Object.keys(rows[0]).find((k) => AMOUNT.test(k) && typeof rows[0][k] === "number");
  const sum = (f) => rows.filter(f).reduce((a, r) => a + (Number(r[amountKey]) || 0), 0);
  const paid = (r) => /paid|settled/i.test(r[statusKey] ?? "");
  const stats = [
    ["Invoices", rows.length, fmt, "billing"],
    ...(amountKey ? [
      ["Billed", sum(() => true), money, "coin"],
      ["Collected", sum(paid), money, "check"],
      ["Outstanding", sum((r) => !paid(r)), money, "clock"],
    ] : []),
  ];
  return (
    <div className="stat-strip">
      {stats.map(([label, v, f, icon]) => (
        <div key={label} className={`stat ${label === "Outstanding" && v > 0 ? "warn" : ""}`}>
          <span className="stat-icon"><Icon name={icon} size={16} /></span>
          <div><span>{label}</span><strong><CountUp value={v} format={f} /></strong></div>
        </div>
      ))}
    </div>
  );
}

export default function Billing() {
  const [tab, setTab] = useState(0);
  const [status, setStatus] = useState("");
  const list = useApi(tab ? "/billing/aging" : "/billing");
  const all = findArray(list.data);
  const statusKey = all[0] && Object.keys(all[0]).find((k) => STATUS.test(k));
  // ponytail: filters the loaded rows client-side; move to the API's ?status= once its values are known.
  const rows = status ? all.filter((r) => String(r[statusKey]) === status) : all;

  const actions = (r) => {
    const id = encodeURIComponent(rowId(r));
    return (
      <>
        <Link className="btn" href={`/billing/${id}`}>View</Link>
        <ActionButton label="Issue" path={`/billing/${id}/issue`} confirm="Issue this invoice?" onDone={list.reload} />
        <ActionButton label="Mark paid" path={`/billing/${id}/pay`} confirm="Mark this invoice as paid?" onDone={list.reload} />
        <Menu>
          <ActionButton label="Send reminder" path={`/billing/${id}/send-reminder`} confirm="Email a payment reminder?" />
          <a className="btn" href={`/api/v1/billing/${id}/download-invoice`}><Icon name="download" size={14} /> PDF</a>
          <a className="btn" href={`/api/v1/billing/${id}/export/excel`}><Icon name="download" size={14} /> Excel</a>
        </Menu>
      </>
    );
  };

  return (
    <>
      <Head><title>Billing · CarbonTrace</title></Head>
      <PageHead title="Billing" sub="Carbon-charge invoices, payments and receivables ageing" icon="billing" />
      <Tabs tabs={["Invoices", "Aging report"]} value={tab} onChange={(t) => { setTab(t); setStatus(""); }} />

      {tab === 0 ? (
        <>
          {!list.loading && !list.error && all.length > 0 && <Summary rows={all} statusKey={statusKey} />}
          {statusKey && <StatusChips rows={all} field={statusKey} value={status} onChange={setStatus} />}
          <Card title={status ? `${status} invoices` : "All invoices"} icon="billing" state={list}>
            <DataTable rows={rows} empty="No invoices." action={actions} />
          </Card>
        </>
      ) : (
        <>
          {list.data && !Array.isArray(list.data) && <Card title="Ageing buckets" icon="clock" state={list}><Tiles data={list.data} /></Card>}
          <Card title="Outstanding by age" icon="clock" state={list}>
            <DataTable rows={all} empty="Nothing outstanding." action={actions} />
          </Card>
        </>
      )}
    </>
  );
}
