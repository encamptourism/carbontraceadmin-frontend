import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { post } from "@/lib/api";
import { Result } from "@/lib/ui";

// ponytail: only verify-claim's body is documented; the other claim calls are sent { claim_id, wallet_address, signedTxn } as relevant.
function Step({ n, title, desc, children, done }) {
  return (
    <div className={`claim-step${done ? " done" : ""}`}>
      <span className="step-n">{done ? "✓" : n}</span>
      <div className="step-body">
        <h3>{title}</h3>
        {desc && <p className="muted">{desc}</p>}
        {children}
      </div>
    </div>
  );
}

function Call({ label, run, onResult, disabled }) {
  const [s, setS] = useState({});
  async function go() {
    setS({ busy: true });
    try {
      const r = await run();
      setS({ result: r });
      onResult?.(r);
    } catch (e) {
      setS({ error: e.message });
    }
  }
  return (
    <div className="call">
      <button className="btn primary" onClick={go} disabled={disabled || s.busy}>{s.busy ? "Working…" : label}</button>
      {s.error && <p className="error" role="alert">{s.error}</p>}
      {s.result && <div className="call-result"><Result data={s.result} /></div>}
    </div>
  );
}

export default function Claim() {
  const { query } = useRouter();
  const [claimId, setClaimId] = useState(null);
  const [verified, setVerified] = useState(null);
  const [wallet, setWallet] = useState("");
  const [signed, setSigned] = useState("");
  const id = claimId ?? query.claim_id ?? "";

  return (
    <main className="public-shell">
      <Head><title>Claim rewards · CarbonTrace</title></Head>
      <div className="public-brand"><span className="logo" aria-hidden>●</span>CarbonTrace</div>
      <section className="card public-card wide">
        <h1>Claim your CTCoin rewards</h1>
        <p className="muted">Rewards earned from your carbon offsets, delivered to your Algorand wallet.</p>

        <Step n={1} title="Verify your claim" desc="Enter the claim ID from your reward email." done={!!verified}>
          <div className="inline-form">
            <input value={id} onChange={(e) => { setClaimId(e.target.value); setVerified(null); }} placeholder="Claim ID" aria-label="Claim ID" />
            <Call label="Verify" disabled={!id.trim()} run={() => post("/rewards/verify-claim", { claim_id: id.trim() })} onResult={setVerified} />
          </div>
        </Step>

        <Step n={2} title="Your wallet" desc="The Algorand address that should receive the CTCoins." done={!!wallet.trim() && !!verified}>
          <input className="wide-input mono" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Algorand address" aria-label="Wallet address" disabled={!verified} />
        </Step>

        <Step n={3} title="Opt in to CTCoins" desc="New wallets must opt in once. Create the transaction, sign it in your wallet app, and paste the signed version back.">
          <Call label="Create opt-in transaction" disabled={!verified || !wallet.trim()} run={() => post("/rewards/claim-optin-txn", { claim_id: id.trim(), wallet_address: wallet.trim() })} />
          <textarea className="wide-input mono" rows={3} value={signed} onChange={(e) => setSigned(e.target.value)} placeholder="Signed transaction (base64)" aria-label="Signed transaction" disabled={!verified} />
          <Call label="Submit signed opt-in" disabled={!verified || !signed.trim()} run={() => post("/rewards/claim-submit-optin", { claim_id: id.trim(), wallet_address: wallet.trim(), signedTxn: signed.trim() })} />
        </Step>

        <Step n={4} title="Claim" desc="Send your rewards to the wallet. If some were held back, settle them afterwards.">
          <div className="row-actions wrap">
            <Call label="Claim to wallet" disabled={!verified || !wallet.trim()} run={() => post("/rewards/claim-wallet-public", { claim_id: id.trim(), wallet_address: wallet.trim() })} />
            <Call label="Settle pending" disabled={!verified} run={() => post("/rewards/settle-pending-public", { claim_id: id.trim(), wallet_address: wallet.trim() || undefined })} />
          </div>
        </Step>
      </section>
    </main>
  );
}
