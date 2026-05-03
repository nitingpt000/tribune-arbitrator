import { Injectable } from '@nestjs/common';
import type { PanelVoteChoice } from '@prisma/client';

import { hashToFloat } from '../../common/hash';

const TEMPLATES_BY_CLAIM_TYPE: Record<string, Record<'REFUND' | 'REJECT', string[]>> = {
  service_not_delivered: {
    REFUND: [
      'The deliverable referenced in the SOW is not present in the on-chain receipt. The contract specifies a fixed-output deal; the producer\u2019s output does not satisfy the schema. Refund.',
      'Re-running the buyer\u2019s prompt against the seller\u2019s endpoint reproduces the missing output. The defect is reproducible and predates settlement.',
      'The seller\u2019s force-majeure defense is procedurally barred — written notice was not posted within the contractually required window.',
    ],
    REJECT: [
      'The buyer\u2019s acceptance criteria reference a metric the SOW does not bind. The deliverable matches every clause that was in fact agreed.',
      'Cross-checking the seller\u2019s output against the buyer\u2019s schema yields a passing result. The dispute relies on a metric outside the contract.',
      'Procedural review confirms the buyer accepted partial delivery in writing 24 hours before filing.',
    ],
  },
  sla_breach: {
    REFUND: [
      'Logs show 4 missed publication windows within the agreed 30-window span. The SLA caps misses at 1; pro-rata refund is owed.',
      'Latency-budget logs exceed the 250ms agreed ceiling on 12 of 30 reads. The defect is producer-side, not network-side.',
      'The producer\u2019s defense relies on an outdated SLA version. The current addendum supersedes it and was signed.',
    ],
    REJECT: [
      'The integrator\u2019s probe samples a window the SLA explicitly excludes (maintenance hour). The remaining windows hit at the agreed rate.',
      'The producer\u2019s logs reconcile with the buyer\u2019s — no missed windows. The complaint relies on a clock-drift artefact.',
      'Force-majeure was filed within the contractually required 1-hour window; the SLA suspension is in force for the disputed period.',
    ],
  },
  wrong_amount: {
    REFUND: [
      'The on-chain transfer overcharges by the documented delta. The receipt and invoice line items diverge on a single field.',
      'Block-explorer trace shows two transfers settled where the agreement specified one. The delta is owed back.',
      'The seller invoiced an amount that includes a premium not in the contract. The premium was added unilaterally.',
    ],
    REJECT: [
      'The buyer\u2019s reading of the trace double-counts a pending entry that was never confirmed. A single charge settled.',
      'The amount disputed reflects a fee the buyer agreed to in the signed price addendum.',
      'Wallet history shows two pending entries collapsing into one confirmed transfer. UI artefact, not a chain event.',
    ],
  },
  data_breach: {
    REFUND: [
      'The leaked dataset matches the buyer\u2019s exact CID. The vendor\u2019s key handling did not enforce the agreed access policy.',
      'Public mirror timestamps confirm the leak originated from the vendor\u2019s endpoint. Damages are recoverable per the data-handling clause.',
      'The vendor failed to revoke access at the agreed cadence; logs show a 47-hour window of accessibility post-termination.',
    ],
    REJECT: [
      'The dataset on the public mirror is reconstructable from already-public sources. Vendor exposure is not the proximate cause.',
      'The buyer\u2019s evidence does not establish chain-of-custody from the vendor to the leak.',
      'Access logs show the buyer\u2019s own key was used to fetch the dataset that later appeared on the mirror.',
    ],
  },
  misrepresentation: {
    REFUND: [
      'The advertised capability does not match the delivered output. The mismatch is on the face of the deliverable.',
      'Audit findings disclosed in the post-mortem were absent from the original report. Material omission triggers rescission.',
      'The seller misrepresented model provenance; the actual checkpoint differs from the announced one by 14 layers.',
    ],
    REJECT: [
      'The buyer\u2019s expectations exceed the model card. The card explicitly bounds capability claims to the delivered range.',
      'Findings disclosed in the post-mortem are out of scope for the original audit per the agreed scope statement.',
      'Provenance metadata matches the agreed checkpoint within the documented tolerance.',
    ],
  },
  other: {
    REFUND: [
      'The contract\u2019s acceptance criteria are not met on the face of the deliverable. The default remedy under the contract is refund.',
      'On-chain trace confirms the disputed transaction; the agreed condition for settlement is not satisfied.',
      'The respondent\u2019s defense does not engage the controlling clause. Refund is owed.',
    ],
    REJECT: [
      'Neither party\u2019s evidence establishes a breach of a binding clause. The default in the absence of breach is to leave settlement undisturbed.',
      'The cited clause is not binding under the agreed governing terms. The dispute is meritless.',
      'The respondent fully performed under the controlling clause; the claimant\u2019s reading is unsupported.',
    ],
  },
};

@Injectable()
export class ReasoningTemplateService {
  pickReasoning(
    disputeId: string,
    modelName: string,
    claimType: string,
    vote: Extract<PanelVoteChoice, 'REFUND' | 'REJECT'>,
  ): string {
    const family = TEMPLATES_BY_CLAIM_TYPE[claimType] ?? TEMPLATES_BY_CLAIM_TYPE['other'];
    if (!family) return 'Reasoning unavailable for this claim type.';
    const pool = family[vote];
    if (!pool || pool.length === 0) return 'Reasoning unavailable for this vote.';
    const idx = Math.floor(hashToFloat(`${disputeId}:${modelName}:reasoning`) * pool.length);
    return pool[Math.min(pool.length - 1, idx)] ?? pool[0]!;
  }

  pickConfidence(disputeId: string, modelName: string): number {
    const f = hashToFloat(`${disputeId}:${modelName}:confidence`);
    return Number((0.7 + f * 0.25).toFixed(2));
  }
}
