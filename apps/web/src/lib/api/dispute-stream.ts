'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { DisputeStreamEvent } from '@tribune/types';
import { useEffect, useState } from 'react';

import { tribuneClient } from './client';
import { disputeKeys } from './queries';

const TERMINAL_STATUSES = new Set(['SETTLED', 'REJECTED']);

interface UseDisputeStreamState {
  connected: boolean;
  lastEvent: DisputeStreamEvent | null;
  error: Event | null;
}

export function useDisputeStream(disputeId: string | undefined): UseDisputeStreamState {
  const qc = useQueryClient();
  const [state, setState] = useState<UseDisputeStreamState>({
    connected: false,
    lastEvent: null,
    error: null,
  });

  useEffect(() => {
    if (!disputeId) return;
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    const url = tribuneClient.streamUrl(disputeId);
    const source = new EventSource(url);
    let closedByTerminalState = false;

    const onMessage = (event: MessageEvent<string>): void => {
      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (typeof payload !== 'object' || payload === null || !('type' in payload)) {
        return;
      }
      const next = payload as DisputeStreamEvent;
      setState((prev) => ({ ...prev, lastEvent: next }));

      qc.invalidateQueries({ queryKey: disputeKeys.detail(disputeId) });
      qc.invalidateQueries({ queryKey: disputeKeys.all });

      if (next.type === 'dispute.status' && TERMINAL_STATUSES.has(next.status)) {
        closedByTerminalState = true;
        source.close();
        setState((prev) => ({ ...prev, connected: false }));
      }
    };

    const onOpen = (): void => setState((prev) => ({ ...prev, connected: true, error: null }));
    const onError = (err: Event): void => {
      if (closedByTerminalState) return;
      setState((prev) => ({ ...prev, connected: false, error: err }));
    };

    source.addEventListener('message', onMessage);
    source.addEventListener('open', onOpen);
    source.addEventListener('error', onError);

    return () => {
      source.removeEventListener('message', onMessage);
      source.removeEventListener('open', onOpen);
      source.removeEventListener('error', onError);
      source.close();
    };
  }, [disputeId, qc]);

  return state;
}
