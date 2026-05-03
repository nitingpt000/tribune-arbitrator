import { InferenceError } from '../../domain/errors';
import type {
  InferenceCall,
  InferencePort,
  InferenceResult,
} from '../../domain/ports/inference.port';
import type { DomainLogger } from '../../domain/ports/logger.port';

/**
 * 0G Compute adapter.
 *
 * Speaks the documented `@0glabs/0g-serving-broker` API. Live behaviour must
 * be verified by running apps/panel/spike/three-models-parallel.ts against a
 * funded 0G testnet account before turning APP_PROFILE=local on in production.
 *
 * The broker exposes OpenAI-compatible `/v1/chat/completions`. We:
 *   1. Resolve a provider whose `model` matches the requested name (case-insensitive
 *      family match). The catalog is fetched lazily and cached for 60s.
 *   2. Mint a single-use auth header via `broker.inference.getRequestHeaders()`.
 *   3. POST the messages payload.
 *   4. Run `broker.inference.processResponse()` for the verifiable-inference attestation
 *      and surface `attestation_failed` if it returns false.
 */

export interface OgComputeAdapterOptions {
  rpcUrl: string;
  privateKey: string;
  logger: DomainLogger;
  catalogTtlMs?: number;
}

interface BrokerService {
  provider: string;
  serviceType: string;
  model?: string;
  url?: string;
}

interface ServiceMetadata {
  endpoint: string;
  model: string;
}

interface BrokerLike {
  inference: {
    listService(): Promise<BrokerService[]>;
    getServiceMetadata(provider: string): Promise<ServiceMetadata>;
    getRequestHeaders(provider: string, content: string): Promise<Record<string, string>>;
    processResponse(provider: string, content: string): Promise<boolean>;
  };
}

export class OgComputeAdapter implements InferencePort {
  private brokerPromise: Promise<BrokerLike> | null = null;
  private catalog: { fetchedAtMs: number; services: BrokerService[] } | null = null;
  private readonly catalogTtlMs: number;

  constructor(private readonly options: OgComputeAdapterOptions) {
    this.catalogTtlMs = options.catalogTtlMs ?? 60_000;
  }

  async listAvailableModels(): Promise<string[]> {
    const services = await this.fetchCatalog();
    return services.filter((s) => s.serviceType === 'inference').map((s) => s.model ?? s.provider);
  }

  async runPanelist(input: InferenceCall): Promise<InferenceResult> {
    const services = (await this.fetchCatalog()).filter((s) => s.serviceType === 'inference');
    const provider = pickProviderByModel(services, input.modelName);
    if (!provider) {
      throw new InferenceError(
        'broker_unavailable',
        `No inference provider matches model "${input.modelName}"`,
        { modelName: input.modelName, availableCount: services.length },
      );
    }
    const broker = await this.getBroker();
    const start = performance.now();
    let endpoint: string;
    let resolvedModel: string;
    try {
      const meta = await broker.inference.getServiceMetadata(provider.provider);
      endpoint = meta.endpoint;
      resolvedModel = meta.model;
    } catch (err) {
      throw new InferenceError(
        'broker_unavailable',
        `getServiceMetadata failed: ${(err as Error).message}`,
        { provider: provider.provider },
      );
    }

    const messages = [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.userPrompt },
    ];
    const requestBody = JSON.stringify({
      model: resolvedModel,
      messages,
      max_tokens: input.maxTokens,
      temperature: input.temperature,
    });

    let headers: Record<string, string>;
    try {
      headers = await broker.inference.getRequestHeaders(provider.provider, requestBody);
    } catch (err) {
      throw new InferenceError(
        'broker_unavailable',
        `getRequestHeaders failed: ${(err as Error).message}`,
        { provider: provider.provider, modelName: input.modelName },
      );
    }

    let response: Response;
    try {
      response = await fetch(`${endpoint.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: requestBody,
      });
    } catch (err) {
      throw new InferenceError('broker_unavailable', `fetch failed: ${(err as Error).message}`, {
        endpoint,
        modelName: input.modelName,
      });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new InferenceError('http_error', `provider returned ${response.status}`, {
        status: response.status,
        snippet: body.slice(0, 240),
        modelName: input.modelName,
      });
    }

    const json = (await response.json().catch((err) => {
      throw new InferenceError(
        'malformed_response',
        `JSON parse failed: ${(err as Error).message}`,
        { modelName: input.modelName },
      );
    })) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new InferenceError(
        'malformed_response',
        'choices[0].message.content missing or not a string',
        { modelName: input.modelName },
      );
    }
    const latencyMs = performance.now() - start;
    const promptTokens = json.usage?.prompt_tokens ?? 0;
    const completionTokens = json.usage?.completion_tokens ?? 0;

    let attestation: string | null = null;
    try {
      const ok = await broker.inference.processResponse(provider.provider, content);
      attestation = ok ? 'tee:verified' : 'tee:failed';
      if (!ok) {
        this.options.logger.warn('og-compute.attestation.failed', {
          modelName: input.modelName,
          provider: provider.provider,
        });
        throw new InferenceError('attestation_failed', 'Broker processResponse() returned false', {
          modelName: input.modelName,
          provider: provider.provider,
        });
      }
    } catch (err) {
      if (err instanceof InferenceError) throw err;
      this.options.logger.warn('og-compute.attestation.threw', {
        modelName: input.modelName,
        error: (err as Error).message,
      });
    }

    return {
      rawResponse: content,
      promptTokens,
      completionTokens,
      latencyMs,
      attestation,
    };
  }

  private async fetchCatalog(): Promise<BrokerService[]> {
    const now = Date.now();
    if (this.catalog && now - this.catalog.fetchedAtMs < this.catalogTtlMs) {
      return this.catalog.services;
    }
    const broker = await this.getBroker();
    let services: BrokerService[];
    try {
      services = await broker.inference.listService();
    } catch (err) {
      throw new InferenceError(
        'broker_unavailable',
        `listService failed: ${(err as Error).message}`,
      );
    }
    this.catalog = { fetchedAtMs: now, services };
    return services;
  }

  private async getBroker(): Promise<BrokerLike> {
    if (this.brokerPromise) return this.brokerPromise;
    this.brokerPromise = (async () => {
      const ethers = await import('ethers').catch((err) => {
        throw new InferenceError(
          'broker_unavailable',
          `ethers not installed: ${(err as Error).message}`,
        );
      });
      const broker = await import('@0glabs/0g-serving-broker').catch((err) => {
        throw new InferenceError(
          'broker_unavailable',
          `@0glabs/0g-serving-broker not installed: ${(err as Error).message}. ` +
            `See apps/panel/SPIKE.md for the install + funding flow.`,
        );
      });
      const provider = new ethers.JsonRpcProvider(this.options.rpcUrl);
      const signer = new ethers.Wallet(this.options.privateKey, provider);
      return (await broker.createZGComputeNetworkBroker(signer)) as unknown as BrokerLike;
    })();
    return this.brokerPromise;
  }
}

function pickProviderByModel(services: BrokerService[], requested: string): BrokerService | null {
  const reqLower = requested.toLowerCase();
  const exact = services.find((s) => (s.model ?? '').toLowerCase() === reqLower);
  if (exact) return exact;
  const family = familyKey(reqLower);
  const familyMatch = services.find((s) => familyKey((s.model ?? '').toLowerCase()) === family);
  if (familyMatch) return familyMatch;
  return services[0] ?? null;
}

function familyKey(modelName: string): string {
  if (modelName.includes('llama')) return 'llama';
  if (modelName.includes('deepseek')) return 'deepseek';
  if (modelName.includes('qwen')) return 'qwen';
  if (modelName.includes('glm')) return 'glm';
  if (modelName.includes('mistral')) return 'mistral';
  return modelName.split(/[-_./]/)[0] ?? modelName;
}
