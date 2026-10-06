import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Response shapes aren't in the swagger, so these render whatever comes back.
export const humanize = (k) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const findArray = (d) => (Array.isArray(d) ? d : Object.values(d || {}).find(Array.isArray) || []);

export const rowId = (r) => r._id ?? r.id;

export const fmt = (v) =>
  typeof v === "number" ? v.toLocaleString("en-IN")
  : typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v).toLocaleDateString("en-IN")
  : v && typeof v === "object" ? JSON.stringify(v)
  : String(v ?? "—");

// Indian-style short numbers: 1.2K, 4.5L, 3.1Cr.
export const compact = (v) => {
  const a = Math.abs(v);
  const [d, u] = a >= 1e7 ? [1e7, "Cr"] : a >= 1e5 ? [1e5, "L"] : a >= 1e3 ? [1e3, "K"] : [1, ""];
  return `${+(v / d).toFixed(1)}${u}`;
};

// Total page count from { pagination | meta | top-level } { pages | totalPages }.
const pageCount = (d) => {
  const p = d?.pagination || d?.meta || d || {};
  return p.pages ?? p.totalPages;
};

// Flatten nested objects into [["Parent · Key", value]] for values passing `keep`.
const leaves = (obj, keep, prefix = "") =>
  Object.entries(obj || {}).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? leaves(v, keep, `${prefix}${humanize(k)} · `)
    : keep(v, k) ? [[prefix + humanize(k), v]]
    : []
  );

const SECRET = /pass|secret|token|api.?key|private|mnemonic/i;

export function useApi(path, params) {
  const [state, setState] = useState({ loading: true });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!path) return;
    api(path, params).then((data) => setState({ data }), (error) => setState({ error: error.message }));
  }, [path, key, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: () => setTick((t) => t + 1) };
}

// Shimmer placeholder lines shown while data loads.
export const Skeleton = ({ lines = 3 }) => (
  <div className="skeleton" aria-busy="true" aria-label="Loading">
    {Array.from({ length: lines }, (_, i) => <i key={i} style={{ width: `${92 - ((i * 17) % 40)}%` }} />)}
  </div>
);

export const ErrorNote = ({ children }) => <p className="error-note" role="alert"><Icon name="alert" size={16} /> {children}</p>;

export function Card({ title, state, children, actions, icon, className = "" }) {
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <h2>{icon && <Icon name={icon} size={16} />}{title}</h2>
        {actions}
      </div>
      {state.loading ? <Skeleton /> : state.error ? <ErrorNote>{state.error}</ErrorNote> : children}
    </section>
  );
}

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Animates a number from 0 to `value` once, then tracks changes. `format` renders each frame.
export function CountUp({ value, format = fmt, duration = 900 }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (typeof value !== "number" || !isFinite(value) || reduceMotion()) return;
    let raf, start;
    const step = (t) => {
      start ??= t;
      const p = Math.min((t - start) / duration, 1);
      setShown(value * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  if (typeof value !== "number" || !isFinite(value) || reduceMotion()) return format(value);
  // Mid-animation frames use the final value's precision, so 14.988 counts as 3.412, 7.905… not long fractions.
  const places = (String(value).split(".")[1] || "").length;
  return format(shown === value ? value : +shown.toFixed(places));
}

// Every numeric field (nested ones too) becomes a stat tile.
export function Tiles({ data }) {
  const tiles = leaves(data, (v) => typeof v === "number");
  if (!tiles.length) return <p className="muted">No metrics returned.</p>;
  return (
    <div className="tiles">
      {tiles.map(([label, v]) => (
        <div key={label} className="tile">
          <span>{label}</span>
          <strong title={fmt(v)}>{/\bid$/i.test(label) ? String(v) : <CountUp value={v} format={(x) => (Math.abs(v) >= 1e5 ? compact(x) : fmt(x))} />}</strong>
        </div>
      ))}
    </div>
  );
}

// Status words get a tone; the word itself stays visible so color is never the only cue.
const tone = (v) =>
  /fail|error|overdue|cancel|reject|expired/i.test(v) ? "bad"
  : /pending|processing|draft|due|partial|queued|new/i.test(v) ? "warn"
  : /paid|complete|success|active|confirmed|issued|settled|sent|ok/i.test(v) ? "good"
  : "";

const Cell = ({ k, v }) =>
  /status|state/i.test(k) && typeof v === "string" ? <span className={`pill ${tone(v)}`}>{v}</span> : fmt(v);

// Columns = scalar keys of the first row (max 8). `action` renders an extra last cell.
export function DataTable({ rows, empty = "No records.", action }) {
  if (!rows.length) return <p className="empty">{empty}</p>;
  const cols = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== "object" && !/^(_?id|__v|password|token|secret)$|^(password|token|secret)/i.test(k)).slice(0, 8);
  // Column that heads each row's card on phones (CSS moves it to the top).
  const title = cols.find((c) => /order|invoice|name|title|number/i.test(c)) || cols[0];
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{cols.map((c) => <th key={c} className={typeof rows[0][c] === "number" ? "num" : ""}>{humanize(c)}</th>)}{action && <th />}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowId(r) || i}>
              {cols.map((c) => <td key={c} data-label={humanize(c)} className={[typeof r[c] === "number" && "num", c === title && "cell-title"].filter(Boolean).join(" ") || undefined}><Cell k={c} v={r[c]} /></td>)}
              {action && <td className="row-actions">{action(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Scalar fields as a definition list; secret-looking keys are masked.
export function KeyValues({ data, empty = "Nothing to show." }) {
  const rows = leaves(data, (v, k) => !Array.isArray(v) && k !== "success");
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <dl className="kv">
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{SECRET.test(k) && v ? "••••••" : fmt(v)}</dd></div>)}
    </dl>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((l, i) => (
        <button key={l} role="tab" aria-selected={i === value} className={i === value ? "active" : ""} onClick={() => onChange(i)}>{l}</button>
      ))}
    </div>
  );
}

export function Pager({ page, setPage, data, rows, limit }) {
  const pages = pageCount(data);
  const hasNext = pages ? page < pages : rows.length === limit;
  if (page === 1 && !hasNext) return null;
  return (
    <div className="pager">
      <button className="btn" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
      <span className="muted">Page {page}{pages ? ` of ${pages}` : ""}</span>
      <button className="btn" disabled={!hasNext} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  );
}

// Calls an admin endpoint, then onDone(). `body` may be a function; returning null cancels.
export function ActionButton({ label, path, method = "POST", body, confirm: question, onDone }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    if (question && !window.confirm(question)) return;
    const b = typeof body === "function" ? body() : body;
    if (b === null) return;
    setBusy(true);
    try {
      const res = await api(path, null, { method, ...(b && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }) });
      onDone?.(res);
    } catch (e) {
      alert(`${label} failed: ${e.message}`);
    }
    setBusy(false);
  }
  return <button className="btn" onClick={run} disabled={busy}>{busy ? "…" : label}</button>;
}

function Modal({ title, onClose, children, wide }) {
  return (
    <dialog className="modal" open aria-labelledby="modal-title" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className={`modal-card${wide ? " wide" : ""}`}>
        <header>
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

// Any API response: scalars as a definition list, each array as a table, raw JSON on demand.
export function Result({ data }) {
  if (data == null) return null;
  if (typeof data !== "object") return <p className="result-scalar">{String(data)}</p>;
  const lists = Object.entries(data).filter(([, v]) => Array.isArray(v) && v.length && typeof v[0] === "object");
  return (
    <div className="result-view">
      <KeyValues data={data} empty="" />
      {lists.map(([k, rows]) => (
        <div key={k}><h3 className="result-h">{humanize(k)}</h3><DataTable rows={rows} /></div>
      ))}
      <details className="raw-json">
        <summary>Raw response</summary>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}

// Button that GETs `path` when opened and shows the response.
export function ViewDialog({ label, title, path, params, className = "btn" }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({});
  function show() {
    setOpen(true);
    setState({ loading: true });
    api(path, params).then((data) => setState({ data }), (e) => setState({ error: e.message }));
  }
  return (
    <>
      <button type="button" className={className} onClick={show}>{label}</button>
      {open && (
        <Modal title={title || label} onClose={() => setOpen(false)} wide>
          {state.loading ? <Skeleton lines={5} /> : state.error ? <ErrorNote>{state.error}</ErrorNote> : <Result data={state.data} />}
        </Modal>
      )}
    </>
  );
}

// Action form in a dialog. Either `fields` ([name, label, opts]) or `json` (a body template for
// endpoints whose body the swagger doesn't document). `extra` is merged into the body.
// opts.type: text | email | number | datetime-local | textarea | select | multi (checkbox list → array)
// `showResult` keeps the dialog open and shows the response; `confirmWord` must be typed to submit.
export function FormDialog({ label, title, note, fields = [], json, extra, path, method = "POST", submitLabel = "Create", onDone, showResult, confirmWord, danger, className }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({});

  async function submit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    let body = {};
    if (json !== undefined) {
      try {
        body = JSON.parse(String(fd.get("__json") || "{}"));
      } catch {
        return setState({ error: "Request body isn't valid JSON." });
      }
    }
    for (const [name, , o = {}] of fields) {
      if (o.type === "multi") {
        const v = fd.getAll(name);
        if (o.required && !v.length) return setState({ error: "Pick at least one option." });
        if (v.length) body[name] = v;
      } else {
        const v = String(fd.get(name) ?? "").trim();
        if (v === "") continue;
        body[name] = o.type === "number" ? Number(v) : o.type === "datetime-local" ? new Date(v).toISOString() : v;
      }
    }
    if (confirmWord && fd.get("__confirm") !== confirmWord) return setState({ error: `Type ${confirmWord} to confirm.` });
    setState({ busy: true });
    try {
      const res = await api(path, null, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...extra }) });
      onDone?.(res);
      if (showResult) setState({ result: res ?? { success: true } });
      else { setState({}); setOpen(false); }
    } catch (err) {
      setState({ error: err.message });
    }
  }

  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className={className || (danger ? "btn danger" : "btn primary")} onClick={() => { setState({}); setOpen(true); }}>{label}</button>
      {open && (
        <Modal title={title || label} onClose={close} wide={showResult}>
          {state.result ? (
            <>
              <p className="modal-ok">✓ Done</p>
              <Result data={state.result} />
              <footer><button type="button" className="btn primary" onClick={close}>Close</button></footer>
            </>
          ) : (
            <form onSubmit={submit} className="modal-form">
              {note && <p className={danger ? "modal-note danger" : "modal-note"}>{note}</p>}
              <div className="modal-fields">
                {fields.map(([name, text, o = {}], i) => (
                  <label key={name} className={o.type === "textarea" || o.type === "multi" || o.full ? "full" : ""}>
                    <span>{text}{o.required && <b aria-hidden> *</b>}</span>
                    {o.type === "textarea" ? <textarea name={name} rows={o.rows || 4} required={o.required} placeholder={o.placeholder} defaultValue={o.value} autoFocus={i === 0} />
                      : o.type === "select" ? (
                        <select name={name} required={o.required} defaultValue="" autoFocus={i === 0}>
                          <option value="" disabled>{o.placeholder || "Select…"}</option>
                          {(o.options || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : o.type === "multi" ? (
                        <div className="checks">
                          {(o.options || []).map(([v, l]) => <label key={v} className="check"><input type="checkbox" name={name} value={v} /> {l}</label>)}
                          {!o.options?.length && <span className="muted">No options available.</span>}
                        </div>
                      ) : <input name={name} type={o.type || "text"} step={o.type === "number" ? "any" : undefined} required={o.required} placeholder={o.placeholder} defaultValue={o.value} autoFocus={i === 0} />}
                    {o.hint && <small>{o.hint}</small>}
                  </label>
                ))}
                {json !== undefined && (
                  <label className="full">
                    <span>Request body (JSON)</span>
                    <textarea name="__json" rows={5} className="mono" defaultValue={json} spellCheck={false} />
                    <small>The swagger doesn&apos;t document this body. {"{}"} works for the signed-in account; if the API needs more, its error will say which field.</small>
                  </label>
                )}
                {confirmWord && (
                  <label className="full">
                    <span>Type <code>{confirmWord}</code> to confirm</span>
                    <input name="__confirm" autoComplete="off" required />
                  </label>
                )}
              </div>
              {state.error && <p className="error" role="alert">{state.error}</p>}
              <footer>
                <button type="button" className="btn" onClick={close}>Cancel</button>
                <button className={danger ? "btn danger-solid" : "btn primary"} disabled={state.busy}>{state.busy ? "Working…" : submitLabel}</button>
              </footer>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

// ---- Shared visual primitives ----

// 24px stroke icons (feather-style). Add paths here rather than inlining SVGs in pages.
const ICON_PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  sales: <><path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.5L21 8H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
  billing: <><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  accounts: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a5 5 0 0 0-4-4.9" /></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h13v4" /><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z" /><circle cx="16" cy="14.5" r="1" /></>,
  projects: <><path d="M5 19c0-8 6-13 14-14-1 8-6 14-14 14z" /><path d="M5 19l7-7" /></>,
  rewards: <><circle cx="12" cy="9" r="6" /><path d="m8.5 14-1.5 8 5-3 5 3-1.5-8" /></>,
  inquiries: <><path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6A8 8 0 1 1 21 12z" /><path d="M8 11h8M8 14h5" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>,
  tools: <><path d="M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-2.3-2.3a4 4 0 0 0-5-5L2 10l8-8z" /></>,
  calc: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4" /></>,
  logs: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />,
  pin: <><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12 5 5L20 7" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 18l-6-6 6-6" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />,
  refresh: <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5" />,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  key: <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  pulse: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  server: <><rect x="3" y="3" width="18" height="7" rx="2" /><rect x="3" y="14" width="18" height="7" rx="2" /><path d="M7 6.5h.01M7 17.5h.01" /></>,
  leaf: <><path d="M5 19c0-8 6-13 14-14-1 8-6 14-14 14z" /><path d="M5 19l7-7" /></>,
  coin: <><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5c-.4-.9-1.4-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2.1-.6-2.5-1.5M12 6.5V8M12 16v1.5" /></>,
  flame: <path d="M12 22c4 0 7-2.7 7-7 0-5-5-7-4-12-3 2-5 4-6 7-1-1-1.5-2-1.5-3C5 9 5 12 5 15c0 4.3 3 7 7 7z" />,
  layers: <><path d="m12 2 10 5-10 5L2 7z" /><path d="m2 17 10 5 10-5M2 12l10 5 10-5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></>,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  external: <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
};
export const Icon = ({ name, size = 18, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICON_PATHS[name]}</svg>
);

// Standard page header: optional back link, icon tile, title, subtitle, actions on the right.
export function PageHead({ title, sub, icon, back, children }) {
  return (
    <header className="page-head">
      <div className="page-title">
        {back && <Link href={back[0]} className="back-link"><Icon name="back" size={14} /> {back[1]}</Link>}
        {title && (
          <div className="page-title-row">
            {icon && <span className="page-icon"><Icon name={icon} size={20} /></span>}
            <div>
              <h1>{title}</h1>
              {sub && <p className="muted">{sub}</p>}
            </div>
          </div>
        )}
      </div>
      {children && <div className="head-actions">{children}</div>}
    </header>
  );
}

// Initials on a colour picked from the name, so the same client always gets the same colour.
export function Avatar({ name = "?", size = 40 }) {
  const initials = String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return <span className="avatar-hue" style={{ "--h": h, width: size, height: size, fontSize: size * 0.36 }} aria-hidden>{initials}</span>;
}

// First value whose key matches `re` (e.g. pick(row, /^(name|title)$/i)).
export const pick = (o, re) => {
  const k = Object.keys(o || {}).find((key) => re.test(key) && o[key] != null && o[key] !== "");
  return k === undefined ? undefined : o[k];
};

export const toneOf = (v) => tone(String(v ?? ""));

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
export function ago(v) {
  const d = new Date(v);
  if (!v || isNaN(d)) return "";
  const s = (d - Date.now()) / 1000;
  for (const [unit, size] of [["year", 31536e3], ["month", 2592e3], ["day", 86400], ["hour", 3600], ["minute", 60]]) if (Math.abs(s) >= size) return rtf.format(Math.round(s / size), unit);
  return "just now";
}

// Chips that filter already-loaded rows by a status-like field. Values come from the rows themselves.
export function StatusChips({ rows, field, value, onChange }) {
  const counts = new Map();
  for (const r of rows) { const v = r[field]; if (v != null && v !== "") counts.set(String(v), (counts.get(String(v)) || 0) + 1); }
  if (counts.size < 2) return null;
  return (
    <div className="chip-bar" role="group" aria-label="Filter by status">
      <button className="fchip" aria-pressed={!value} onClick={() => onChange("")}>All <b>{rows.length}</b></button>
      {[...counts].map(([v, n]) => (
        <button key={v} className={`fchip ${tone(v)}`} aria-pressed={value === v} onClick={() => onChange(value === v ? "" : v)}>
          <i aria-hidden />{v} <b>{n}</b>
        </button>
      ))}
    </div>
  );
}

// Empty state with an icon, used instead of a bare "No records." line.
export const Empty = ({ icon = "inbox", title, children }) => (
  <div className="empty-state">
    <span className="empty-icon"><Icon name={icon} size={22} /></span>
    <strong>{title}</strong>
    {children && <p className="muted">{children}</p>}
  </div>
);

// "More" overflow menu built on <details>, so it needs no state and closes on outside click via the effect.
export function Menu({ label = "More", children }) {
  return (
    <details className="menu" onToggle={(e) => {
      const d = e.currentTarget;
      if (!d.open) return;
      const close = (ev) => { if (!d.contains(ev.target) || ev.target.closest(".menu-list > *")) { d.open = false; document.removeEventListener("click", close); } };
      setTimeout(() => document.addEventListener("click", close));
    }}>
      <summary className="btn" aria-label={label}><Icon name="more" size={16} /></summary>
      <div className="menu-list" role="menu">{children}</div>
    </details>
  );
}
