import Head from "next/head";
import { useRouter } from "next/router";
import { ActionButton, Card, DataTable, KeyValues, PageHead, humanize, useApi } from "@/lib/ui";

export default function Lot() {
  const { lotId, sale_order_id } = useRouter().query;
  const id = lotId && encodeURIComponent(lotId);
  const lot = useApi(id && `/lots/${id}`, sale_order_id ? { sale_order_id } : undefined);
  // Every array in the response (sales, retry logs, …) gets its own table.
  const lists = Object.entries(lot.data || {}).filter(([, v]) => Array.isArray(v) && v.length);

  return (
    <>
      <Head><title>UCR lot · CarbonTrace</title></Head>
      <PageHead title={`UCR lot`} sub={lotId} icon="layers" back={["/sales?tab=3", "Failed UCR"]} />
      <Card title="Lot details" icon="layers" state={lot} actions={id && <ActionButton label="Retry lot" path={`/ucr/failed-lots/${id}/retry`} confirm="Retry this UCR lot?" onDone={lot.reload} />}>
        <KeyValues data={lot.data} />
      </Card>
      {lists.map(([k, rows]) => (
        <Card key={k} title={humanize(k)} icon="list" state={lot}><DataTable rows={rows} /></Card>
      ))}
    </>
  );
}
