import 'server-only'
import { env } from '../env'

/**
 * Provider-independent LLM transport. Each adapter takes a system prompt and
 * a user prompt and must return JSON text. Model names and parameters are
 * configured per task through environment variables.
 */

export type AiTask = 'negotiation' | 'evaluation' | 'scenario'

export type CompletionRequest = { task: AiTask; system: string; user: string; maxTokens: number; temperature?: number }
export type CompletionResult = { text: string; inputTokens: number; outputTokens: number; provider: string; model: string }

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiUnavailableError'
  }
}

const DEFAULT_MODELS: Record<string, Record<AiTask, string>> = {
  google: { negotiation: 'gemini-2.5-flash', evaluation: 'gemini-2.5-flash', scenario: 'gemini-2.5-flash' },
  openai: { negotiation: 'gpt-4.1-mini', evaluation: 'gpt-4.1-mini', scenario: 'gpt-4.1-mini' },
  anthropic: { negotiation: 'claude-haiku-5-5', evaluation: 'claude-sonnet-5-5', scenario: 'claude-haiku-5-5' },
  mock: { negotiation: 'mock', evaluation: 'mock', scenario: 'mock' },
}

/** Rough USD per million tokens (input, output) used for cost estimates only. */
const PRICES: Record<string, [number, number]> = { google: [0.3, 2.5], openai: [0.4, 1.6], anthropic: [1, 5], mock: [0, 0] }

export function modelFor(task: AiTask): { provider: string; model: string } {
  const e = env()
  const provider = e.AI_PROVIDER || 'mock'
  const override = task === 'negotiation' ? e.AI_MODEL_NEGOTIATION : task === 'evaluation' ? e.AI_MODEL_EVALUATION : e.AI_MODEL_SCENARIO
  return { provider, model: override || DEFAULT_MODELS[provider]?.[task] || 'unknown' }
}

export function estimateCostMicros(provider: string, inputTokens: number, outputTokens: number): number {
  const [pin, pout] = PRICES[provider] ?? [0, 0]
  return Math.round(inputTokens * pin + outputTokens * pout)
}

export function aiConfigured(): boolean {
  const e = env()
  if (!e.AI_ENABLED) return false
  const provider = e.AI_PROVIDER || ''
  if (provider === 'mock') return true
  return ['google', 'openai', 'anthropic'].includes(provider) && Boolean(e.AI_API_KEY)
}

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (res.status === 429) throw new AiUnavailableError('The AI provider is rate limiting requests.')
  if (!res.ok) throw new AiUnavailableError(`The AI provider returned an error (${res.status}).`)
  return res.json()
}

type Adapter = (req: CompletionRequest, model: string, key: string) => Promise<Omit<CompletionResult, 'provider' | 'model'>>

const google: Adapter = async (req, model, key) => {
  const data = (await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': key },
    {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: 'user', parts: [{ text: req.user }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: req.maxTokens, temperature: req.temperature ?? 0.6 },
    },
    20000,
  )) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  return { text, inputTokens: data.usageMetadata?.promptTokenCount ?? 0, outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0 }
}

const openai: Adapter = async (req, model, key) => {
  const data = (await post(
    'https://api.openai.com/v1/chat/completions',
    { Authorization: `Bearer ${key}` },
    {
      model,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      response_format: { type: 'json_object' },
      max_tokens: req.maxTokens,
      temperature: req.temperature ?? 0.6,
    },
    20000,
  )) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } }
  return { text: data.choices?.[0]?.message?.content ?? '', inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 }
}

const anthropic: Adapter = async (req, model, key) => {
  const data = (await post(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    {
      model,
      system: req.system,
      max_tokens: req.maxTokens,
      temperature: req.temperature ?? 0.6,
      messages: [{ role: 'user', content: `${req.user}\n\nRespond with a single JSON object only.` }],
    },
    25000,
  )) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } }
  const text = data.content?.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('') ?? ''
  return { text, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 }
}

export type MockHandler = (req: CompletionRequest) => string
let mockHandler: MockHandler | null = null
/** The mock provider delegates to a deterministic handler registered by the AI services. */
export function registerMockHandler(h: MockHandler) {
  mockHandler = h
}

export async function complete(req: CompletionRequest): Promise<CompletionResult> {
  if (!aiConfigured()) throw new AiUnavailableError('AI features are not enabled on this server.')
  const { provider, model } = modelFor(req.task)
  if (provider === 'mock') {
    if (!mockHandler) throw new AiUnavailableError('Mock AI handler not registered.')
    const text = mockHandler(req)
    return { text, inputTokens: Math.ceil((req.system.length + req.user.length) / 4), outputTokens: Math.ceil(text.length / 4), provider, model }
  }
  const key = env().AI_API_KEY!
  const adapter = provider === 'google' ? google : provider === 'openai' ? openai : anthropic
  try {
    const r = await adapter(req, model, key)
    return { ...r, provider, model }
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) throw new AiUnavailableError('The AI provider timed out.')
    throw new AiUnavailableError('The AI provider could not be reached.')
  }
}

/** Extract the first JSON object from model text (handles code fences). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('No JSON object in model output')
  return JSON.parse(trimmed.slice(start, end + 1))
}
