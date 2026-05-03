export interface InferenceCall {
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
}

export interface InferenceResult {
  rawResponse: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  attestation?: string | null;
}

export interface InferencePort {
  runPanelist(input: InferenceCall): Promise<InferenceResult>;
  listAvailableModels(): Promise<string[]>;
}

export const INFERENCE_PORT = Symbol('InferencePort');
