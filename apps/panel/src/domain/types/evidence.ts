export interface EvidenceFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageUri: string;
  inlineContent?: string;
}

export interface EvidenceBundle {
  disputeId: string;
  claimType: string;
  statement: string;
  claimantEns: string;
  respondentEns: string;
  txHash: string;
  amountUsdc: number;
  files: EvidenceFile[];
}
