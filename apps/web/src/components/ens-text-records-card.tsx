import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tribune/ui';

interface EnsTextRecordsCardProps {
  ens: string;
  records: Array<{ key: string; value: string }>;
}

export function EnsTextRecordsCard({ ens, records }: EnsTextRecordsCardProps): React.JSX.Element {
  return (
    <Card className="overflow-hidden border-border bg-surface">
      <CardHeader className="border-b border-border bg-surface-2/50">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="font-mono text-base tracking-tight">{ens}</CardTitle>
            <CardDescription className="text-xs">ENS text records (raw)</CardDescription>
          </div>
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
            resolver · public
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <dl className="divide-y divide-border">
          {records.map((r) => (
            <div
              key={r.key}
              className="grid grid-cols-[minmax(8rem,1fr)_2fr] items-center gap-4 px-5 py-3"
            >
              <dt className="font-mono text-[0.78rem] text-muted-foreground">{r.key}</dt>
              <dd className="truncate font-mono text-[0.82rem] text-foreground">{r.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
