import Head from "next/head";
import { useState } from "react";
import { api, post } from "@/lib/api";
import { ActionButton, ErrorNote, Icon, KeyValues, PageHead, Tiles } from "@/lib/ui";

// A small form that calls `run(values)` and shows the response: numbers as tiles, the rest as details.
function Tool({ title, desc, icon, fields, run, extra }) {
  const [state, setState] = useState({});
  async function submit(e) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    setState({ loading: true });
    try {
      setState({ data: await run(values), values });
    } catch (err) {
      setState({ error: err.message });
    }
  }
  return (
    <section className="card tool">
      <div className="tool-head">
        <span className="stat-icon"><Icon name={icon} size={18} /></span>
        <div><h2>{title}</h2><p className="muted">{desc}</p></div>
      </div>
      <form className="tool-form" onSubmit={submit}>
        {fields.map(([name, label, type = "number", unit]) => (
          <label key={name}>
            <span>{label}</span>
            <span className="unit-input">
              <input name={name} type={type} step="any" min={type === "number" ? 0 : undefined} required placeholder={type === "number" ? "0" : ""} />
              {unit && <em>{unit}</em>}
            </span>
          </label>
        ))}
        <button className="btn primary" disabled={state.loading}>{state.loading ? <span className="spinner" aria-hidden /> : <Icon name="arrow" size={14} />} Calculate</button>
      </form>
      {state.error && <ErrorNote>{state.error}</ErrorNote>}
      {state.data && (
        <div className="tool-result">
          <Tiles data={state.data} />
          <details><summary>All fields</summary><KeyValues data={state.data} /></details>
          {extra?.(state.values)}
        </div>
      )}
    </section>
  );
}

export default function Tools() {
  return (
    <>
      <Head><title>Tools · CarbonTrace</title></Head>
      <PageHead title="Tools" sub="Quick calculators for charges and rewards, and reward troubleshooting" icon="tools" />
      <div className="tool-grid">
        <Tool
          title="Carbon offset charges"
          desc="What a client is charged to offset a footprint."
          icon="leaf"
          fields={[["carbon_footprint", "Carbon footprint", "number", "kg CO₂e"]]}
          run={(v) => post("/carbon/charges", { carbon_footprint: +v.carbon_footprint })}
        />
        <Tool
          title="CTCoin reward preview"
          desc="How many CTCoins a sale would earn."
          icon="coin"
          fields={[["carbon_footprint", "Carbon footprint", "number", "kg"], ["invoice_value", "Invoice value", "number", "₹"]]}
          run={(v) => api("/rewards/preview", v)}
        />
        <Tool
          title="Reward status"
          desc="Look up a sale’s reward transfer and retry it if it failed."
          icon="search"
          fields={[["sale_order_id", "Sale order ID", "text"]]}
          run={(v) => api(`/admin/reward-status/${encodeURIComponent(v.sale_order_id)}`)}
          extra={(v) => (
            <ActionButton
              label="Retry reward"
              path={`/admin/retry-reward/${encodeURIComponent(v.sale_order_id)}`}
              confirm={`Retry reward distribution for ${v.sale_order_id}?`}
              onDone={(r) => alert(r?.message || "Retry requested.")}
            />
          )}
        />
      </div>
    </>
  );
}
