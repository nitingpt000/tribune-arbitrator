import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tribune/ui';
import Link from 'next/link';

import { WalletConnect } from '@/components/wallet-connect';
import { cn } from '@/lib/cn';

export default function HomePage(): React.JSX.Element {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-16">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Tribune
          </Link>
          <WalletConnect />
        </header>

        <section className="flex flex-col gap-6">
          <Badge variant="outline" className="self-start">
            ERC-792 · 0G Chain
          </Badge>
          <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
            AI arbitration for onchain disputes.
          </h1>
          <p className="max-w-2xl text-pretty text-lg text-muted-foreground">
            Tribune is an ERC-792-compatible arbitrator powered by an agent panel. File disputes,
            submit evidence, and let a deterministic panel of agents reach a verdict.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/disputes" className={cn(buttonVariants())}>
              Browse disputes
            </Link>
            <Link href="/agents/tribune.eth" className={cn(buttonVariants({ variant: 'outline' }))}>
              View an agent
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>File a dispute</CardTitle>
              <CardDescription>
                Submit an ERC-792 dispute from any arbitrable contract.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Coming soon.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Submit evidence</CardTitle>
              <CardDescription>Attach IPFS-anchored evidence with a content hash.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Coming soon.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Inspect agents</CardTitle>
              <CardDescription>Review an agent&apos;s arbitration history by ENS.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Coming soon.</CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
