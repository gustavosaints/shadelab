/**
 * "Gerar sorriso por IA": edição da foto do paciente por um modelo de imagem
 * (Google Gemini, família "Nano Banana"), trocando só os dentes por um sorriso
 * do estilo escolhido na cor da escala escolhida. A foto sai do aparelho para a
 * API do Google, por isso a tela pede consentimento e a chave fica nas Configurações.
 */
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { Lab } from '@/lib/color/convert';
import { buildPrompt as makePrompt, type SmileStyleId as StyleId } from './prompt';

export { buildPrompt, describeShade, SMILE_STYLES, type SmileStyleId } from './prompt';

export const DEFAULT_AI_MODEL = 'gemini-2.5-flash-image';

export type ModelInfo = { name: string; displayName: string; image: boolean };

/**
 * Lista os modelos acessíveis pela chave (GET /models). Marca os que geram imagem
 * pelo nome ("image"). Serve para diagnosticar chave, região e cota.
 */
export async function listModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': apiKey.trim() },
  });
  const json = (await res.json().catch(() => ({}))) as {
    models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  return (json.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => ({
      name: m.name.replace(/^models\//, ''),
      displayName: m.displayName ?? m.name,
      image: /image/i.test(m.name) || /image/i.test(m.displayName ?? ''),
    }))
    .sort((a, b) => Number(b.image) - Number(a.image) || a.name.localeCompare(b.name));
}

export type GenerateOptions = {
  photoUri: string;
  style: StyleId;
  shadeId: string;
  shadeLab: Lab;
  apiKey: string;
  model?: string;
  /** Lado maior da foto enviada (px). Menor = mais rápido e mais barato. */
  maxSide?: number;
};

export type GenerateResult = { uri: string; prompt: string; model: string; ms: number };

/** Reduz a foto e devolve JPEG em base64. */
async function photoToBase64(uri: string, maxSide: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  const ref = await ctx.resize({ width: maxSide }).renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.92, base64: true });
  if (!out.base64) throw new Error('Não foi possível ler a foto.');
  return out.base64;
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string }; text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
};

/** Chama o Gemini (generateContent com resposta em imagem) e grava o resultado no cache do app. */
export async function generateSmile(o: GenerateOptions): Promise<GenerateResult> {
  if (!o.apiKey.trim()) throw new Error('Informe a chave da API do Google nas Configurações.');
  const model = o.model?.trim() || DEFAULT_AI_MODEL;
  const prompt = makePrompt(o.style, o.shadeId, o.shadeLab);
  const started = Date.now();
  const data = await photoToBase64(o.photoUri, o.maxSide ?? 1536);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': o.apiKey.trim() },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data } }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(`Sem resposta do serviço de IA (${String((e as Error).message ?? e)}). Verifique a internet.`);
  } finally {
    clearTimeout(timer);
  }
  const json = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 400 && /API key/i.test(msg)) throw new Error('Chave da API inválida. Confira nas Configurações.');
    if (res.status === 404) throw new Error(`Modelo "${model}" não encontrado. Ajuste o nome do modelo nas Configurações.`);
    if (res.status === 429) {
      const zeroQuota = /limit:\s*0|quota.*0\b|free tier|billing/i.test(msg);
      throw new Error(
        zeroQuota
          ? `Sua chave não tem cota para este modelo de imagem (plano gratuito). No Google AI Studio, ative o faturamento (pay-as-you-go) ou troque o modelo em "Ver modelos". Mensagem do Google: ${msg}`
          : `Limite de uso da API atingido. Mensagem do Google: ${msg}`,
      );
    }
    throw new Error(`Erro do serviço de IA (HTTP ${res.status}): ${msg}`);
  }
  if (json.promptFeedback?.blockReason) throw new Error(`A IA recusou a imagem (${json.promptFeedback.blockReason}). Tente outra foto.`);
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) {
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join(' ');
    throw new Error(text ? `A IA não devolveu imagem: ${text.slice(0, 200)}` : 'A IA não devolveu imagem. Tente de novo.');
  }
  const ext = part.inlineData.mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const file = new File(Paths.cache, `ai-smile-${Date.now()}.${ext}`);
  file.write(part.inlineData.data, { encoding: 'base64' });
  return { uri: file.uri, prompt, model, ms: Date.now() - started };
}
