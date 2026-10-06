import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { ActionButton, DataTable, ErrorNote, Icon, KeyValues, PageHead, Skeleton, humanize, pick, toneOf, useApi } from "@/lib/ui";

const pickToken = (b) => b?.publicToken || b?.public_token || b?.paymentToken || b?.payment_token || b?.token;
const money = (v) => `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (v) => (typeof v === "string" && !isNaN(new Date(v)) ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null);

export default function BillingDetail() {
  const { id: raw } = useRouter().query;
  const id = raw && encodeURIComponent(raw);
  const bill = useApi(id && `/billing/${id}`);
  const b = bill.data?.billing || bill.data || {};
  const lists = Object.entries(b).filter(([, v]) => Array.isArray(v) && v.length && typeof v[0] === "object");
  const token = pickToken(b);
  const [copied, setCopied] = useState(false);
  const payUrl = token && typeof window !== "undefined" ? `${window.location.origin}/pay/${encodeURIComponent(token)}` : null;

  const number = b.invoiceNumber || b.invoice_number || b.invoice_no || "Invoice";
  const status = pick(b, /^(status|payment_?status)$/i);
  const client = b.client && typeof b.client === "object" ? b.client : {};
  const party = [pick(client, /name/i) || pick(b, /client_?name|customer_?name|company/i), pick(client, /email/i) || pick(b, /email/i)].filter(Boolean);
  const dates = [["Issued", pick(b, /issue|invoice_?date|created_?at/i)], ["Due", pick(b, /due/i)], ["Paid", pick(b, /paid_?(at|on|date)/i)]].map(([l, v]) => [l, date(v)]).filter(([, v]) => v);
  // Money lines for the totals box: subtotal/tax/discount first, the grand total last and emphasised.
  const totals = Object.entries(b).filter(([k, v]) => typeof v === "number" && /amount|total|tax|gst|discount|charge|subtotal/i.test(k));
  const grand = totals.find(([k]) => /^(total|grand_?total|total_?amount|amount|net_?amount)$/i.test(k));

  return (
    <>
      <Head><title>{number} · CarbonTrace</title></Head>
      <PageHead title="" back={["/billing", "Billing"]}>
        {id && (
          <>
            <ActionButton label="Issue" path={`/billing/${id}/issue`} confirm="Issue this invoice?" onDone={bill.reload} />
            <ActionButton label="Mark paid" path={`/billing/${id}/pay`} confirm="Mark this invoice as paid?" onDone={bill.reload} />
            <ActionButton label="Send reminder" path={`/billing/${id}/send-reminder`} confirm="Email a payment reminder?" />
            <a className="btn" href={`/api/v1/billing/${id}/download-invoice`}><Icon name="download" size={14} /> PDF</a>
            <a className="btn" href={`/api/v1/billing/${id}/export/excel`}><Icon name="download" size={14} /> Excel</a>
          </>
        )}
      </PageHead>

      <article className="invoice">
        {bill.loading ? <Skeleton lines={6} /> : bill.error ? <ErrorNote>{bill.error}</ErrorNote> : (
          <>
            <header className="invoice-head">
              <div>
                <span className="invoice-kicker">Invoice</span>
                <h1>{number}</h1>
                {status && <span className={`pill ${toneOf(status)}`}>{String(status)}</span>}
              </div>
              <div className="invoice-brand"><span className="brand-mark"><Icon name="leaf" size={16} /></span>CarbonTrace</div>
            </header>

            <div className="invoice-parties">
              {party.length > 0 && <div><span>Billed to</span>{party.map((p, i) => i ? <small key={p}>{p}</small> : <strong key={p}>{p}</strong>)}</div>}
              {dates.map(([l, v]) => <div key={l}><span>{l}</span><strong>{v}</strong></div>)}
            </div>

            {lists.map(([k, rows]) => (
              <div key={k} className="invoice-lines">
                <h3>{humanize(k)}</h3>
                <DataTable rows={rows} />
              </div>
            ))}

            {totals.length > 0 && (
              <dl className="invoice-totals">
                {totals.filter((t) => t !== grand).map(([k, v]) => <div key={k}><dt>{humanize(k)}</dt><dd>{money(v)}</dd></div>)}
                {grand && <div className="grand"><dt>{humanize(grand[0])}</dt><dd>{money(grand[1])}</dd></div>}
              </dl>
            )}
          </>
        )}
      </article>

      {payUrl && (
        <section className="card pay-link">
          <span className="stat-icon"><Icon name="external" size={16} /></span>
          <div>
            <strong>Client payment link</strong>
            <p className="muted">Share with the client to pay online via Razorpay.</p>
          </div>
          <code>{payUrl}</code>
          <button className="btn primary" onClick={() => navigator.clipboard.writeText(payUrl).then(() => setCopied(true))}>{copied ? "Copied ✓" : "Copy link"}</button>
        </section>
      )}

      <details className="card all-fields">
        <summary><Icon name="list" size={15} /> All invoice fields</summary>
        <KeyValues data={b} />
      </details>
    </>
  );
}
