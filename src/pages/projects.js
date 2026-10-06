import Head from "next/head";
import { useState } from "react";
import { Card, findArray, fmt, humanize, PageHead, Tabs, useApi, ViewDialog } from "@/lib/ui";

const TABS = [["All", "/projects/details"], ["Active", "/projects/active"], ["Available", "/projects/available"]];

// Field names vary (project_type_name / projectTypeName / …), so look keys up loosely.
const norm = (k) => k.toLowerCase().replace(/[^a-z]/g, "");
const pick = (p, ...names) => {
  const want = names.map(norm);
  const hit = Object.keys(p).find((k) => want.includes(norm(k)));
  return hit === undefined ? undefined : p[hit];
};
const FIELDS = {
  id: ["project_id", "projectId", "_id", "id"],
  desc: ["project_description", "description"],
  type: ["project_type_name", "project_type", "type"],
  category: ["project_category_name", "project_category", "category"],
  contact: ["authorized_project_contact", "contact"],
  map: ["project_location", "map_url", "maps"],
  balance: ["availablebalance", "available_balance", "available_credits"],
  address: ["location", "address", "project_address", "state"],
};
const KNOWN = new Set(Object.values(FIELDS).flat().concat("name", "__v").map(norm));

const TYPES = [
  [/solar|pv\b/i, "Solar"], [/wind/i, "Wind"], [/hydro/i, "Hydro"],
  [/biomass|biogas/i, "Biomass"], [/forest|refor|afforest/i, "Forestry"],
];

const ICONS = {
  Solar: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  Wind: <path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" />,
  Hydro: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  Biomass: <path d="M5 19c0-8 6-13 14-14-1 8-6 14-14 14zM5 19l7-7" />,
  Forestry: <path d="M12 3 6 11h3l-4 6h14l-4-6h3zM12 17v4" />,
  Project: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12h8M12 8v8" /></>,
};
const Icon = ({ type, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[type]}</svg>
);

const initials = (s) => s.split(/\s+/).filter((w) => /^[a-z]/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const isUrl = (v) => typeof v === "string" && /^https:\/\//.test(v);

function ProjectCard({ p }) {
  const [open, setOpen] = useState(false);
  const get = (f) => pick(p, ...FIELDS[f]);
  const typeText = get("type") || "";
  const type = TYPES.find(([re]) => re.test(`${typeText} ${p.name}`))?.[1] || "Project";
  const desc = get("desc") || "";
  const address = [get("address")].find((v) => typeof v === "string" && !isUrl(v)) || p.name?.match(/(?: - | in )([^-]+)$/)?.[1];
  const map = [get("map")].find(isUrl);
  const balance = get("balance");
  const contact = get("contact");
  const category = get("category");
  const showType = typeText && !new RegExp(`^${type}$`, "i").test(typeText);
  const extra = Object.entries(p).filter(([k, v]) => !KNOWN.has(norm(k)) && v !== null && v !== "" && typeof v !== "object");

  return (
    <article className={`project t-${type.toLowerCase()}`}>
      <div className="project-cover">
        <span className="type-badge"><Icon type={type} size={14} />{type}</span>
        {get("id") != null && <span className="project-id">#{get("id")}</span>}
        <span className="cover-icon"><Icon type={type} size={80} /></span>
      </div>

      <div className="project-body">
        <h3>{p.name || "Untitled project"}</h3>
        {address && (
          <p className="project-place">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>
            {address}
          </p>
        )}

        {(showType || category) && (
          <div className="chips">
            {showType && <span className="chip" title={`Project type: ${typeText}`}>{typeText}</span>}
            {category && <span className="chip" title="Category">{category}</span>}
          </div>
        )}

        {balance != null && (
          <div className="project-stats">
            <span>Available credits</span>
            <strong>{fmt(Number(balance))}</strong>
          </div>
        )}

        {desc && (
          <div className="project-desc-wrap">
            <p className={open ? "project-desc" : "project-desc clamp"}>{desc}</p>
            {desc.length > 180 && <button className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Show less" : "Show more"}</button>}
          </div>
        )}

        {extra.length > 0 && (
          <details className="project-extra">
            <summary>More details</summary>
            <dl>{extra.map(([k, v]) => <div key={k}><dt>{humanize(k)}</dt><dd>{fmt(v)}</dd></div>)}</dl>
          </details>
        )}
      </div>

      {(contact || map || get("id") != null) && (
        <footer className="project-foot">
          {contact ? (
            <div className="contact">
              <span className="avatar" aria-hidden>{initials(contact)}</span>
              <div><span>Authorized contact</span><strong>{contact}</strong></div>
            </div>
          ) : <span />}
          <div className="row-actions">
          {get("id") != null && <ViewDialog label="Details" title={p.name} path={`/projects/${encodeURIComponent(get("id"))}/details`} />}
          {map && (
            <a className="btn map-btn" href={map} target="_blank" rel="noopener noreferrer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" /></svg>
              Map
            </a>
          )}
          </div>
        </footer>
      )}
    </article>
  );
}

export default function Projects() {
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState("");
  const list = useApi(TABS[tab][1]);
  const all = findArray(list.data);
  const shown = q ? all.filter((p) => JSON.stringify(Object.values(p)).toLowerCase().includes(q.toLowerCase())) : all;

  return (
    <>
      <Head><title>Projects · CarbonTrace</title></Head>
      <PageHead title="Projects" sub="Carbon offset projects available to clients" icon="projects">
        <input className="search" type="search" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
      </PageHead>
      <Tabs tabs={TABS.map(([l]) => l)} value={tab} onChange={setTab} />
      {list.loading || list.error ? (
        <Card title="Projects" state={list} />
      ) : shown.length ? (
        <>
          <p className="muted result-count">{shown.length} {shown.length === 1 ? "project" : "projects"}{q && ` matching “${q}”`}</p>
          <div className="project-grid">{shown.map((p, i) => <ProjectCard key={pick(p, ...FIELDS.id) ?? i} p={p} />)}</div>
        </>
      ) : (
        <section className="card"><p className="empty">{q ? `No projects match “${q}”.` : "No projects."}</p></section>
      )}
    </>
  );
}
