import { Controller, NotFoundException, Param, ParseUUIDPipe, Sse } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DisputeStreamEvent } from '@tribune/types';
import { Observable, fromEvent, map, merge, takeUntil, timer } from 'rxjs';

import { PrismaService } from '../../prisma/prisma.service';

interface SseEnvelope {
  data: DisputeStreamEvent | { kind: 'heartbeat' };
}

const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_STREAM_LIFETIME_MS = 5 * 60_000;

@ApiTags('disputes')
@Controller('disputes')
export class DisputeStreamController {
  constructor(
    private readonly events: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  @Sse(':id/stream')
  @ApiOperation({ summary: 'Server-sent event stream for a single dispute' })
  async stream(@Param('id', new ParseUUIDPipe()) id: string): Promise<Observable<SseEnvelope>> {
    const exists = await this.prisma.dispute.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Dispute ${id} not found`);

    const events$ = fromEvent<DisputeStreamEvent>(this.events, `dispute.${id}`).pipe(
      map((event) => ({ data: event })),
    );
    const heartbeat$ = timer(HEARTBEAT_INTERVAL_MS, HEARTBEAT_INTERVAL_MS).pipe(
      map(() => ({ data: { kind: 'heartbeat' as const } })),
    );
    const close$ = timer(MAX_STREAM_LIFETIME_MS);

    return merge(events$, heartbeat$).pipe(takeUntil(close$));
  }
}
