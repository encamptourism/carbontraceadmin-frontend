import Head from "next/head";
import { useState } from "react";
import { api } from "@/lib/api";
import { ActionButton, Avatar, Card, DataTable, Empty, FormDialog, Icon, PageHead, Skeleton, ErrorNote, ago, findArray, pick, rowId, toneOf, useApi } from "@/lib/ui";

// Pipeline stage order; statuses the API returns that aren't listed here get their own columns at the end.
const STAGES = ["New", "Open", "Contacted", "In progress", "Qualified", "Converted", "Closed", "Lost"];
const norm = (s) => String(s || "New").trim();
const stageIndex = (s) => { const i = STAGES.findIndex((x) => x.toLowerCase() === norm(s).toLowerCase()); return i < 0 ? STAGES.length : i; };

function Lead({ r, stages, onMoved }) {
  const id = encodeURIComponent(rowId(r));
  const [busy, setBusy] = useState(false);
  const name = pick(r, /^name$/i) || "Unknown";
  const company = pick(r, /company|organisation|organization/i);
  const email = pick(r, /email/i);
  const message = pick(r, /message|note|details/i);
  const when = pick(r, /created_?at|date/i);

  async function move(e) {
    const status = e.target.value;
    setBusy(true);
    try {
      await api(`/inquiries/${id}/status`, null, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      onMoved();
    } catch (err) {
      alert(`Couldn't update status: ${err.message}`);
      setBusy(false);
    }
  }

  return (
    <article className={`lead${busy ? " busy" : ""}`}>
      <header>
        <Avatar name={name} size={34} />
        <div className="lead-who">
          <strong>{name}</strong>
          {company && <small>{company}</small>}
        </div>
        {when && <time title={new Date(when).toLocaleString("en-IN")}>{ago(when)}</time>}
      </header>
      {message && <p className="lead-msg">{message}</p>}
      {email && <a className="lead-mail" href={`mailto:${email}`}><Icon name="mail" size={13} />{email}</a>}
      <footer>
        <label className="stage-select">
          <span className="sr-only">Move to stage</span>
          <select value={norm(r.status)} onChange={move} disabled={busy}>
            {stages.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {!/convert/i.test(norm(r.status)) && (
          <ActionButton label="Convert" path={`/inquiries/${id}/convert-to-client`} confirm={`Convert ${name} into a client?`} onDone={onMoved} />
        )}
      </footer>
    </article>
  );
}

export default function Inquiries() {
  const list = useApi("/inquiries");
  const [view, setView] = useState("board");
  const [q, setQ] = useState("");
  const all = findArray(list.data);
  const rows = q ? all.filter((r) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase())) : all;
  const present = [...new Set(all.map((r) => norm(r.status)))];
  const columns = [...new Set([...STAGES.filter((s) => present.some((p) => p.toLowerCase() === s.toLowerCase()) || ["New", "Contacted", "Converted"].includes(s)), ...present])]
    .sort((a, b) => stageIndex(a) - stageIndex(b));
  const stages = [...new Set([...columns, ...STAGES])];

  return (
    <>
      <Head><title>Inquiries · CarbonTrace</title></Head>
      <PageHead title="Inquiries" sub="Leads from the contact form, phone and email — move them through the pipeline" icon="inquiries">
        <FormDialog
          label="+ Add inquiry"
          title="Log an inquiry"
          note="For leads that came in by phone or email. The public contact form uses the same endpoint."
          path="/inquiries"
          submitLabel="Add inquiry"
          onDone={list.reload}
          fields={[
            ["name", "Name", { required: true }],
            ["email", "Email", { type: "email", required: true }],
            ["company", "Company"],
            ["message", "Message", { type: "textarea", required: true }],
          ]}
        />
      </PageHead>

      <div className="toolbar">
        <label className="search-box">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Search name, company, message…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search inquiries" />
        </label>
        <div className="segmented" role="group" aria-label="View">
          <button aria-pressed={view === "board"} onClick={() => setView("board")} aria-label="Board view"><Icon name="grid" size={15} /></button>
          <button aria-pressed={view === "list"} onClick={() => setView("list")} aria-label="List view"><Icon name="list" size={15} /></button>
        </div>
      </div>

      {list.loading ? <section className="card"><Skeleton lines={5} /></section>
        : list.error ? <ErrorNote>{list.error}</ErrorNote>
        : !all.length ? <section className="card"><Empty icon="inquiries" title="No inquiries yet">New leads from the website contact form land here.</Empty></section>
        : view === "list" ? (
          <Card title="All inquiries" icon="list" state={list}>
            <DataTable rows={rows} empty="No inquiries match your search." />
          </Card>
        ) : (
          <div className="board">
            {columns.map((col) => {
              const items = rows.filter((r) => norm(r.status).toLowerCase() === col.toLowerCase());
              return (
                <section key={col} className={`board-col ${toneOf(col)}`}>
                  <header><i aria-hidden />{col}<b>{items.length}</b></header>
                  <div className="board-items">
                    {items.map((r) => <Lead key={rowId(r)} r={r} stages={stages} onMoved={list.reload} />)}
                    {!items.length && <p className="board-empty">Nothing here</p>}
                  </div>
                </section>
              );
            })}
          </div>
        )}
    </>
  );
}
