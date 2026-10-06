import Head from "next/head";
import { useState } from "react";
import { CountUp, ErrorNote, Skeleton, Card, DataTable, findArray, fmt, FormDialog, KeyValues, PageHead, rowId, useApi, ViewDialog } from "@/lib/ui";

const n = (v) => (v == null ? null : Number(v));
const algos = (o) => (o?.algos != null ? n(o.algos) : o?.microAlgos != null ? n(o.microAlgos) / 1e6 : null);

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      window.prompt("Copy the address:", text);
    }
  }
  return (
    <button className="copy-btn" onClick={copy} aria-label="Copy address">
      {done ? "Copied ✓" : "Copy"}
    </button>
  );
}

export function WalletCard({ balance, details, children }) {
  const w = details?.wallet || details || {};
  const algo = algos(balance?.algo) ?? algos(w.balances?.chain);
  const micro = balance?.algo?.microAlgos ?? w.balances?.chain?.microAlgos;
  return (
    <section className="wallet-hero">
      <div className="wallet-hero-top">
        <span className="wallet-chip">{w.source ? `${w.source[0].toUpperCase()}${w.source.slice(1)} wallet` : "Wallet"}</span>
        <span className="wallet-net">Algorand</span>
      </div>
      <div className="wallet-balance">
        <span>ALGO balance</span>
        <strong title={micro != null ? `${fmt(n(micro))} microAlgos` : undefined}>
          {algo != null ? <CountUp value={algo} format={(x) => x.toLocaleString("en-IN", { maximumFractionDigits: 6 })} /> : "—"}<small> ALGO</small>
        </strong>
      </div>
      {children}
      {w.address && (
        <div className="wallet-address">
          <code title={w.address}>{w.address}</code>
          <CopyButton text={w.address} />
        </div>
      )}
    </section>
  );
}

function CoinCard({ ct }) {
  const supply = n(ct.totalSupply), treasury = n(ct.treasuryBalance), dist = n(ct.distributed);
  const share = supply ? (dist ?? supply - treasury) / supply : null;
  return (
    <section className="card coin-card">
      <div className="card-head">
        <h2>CTCoins</h2>
        {ct.asaId != null && <span className="asa-id" title="Algorand Standard Asset ID">ASA {ct.asaId}</span>}
      </div>
      <div className="metric big">
        <span>Treasury balance</span>
        <strong>{fmt(treasury)}<small> CTC</small></strong>
      </div>
      {share != null && (
        <div className="dist">
          <div className="dist-bar" role="img" aria-label={`${(share * 100).toFixed(2)}% of supply distributed`}>
            <i style={{ width: `${Math.max(share * 100, share > 0 ? 1 : 0)}%` }} />
          </div>
          <span className="muted">{share * 100 < 0.01 && share > 0 ? "<0.01" : (share * 100).toFixed(2)}% of supply distributed</span>
        </div>
      )}
      <div className="metric-row">
        <div className="metric"><span>Total supply</span><strong>{fmt(supply)}</strong></div>
        <div className="metric"><span>Distributed</span><strong>{fmt(dist)}</strong></div>
      </div>
      {ct.asaId != null && (
        <div className="row-actions wrap">
          <ViewDialog label="Asset details" title={`ASA ${ct.asaId}`} path={`/asset/${ct.asaId}`} />
          <ViewDialog label="Expiry status" title="Asset expiry status" path={`/asset/${ct.asaId}/expiry-status`} />
          <ViewDialog label="Metadata" title="ASA metadata" path={`/backend/wallet/asset-meta/${ct.asaId}`} />
        </div>
      )}
    </section>
  );
}

function Action({ title, children, desc }) {
  return (
    <div className="action">
      <h3>{title}</h3>
      <p>{desc}</p>
      <div className="row-actions">{children}</div>
    </div>
  );
}

function Operations({ onChange }) {
  return (
    <div className="action-grid">
      <Action title="Connect wallet" desc="Link an existing Algorand address to this profile.">
        <FormDialog
          label="Connect"
          title="Connect existing wallet"
          path="/connect-wallet"
          submitLabel="Connect"
          showResult
          onDone={onChange}
          fields={[["wallet_address", "Wallet address", { required: true, full: true, placeholder: "K27…" }]]}
        />
      </Action>

      <Action title="Live wallet session" desc="Start a signing session with a mobile wallet, then check whether it is connected.">
        <FormDialog label="Create session" title="Create live wallet session" path="/wallet/create-session" json="{}" submitLabel="Create" showResult />
        <ViewDialog label="Status" title="Wallet session status" path="/wallet/session-status" />
      </Action>

      <Action title="CTCoins opt-in" desc="An account must opt in to the CTCoins asset before it can receive rewards. Generate the transaction, sign it in your wallet, then submit it.">
        <FormDialog label="1 · Generate txn" title="Create unsigned opt-in transaction" path="/wallet/optin-txn" json="{}" submitLabel="Generate" showResult className="btn" />
        <FormDialog
          label="2 · Submit signed"
          className="btn"
          title="Submit signed opt-in transaction"
          path="/wallet/submit-optin"
          submitLabel="Submit"
          showResult
          onDone={onChange}
          fields={[["signedTxn", "Signed transaction (base64)", { type: "textarea", required: true, rows: 5 }]]}
        />
        <FormDialog label="3 · Retry rewards" title="Retry reward distribution after opt-in" path="/wallet/retry-rewards" json="{}" submitLabel="Retry" showResult onDone={onChange} className="btn" />
      </Action>

      <Action title="Transfer CTCoins" desc="Send CTCoins from the treasury to an address. On-chain and irreversible.">
        <FormDialog
          label="Transfer"
          title="Transfer CTCoins"
          note="This sends tokens on the Algorand blockchain. It cannot be undone — double-check the address."
          path="/transfer-ctcoins"
          submitLabel="Send CTCoins"
          danger
          confirmWord="TRANSFER"
          showResult
          onDone={onChange}
          fields={[
            ["receiver_address", "Receiver address", { required: true, full: true }],
            ["amount", "Amount (CTC)", { type: "number", required: true }],
          ]}
        />
      </Action>

      <Action title="New wallet account" desc="Generate a new Algorand account. If the response includes a mnemonic, store it safely — it is shown once.">
        <FormDialog
          label="Create account"
          title="Create new Algorand account"
          note="Creates a new on-chain account. Any secret key or mnemonic in the response is shown only once."
          path="/createAccount"
          json="{}"
          submitLabel="Create account"
          danger
          confirmWord="CREATE"
          showResult
        />
      </Action>

      <Action title="Create CTCoins asset" desc="Mint the CTCoins ASA. Normally done once per network — only use when setting up a new deployment.">
        <FormDialog
          label="Create ASA"
          title="Create CTCoins ASA"
          note="Mints a new Algorand Standard Asset. Doing this again creates a second, separate token."
          path="/create-ctcoins"
          json="{}"
          submitLabel="Create asset"
          danger
          confirmWord="CREATE ASSET"
          showResult
          onDone={onChange}
        />
      </Action>
    </div>
  );
}

export default function Wallet() {
  const balance = useApi("/wallet-balance");
  const details = useApi("/getwalletdetails");
  const txns = useApi("/wallet-transactions");
  const rows = findArray(txns.data);
  const ct = balance.data?.ctCoins;
  const ready = !balance.loading && !details.loading;
  const known = balance.data?.algo || ct || details.data?.wallet;

  return (
    <>
      <Head><title>Wallet · CarbonTrace</title></Head>
      <PageHead title="Wallet" sub="Treasury wallet and CTCoins token on Algorand" icon="wallet" />

      {!ready ? <section className="card"><Skeleton lines={4} /></section>
        : balance.error && details.error ? <section className="card"><ErrorNote>{balance.error}</ErrorNote></section>
        : known ? (
          <div className="wallet-grid">
            <WalletCard balance={balance.data} details={details.data} />
            {ct && <CoinCard ct={ct} />}
          </div>
        ) : (
          <Card title="Wallet" state={{}}><KeyValues data={{ ...balance.data, ...details.data }} empty="No wallet connected." /></Card>
        )}

      <h2 className="section-title">Operations</h2>
      <Operations onChange={() => { balance.reload(); details.reload(); txns.reload(); }} />

      <Card title="Transactions" state={txns} actions={rows.length > 0 && <span className="muted">{rows.length} total</span>}>
        {rows.length ? (
          <DataTable
            rows={rows}
            action={(r) => {
              const txId = r.txId || r.tx_id || r.transactionId || r.transaction_id || rowId(r);
              return <ViewDialog label="Details" title="Transaction metadata & IPFS" path={`/wallet-transactions/${encodeURIComponent(txId)}/metadata`} />;
            }}
          />
        ) : (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h11l-3-3M17 17H6l3 3" /></svg>
            </span>
            <strong>No transactions yet</strong>
            <p className="muted">Reward distributions and transfers from this wallet will appear here.</p>
          </div>
        )}
      </Card>
    </>
  );
}
