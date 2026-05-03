import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@Injectable()
export class MetricsRegistry {
  private readonly histograms = new Map<string, number[]>();
  private readonly counters = new Map<string, number>();

  observe(name: string, value: number): void {
    const arr = this.histograms.get(name) ?? [];
    arr.push(value);
    if (arr.length > 1024) arr.shift();
    this.histograms.set(name, arr);
  }

  increment(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  snapshot(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [name, values] of this.histograms) {
      out[name] = summarise(values);
    }
    for (const [name, value] of this.counters) {
      out[name] = value;
    }
    return out;
  }
}

function summarise(values: number[]): {
  count: number;
  p50: number;
  p95: number;
  max: number;
} {
  if (values.length === 0) return { count: 0, p50: 0, p95: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p: number): number => Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return {
    count: sorted.length,
    p50: Math.round(sorted[idx(0.5)] ?? 0),
    p95: Math.round(sorted[idx(0.95)] ?? 0),
    max: Math.round(sorted[sorted.length - 1] ?? 0),
  };
}

@ApiTags('panel')
@Controller('metrics')
class MetricsController {
  constructor(private readonly metrics: MetricsRegistry) {}

  @Get()
  @ApiOperation({ summary: 'JSON metrics snapshot' })
  get(): Record<string, unknown> {
    return this.metrics.snapshot();
  }
}

@Module({
  controllers: [MetricsController],
  providers: [MetricsRegistry],
  exports: [MetricsRegistry],
})
export class MetricsModule {}
