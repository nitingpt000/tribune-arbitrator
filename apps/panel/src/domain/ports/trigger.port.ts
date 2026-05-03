import type { EvidenceBundle } from '../types/evidence';

export interface TriggerHandler {
  handle(input: { disputeId: string; evidenceBundle: EvidenceBundle }): Promise<void>;
}
