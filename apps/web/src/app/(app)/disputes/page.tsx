import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tribune/ui';

export default function DisputesPage(): React.JSX.Element {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Disputes</h1>
        <p className="text-muted-foreground">
          A list of disputes filed against the Tribune arbitrator.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>No disputes yet</CardTitle>
          <CardDescription>
            This is a placeholder. The dispute index will be wired to the API.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </main>
  );
}
