// Provider model limit, not an editorial word-count target. Standard usage includes reasoning.
// Sources: https://developers.openai.com/api/docs/models/gpt-6.1-terra
// https://developers.openai.com/api/docs/guides/reasoning
export const MODEL_OUTPUT_TOKENS = 128000;
export const LEGACY_OUTPUT_TOKENS = 2400;
export const MAX_EXPLANATION_TEXT_CHARS = 16 * 1024 * 1024;
export const MAX_EXPLANATION_FRAME_CHARS = 32 * 1024 * 1024;
export type ExplanationOutputPolicy = {revision:string;model:string;pricingRevision:string;maxInputTokens:number;maxOutputTokens:number;inputRate:number;outputRate:number;serviceTier:string};
export function validatedOutputPolicy(value: unknown, model: string, pricing: string, inputRate: number, outputRate: number): ExplanationOutputPolicy | null {
 const p=value as ExplanationOutputPolicy;
 return p && p.revision==='terra-model-max-v1' && p.model===model && model==='gpt-6.1-terra' && p.pricingRevision===pricing && pricing==='2026-11-02-terra-standard' && p.maxInputTokens===16000 && p.maxOutputTokens===MODEL_OUTPUT_TOKENS && p.inputRate===inputRate && inputRate===1000000 && p.outputRate===outputRate && outputRate===5000000 && p.serviceTier==='default' ? p:null;
}
export function outputUsageCost(policy:ExplanationOutputPolicy, inputTokens:number,outputTokens:number) {
 if(!Number.isSafeInteger(inputTokens)||inputTokens<0||inputTokens>policy.maxInputTokens||!Number.isSafeInteger(outputTokens)||outputTokens<0||outputTokens>policy.maxOutputTokens)return null;
 const sum=inputTokens*policy.inputRate+outputTokens*policy.outputRate;
 return Number.isSafeInteger(sum)?Math.ceil(sum/1000000):null;
}
