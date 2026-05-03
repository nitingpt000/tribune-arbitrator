'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ClaimType, CreateDisputeInput, type ClaimType as ClaimTypeT } from '@tribune/types';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@tribune/ui';
import { ArrowLeft, FileText, Loader2, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';

import { PlainPill } from '@/components/status-pill';
import { Textarea } from '@/components/ui/textarea';
import { tribuneClient } from '@/lib/api/client';
import { useCreateDispute } from '@/lib/api/queries';
import { cn } from '@/lib/cn';
import { CLAIM_TYPE_LABELS } from '@/lib/dispute-helpers';
import { formatBytes } from '@/lib/format';

const formSchema = CreateDisputeInput;
type FormValues = typeof formSchema._type;

interface PendingEvidence {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

const SAMPLE_EVIDENCE_TEMPLATES: Array<{ filename: string; sizeBytes: number; mimeType: string }> =
  [
    { filename: 'sow-v3.pdf', sizeBytes: 184_320, mimeType: 'application/pdf' },
    { filename: 'transaction-trace.json', sizeBytes: 22_140, mimeType: 'application/json' },
    { filename: 'expected-vs-actual.md', sizeBytes: 8_120, mimeType: 'text/markdown' },
    { filename: 'incident-postmortem.md', sizeBytes: 18_410, mimeType: 'text/markdown' },
    { filename: 'feed-uptime.csv', sizeBytes: 12_290, mimeType: 'text/csv' },
  ];

export default function NewDisputePage(): React.JSX.Element {
  const router = useRouter();
  const createDispute = useCreateDispute();

  const [evidence, setEvidence] = useState<PendingEvidence[]>(() => [
    { id: 'ev-1', filename: 'sow-v3.pdf', sizeBytes: 184_320, mimeType: 'application/pdf' },
    {
      id: 'ev-2',
      filename: 'output-trace.json',
      sizeBytes: 41_900,
      mimeType: 'application/json',
    },
  ]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      claimantEns: 'buyer.verdikt.eth',
      respondentEns: 'seller.verdikt.eth',
      claimType: 'service_not_delivered',
      txHash: '0xa83f1e4b0c9d2f5e8a1b6c7d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f607',
      amountUsdc: 1250,
      statement:
        'Forecast endpoint returned 3 daily entries; SOW article 2 requires a 7-entry array. Refund requested.',
    },
  });

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const dispute = await createDispute.mutateAsync(values);
    if (evidence.length) {
      await Promise.all(
        evidence.map((e) =>
          tribuneClient.addEvidence(dispute.id, {
            filename: e.filename,
            sizeBytes: e.sizeBytes,
            mimeType: e.mimeType,
          }),
        ),
      ).catch(() => undefined);
    }
    toast.success('Filed. Panel convening…');
    router.push(`/disputes/${dispute.id}/live`);
  };

  function addSampleEvidence(): void {
    const remaining = SAMPLE_EVIDENCE_TEMPLATES.filter(
      (s) => !evidence.some((e) => e.filename === s.filename),
    );
    const next = remaining[0];
    if (!next) return;
    setEvidence((prev) => [
      ...prev,
      {
        id: `ev-${prev.length + 1}`,
        filename: next.filename,
        sizeBytes: next.sizeBytes,
        mimeType: next.mimeType,
      },
    ]);
  }

  function removeEvidence(id: string): void {
    setEvidence((prev) => prev.filter((e) => e.id !== id));
  }

  const claimType = watch('claimType');
  const submitting = isSubmitting || createDispute.isPending;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-10">
      <Link
        href="/disputes"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to ledger
      </Link>

      <header className="mb-8 flex flex-col gap-2">
        <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
          File a dispute
        </span>
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.02em] text-foreground">
          Provide the disputed transaction and your evidence.
        </h1>
        <p className="text-sm text-muted-foreground">
          Once filed, a panel of three LLM jurors will convene and rule within ~60 seconds.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <Card className="border-border bg-surface">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base">Parties</CardTitle>
            <CardDescription>ENS-named agents on either side of the dispute.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="Claimant" error={errors.claimantEns?.message} htmlFor="claimantEns">
              <Input
                id="claimantEns"
                className="font-mono"
                placeholder="buyer.verdikt.eth"
                {...register('claimantEns')}
              />
            </Field>
            <Field label="Respondent" error={errors.respondentEns?.message} htmlFor="respondentEns">
              <Input
                id="respondentEns"
                className="font-mono"
                placeholder="seller.verdikt.eth"
                {...register('respondentEns')}
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base">Transaction</CardTitle>
            <CardDescription>The on-chain payment that anchors this dispute.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 p-5">
            <Field label="Transaction hash" error={errors.txHash?.message} htmlFor="txHash">
              <Input id="txHash" className="font-mono text-xs" {...register('txHash')} />
            </Field>
            <Field
              label="Amount in dispute · USDC"
              error={errors.amountUsdc?.message}
              htmlFor="amountUsdc"
            >
              <Input
                id="amountUsdc"
                type="number"
                step="0.01"
                className="font-mono"
                placeholder="1250"
                {...register('amountUsdc', { valueAsNumber: true })}
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base">Claim</CardTitle>
            <CardDescription>What is the basis of this dispute?</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-5">
            <Field label="Claim type" htmlFor="claimType">
              <div className="flex flex-wrap gap-2">
                {ClaimType.options.map((key) => {
                  const active = claimType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setValue('claimType', key as ClaimTypeT, { shouldDirty: true })
                      }
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        active
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
                      )}
                    >
                      {CLAIM_TYPE_LABELS[key] ?? key}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Statement" error={errors.statement?.message} htmlFor="statement">
              <Textarea id="statement" rows={4} {...register('statement')} />
            </Field>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardHeader className="flex-row items-center justify-between border-b border-border">
            <div>
              <CardTitle className="text-base">Evidence</CardTitle>
              <CardDescription>
                Files are anchored to 0G Storage; only their CIDs are written on chain.
              </CardDescription>
            </div>
            <PlainPill tone="info">{evidence.length} attached</PlainPill>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-5">
            <ul className="flex flex-col gap-2">
              {evidence.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-md border border-border bg-surface text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{e.filename}</p>
                      <p className="truncate font-mono text-[0.72rem] text-muted-foreground">
                        {formatBytes(e.sizeBytes)} · 0G Storage (mock)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEvidence(e.id)}
                    aria-label={`Remove ${e.filename}`}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={addSampleEvidence}
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-border bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Attach sample evidence
            </button>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
          <p className="text-xs text-muted-foreground">
            By filing, you authorise Tribune to convene a 3-of-3 panel and bind the verdict on
            chain.
          </p>
          <Button type="submit" disabled={submitting} className="min-w-32">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Filing…
              </>
            ) : (
              'File dispute'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
