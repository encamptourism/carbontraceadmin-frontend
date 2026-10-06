import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { api } from "@/lib/api";
import { ActionButton, Avatar, Card, DataTable, Icon, PageHead, Skeleton, Tabs, Tiles, findArray, pick, useApi } from "@/lib/ui";

const FIELDS = [["name", "Name", "text", "accounts"], ["email", "Email", "email", "mail"], ["location", "Location", "text", "pin"], ["contactNumber", "Contact number", "tel", "phone"]];

function EditClient({ id, client, onSaved }) {
  const [msg, setMsg] = useState({});
  async function save(e) {
    e.preventDefault();
    // Only send filled fields, so a blank password doesn't overwrite the real one.
    const body = Object.fromEntries([...new FormData(e.target)].filter(([, v]) => v));
    setMsg({ text: "Saving…" });
    try {
      await api(`/clients/${id}`, null, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setMsg({ text: "Saved", ok: true });
      onSaved();
    } catch (err) {
      setMsg({ text: `Failed: ${err.message}`, bad: true });
    }
  }
  return (
    <form className="edit-form" onSubmit={save}>
      {FIELDS.map(([name, label, type, icon]) => (
        <label key={name}>
          <span>{label}</span>
          <span className="input-icon"><Icon name={icon} size={15} /><input name={name} type={type} defaultValue={client[name] ?? ""} /></span>
        </label>
      ))}
      <label>
        <span>New password</span>
        <span className="input-icon"><Icon name="key" size={15} /><input name="password" type="password" autoComplete="new-password" placeholder="Leave blank to keep" /></span>
      </label>
      <div className="form-foot">
        <button className="btn primary">Save changes</button>
        {msg.text && <span className={`save-msg${msg.ok ? " ok" : msg.bad ? " bad" : ""}`} role="status">{msg.ok && <Icon name="check" size={14} />} {msg.text}</span>}
      </div>
    </form>
  );
}

export default function Client() {
  const router = useRouter();
  const { clientId } = router.query;
  const id = clientId && encodeURIComponent(clientId);
  const [tab, setTab] = useState(0);
  const summary = useApi(id && `/accounts/clients/${id}/summary`);
  const ledger = useApi(id && `/accounts/clients/${id}/billing-ledger`);
  const sales = useApi(id && `/salesRegisters/client/${id}`);
  const client = summary.data?.client || summary.data || {};
  const name = client.name || "Client";
  const contacts = [["mail", pick(client, /email/i)], ["phone", pick(client, /contact|phone/i)], ["pin", pick(client, /location|city/i)]].filter(([, v]) => v);

  return (
    <>
      <Head><title>{name} · CarbonTrace</title></Head>
      <PageHead title="" back={["/accounts", "Accounts"]} />

      <section className="profile-hero">
        {summary.loading ? <Skeleton lines={2} /> : (
          <>
            <Avatar name={name} size={64} />
            <div className="profile-main">
              <h1>{name}</h1>
              <div className="profile-contacts">
                {contacts.map(([icon, v]) => <span key={icon}><Icon name={icon} size={14} />{v}</span>)}
              </div>
            </div>
            <div className="head-actions">
              <a className="btn" href={`/api/v1/accounts/clients/${id}/billing-ledger/export`}><Icon name="download" size={14} /> Ledger (Excel)</a>
            </div>
          </>
        )}
      </section>

      <Card title="Summary" icon="pulse" state={summary}><Tiles data={summary.data} /></Card>

      <Tabs tabs={["Profile", "Billing ledger", "Sales registers"]} value={tab} onChange={setTab} />
      {tab === 0 && (
        <>
          <Card title="Profile" icon="accounts" state={summary}>
            <EditClient key={client._id || id} id={id} client={client} onSaved={summary.reload} />
          </Card>
          {id && (
            <section className="card danger-zone">
              <div className="card-head"><h2><Icon name="alert" size={16} />Danger zone</h2></div>
              <div className="danger-row">
                <div><strong>Regenerate API token</strong><p className="muted">The client’s current integration stops working until they update the token.</p></div>
                <ActionButton
                  label="Regenerate"
                  path={`/clients/${id}/regenerate-token`}
                  confirm="Regenerate this client's API secret? Their current integration will stop working until updated."
                  onDone={(r) => window.prompt("New API token (copy it now):", r?.token || r?.apiToken || r?.secret || JSON.stringify(r))}
                />
              </div>
              <div className="danger-row">
                <div><strong>Delete client</strong><p className="muted">Permanently removes {name} and cannot be undone.</p></div>
                <ActionButton label="Delete" method="DELETE" path={`/clients/${id}`} confirm={`Permanently delete ${name}? This cannot be undone.`} onDone={() => router.replace("/accounts")} />
              </div>
            </section>
          )}
        </>
      )}
      {tab === 1 && (
        <Card title="Billing ledger" icon="billing" state={ledger}>
          <DataTable rows={findArray(ledger.data)} empty="No ledger entries." />
        </Card>
      )}
      {tab === 2 && (
        <Card title="Sales registers" icon="sales" state={sales}>
          <DataTable rows={findArray(sales.data)} empty="No sales." />
        </Card>
      )}
    </>
  );
}
