import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { ActionButton, Card, DataTable, findArray, FormDialog, PageHead, Pager, rowId, Tabs, useApi } from "@/lib/ui";

const TABS = [
  ["All sales", "/salesRegisters"],
  ["Pending", "/orders/pending"],
  ["Adjusted", "/orders/adjusted"],
  ["Failed UCR", "/orders/failed-ucr"],
];
const LIMIT = 20;

// ponytail: lot id field name guessed; fix once a real failed-ucr row is seen.
const lotId = (r) => r.lotId || r.lot_id || r.ucr_lot_id || rowId(r);

export default function Sales() {
  // The tab lives in ?tab=N so dashboard tiles can link straight to it.
  const router = useRouter();
  const tab = Math.min(Number(router.query.tab) || 0, TABS.length - 1);
  const setTab = (t) => router.replace({ query: t ? { tab: t } : {} }, undefined, { shallow: true });
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});
  const [label, path] = TABS[tab];
  const isAll = tab === 0;

  const list = useApi(path, { page, limit: LIMIT, ...(isAll && Object.fromEntries(Object.entries(filters).filter(([, v]) => v))) });
  const rows = findArray(list.data);
  const clients = useApi("/accounts/clients", { limit: 200 });
  const projects = useApi("/projects/details");
  const clientOptions = findArray(clients.data).map((c) => [rowId(c), c.name ? `${c.name}${c.email ? ` (${c.email})` : ""}` : rowId(c)]);
  const projectOptions = findArray(projects.data).map((p) => [String(p.project_id ?? p.projectId ?? rowId(p)), p.name || String(p.project_id ?? rowId(p))]);

  const applyFilters = (e) => {
    e.preventDefault();
    setFilters(Object.fromEntries(new FormData(e.target)));
    setPage(1);
  };

  return (
    <>
      <Head><title>Sales & Orders · CarbonTrace</title></Head>
      <PageHead title="Sales & Orders" sub="Register sales, track offset adjustment and UCR retirements" icon="sales">
        <FormDialog
          label="+ New sale"
          title="Register a new sale"
          note="Registering a sale triggers offset calculation and CTCoin reward distribution for the client."
          path="/salesRegisters"
          submitLabel="Register sale"
          onDone={list.reload}
          fields={[
            ["client_id", "Client", { type: "select", required: true, options: clientOptions, placeholder: clients.loading ? "Loading clients…" : "Select a client" }],
            ["sale_order_id", "Sale order ID", { required: true, placeholder: "SO-2026-001" }],
            ["carbon_footprint", "Carbon footprint (kg CO₂e)", { type: "number", placeholder: "500" }],
            ["sale_date", "Sale date", { type: "datetime-local", hint: "Leave blank for now" }],
            ["project_ids", "Offset projects", { type: "multi", required: true, options: projectOptions }],
          ]}
        />
      </PageHead>
      <Tabs tabs={TABS.map(([l]) => l)} value={tab} onChange={(t) => { setTab(t); setPage(1); }} />

      {isAll && (
        <form className="filters" onSubmit={applyFilters}>
          <input name="q" type="search" placeholder="Order ID or client name" defaultValue={filters.q} aria-label="Search" />
          <label>From <input name="startDate" type="date" defaultValue={filters.startDate} /></label>
          <label>To <input name="endDate" type="date" defaultValue={filters.endDate} /></label>
          <button className="btn">Apply</button>
        </form>
      )}

      <Card title={label} state={list}>
        <DataTable
          rows={rows}
          empty={`No ${label.toLowerCase()}.`}
          action={(r) => (tab === 3 ? (
            <>
              <Link className="btn" href={`/sales/lot/${encodeURIComponent(lotId(r))}`}>Details</Link>
              <ActionButton label="Retry" path={`/ucr/failed-lots/${encodeURIComponent(lotId(r))}/retry`} onDone={list.reload} />
            </>
          ) : (
            <ActionButton
              label="Edit"
              method="PUT"
              path={`/salesRegisters/${encodeURIComponent(rowId(r))}`}
              // ponytail: prompt-based edit; swap for a form/select once the status values are known.
              body={() => {
                const status = window.prompt("Status (e.g. Adjusted)", r.status ?? "");
                if (status === null) return null;
                const cf = window.prompt("Carbon footprint", r.carbon_footprint ?? "");
                if (cf === null) return null;
                return { ...(status && { status }), ...(cf !== "" && { carbon_footprint: +cf }) };
              }}
              onDone={list.reload}
            />
          ))}
        />
        <Pager page={page} setPage={setPage} data={list.data} rows={rows} limit={LIMIT} />
      </Card>
    </>
  );
}
