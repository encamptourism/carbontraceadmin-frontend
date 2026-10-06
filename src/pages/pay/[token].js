import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { post } from "@/lib/api";
import { DataTable, KeyValues, useApi } from "@/lib/ui";

const first = (o, ...keys) => keys.map((k) => o?.[k]).find((v) => v != null && v !== "");
const inr = (v) => Number(v).toLocaleString("en-IN", { style: "currency", currency: "INR" });

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = ok;
    s.onerror = () => fail(new Error("Could not load Razorpay checkout."));
    document.body.appendChild(s);
  });
}

export default function Pay() {
  const { token: raw } = useRouter().query;
  const token = raw && encodeURIComponent(raw);
  const bill = useApi(token && `/public/billing/${token}`);
  const [pay, setPay] = useState({});
  const b = bill.data?.billing || bill.data || {};
  const amount = first(b, "totalAmount", "total_amount", "grandTotal", "grand_total", "amount", "total");
  const paid = /paid/i.test(b.status || "") || pay.done;
  const lists = Object.entries(b).filter(([, v]) => Array.isArray(v) && v.length && typeof v[0] === "object");

  async function startPayment() {
    setPay({ busy: true });
    try {
      const [order] = await Promise.all([post(`/public/billing/${token}/razorpay-order`), loadRazorpay()]);
      const o = order.order || order;
      // ponytail: key/order field names guessed from Razorpay conventions; env key is the fallback.
      const key = first(order, "key", "key_id", "keyId", "razorpayKeyId") || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!key) throw new Error("Payment isn't configured (no Razorpay key). Please contact support.");
      new window.Razorpay({
        key,
        order_id: first(o, "id", "order_id", "orderId"),
        amount: o.amount,
        currency: o.currency || "INR",
        name: "CarbonTrace",
        description: first(b, "invoiceNumber", "invoice_number") ? `Invoice ${first(b, "invoiceNumber", "invoice_number")}` : "Invoice payment",
        prefill: { name: first(b, "clientName", "client_name"), email: first(b, "clientEmail", "client_email", "email") },
        theme: { color: "#1f8a5b" },
        modal: { ondismiss: () => setPay({}) },
        handler: async (r) => {
          setPay({ busy: true, verifying: true });
          try {
            await post(`/public/billing/${token}/verify-payment`, {
              razorpay_order_id: r.razorpay_order_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            });
            setPay({ done: true, paymentId: r.razorpay_payment_id });
            bill.reload();
          } catch (e) {
            setPay({ error: `Payment received but verification failed: ${e.message}. Keep this payment ID: ${r.razorpay_payment_id}` });
          }
        },
      }).open();
    } catch (e) {
      setPay({ error: e.message });
    }
  }

  return (
    <main className="public-shell">
      <Head><title>Pay invoice · CarbonTrace</title></Head>
      <div className="public-brand"><span className="logo" aria-hidden>●</span>CarbonTrace</div>
      <section className="card public-card">
        {bill.loading ? <p className="muted">Loading invoice…</p> : bill.error ? (
          <>
            <h1>Invoice not found</h1>
            <p className="muted">This payment link is invalid or has expired. ({bill.error})</p>
          </>
        ) : (
          <>
            <p className="muted">Invoice {first(b, "invoiceNumber", "invoice_number", "invoice_no") || ""}</p>
            <h1 className="pay-amount">{amount != null ? inr(amount) : "—"}</h1>
            {first(b, "clientName", "client_name") && <p>Billed to <strong>{first(b, "clientName", "client_name")}</strong></p>}
            {paid ? (
              <p className="modal-ok">✓ Paid{pay.paymentId ? ` · Payment ID ${pay.paymentId}` : ""}. Thank you!</p>
            ) : (
              <button className="btn primary pay-btn" onClick={startPayment} disabled={pay.busy || amount == null}>
                {pay.verifying ? "Verifying payment…" : pay.busy ? "Opening checkout…" : `Pay ${amount != null ? inr(amount) : ""}`}
              </button>
            )}
            {pay.error && <p className="error" role="alert">{pay.error}</p>}
            {lists.map(([k, rows]) => <DataTable key={k} rows={rows} />)}
            <details className="raw-json"><summary>Invoice details</summary><KeyValues data={b} /></details>
            <p className="muted secure-note">Payments are processed securely by Razorpay.</p>
          </>
        )}
      </section>
    </main>
  );
}
