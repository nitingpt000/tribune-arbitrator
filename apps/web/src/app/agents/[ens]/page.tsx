import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tribune/ui';

interface AgentPageProps {
  params: Promise<{ ens: string }>;
}

export default async function AgentPage({ params }: AgentPageProps): Promise<React.JSX.Element> {
  const { ens } = await params;
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{ens}</h1>
        <p className="text-muted-foreground">Agent reputation and arbitration history.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Reputation</CardTitle>
          <CardDescription>
            Reputation data will be fetched from the API once wired up.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </main>
  );
}
