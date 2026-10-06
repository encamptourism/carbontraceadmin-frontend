import Head from "next/head";
import { Card, FormDialog, Icon, PageHead, Tiles, useApi } from "@/lib/ui";

function Action({ n, icon, title, desc, danger, children }) {
  return (
    <div className={`action${danger ? " danger" : ""}`}>
      <div className="action-top">
        <span className="stat-icon"><Icon name={icon} size={17} /></span>
        {n && <span className="action-n">Step {n}</span>}
      </div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <div className="row-actions wrap">{children}</div>
    </div>
  );
}

export default function Rewards() {
  const balance = useApi("/rewards/balance");
  return (
    <>
      <Head><title>Rewards · CarbonTrace</title></Head>
      <PageHead title="Rewards & redemption" sub="CTCoin reward engine, claims and token redemption" icon="rewards">
        <button className="btn" onClick={balance.reload}><Icon name="refresh" size={14} /> Refresh</button>
      </PageHead>

      <Card title="Reward balance" icon="coin" state={balance} className="reward-balance">
        <Tiles data={balance.data} />
      </Card>

      <h2 className="section-title">Reward engine</h2>
      <div className="action-grid flow">
        <Action n={1} icon="flame" title="Initialize rewards" desc="Set up the rewards engine for a client account so sales start earning CTCoins.">
          <FormDialog label="Initialize" title="Initialize client rewards engine" path="/rewards/initialize" json="{}" submitLabel="Initialize" showResult onDone={balance.reload} />
        </Action>
        <Action n={2} icon="wallet" title="Claim to wallet" desc="Move earned rewards to the connected wallet. The wallet must be opted in to CTCoins.">
          <FormDialog label="Claim" title="Claim rewards to connected wallet" path="/rewards/claim-wallet" json="{}" submitLabel="Claim" showResult onDone={balance.reload} />
        </Action>
        <Action n={3} icon="layers" title="Settle pending" desc="Distribute rewards that are waiting (e.g. on an opt-in or a failed transfer).">
          <FormDialog label="Settle" title="Settle pending client rewards" path="/rewards/settle-pending" json="{}" submitLabel="Settle" showResult onDone={balance.reload} />
        </Action>
      </div>

      <h2 className="section-title">Redemption</h2>
      <div className="action-grid">
        <Action icon="check" title="Check eligibility" desc="Whether a client can redeem CTCoins right now.">
          <FormDialog label="Check" title="Check redemption eligibility" path="/redeem/eligibility" json="{}" submitLabel="Check" showResult className="btn" />
        </Action>
        <Action icon="calc" title="Preview & calculate" desc="See what a redemption would yield before running it.">
          <FormDialog label="Preview" title="Preview token redemption" path="/redeem/preview" json="{}" submitLabel="Preview" showResult className="btn" />
          <FormDialog label="Calculate" title="Calculate token/reward redemption" path="/redeem/calc" json="{}" submitLabel="Calculate" showResult className="btn" />
        </Action>
        <Action icon="alert" title="Redeem CTCoins" desc="Redeem tokens against carbon credits. This spends tokens on-chain and can’t be reversed." danger>
          <FormDialog
            label="Redeem"
            title="Redeem CTCoins"
            note="Redemption spends CTCoins on the blockchain and cannot be reversed."
            path="/redeem-ctcoins"
            json="{}"
            submitLabel="Redeem"
            danger
            confirmWord="REDEEM"
            showResult
            onDone={balance.reload}
          />
        </Action>
      </div>
    </>
  );
}
