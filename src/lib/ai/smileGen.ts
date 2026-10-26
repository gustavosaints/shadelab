/**
 * Smile Design por IA: edição da foto do paciente por um modelo de imagem (Google Gemini, família
 * "Nano Banana"), trocando só os dentes pelo desenho pedido (forma, textura, cor, gengiva). A foto sai do
 * aparelho para a API do Google, por isso a tela avisa e a chave fica guardada só no aparelho.
 */
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode, encode } from 'jpeg-js';
import type { RGB } from '@/lib/color/convert';
import { base64ToBytes, bytesToBase64 } from '@/lib/image/base64';
import { paintGuide } from '@/lib/smile/guideImage';
import type { MappedTooth } from '@/lib/smile/mapping';
import { mouthPolygon } from '@/lib/smile/mouth';
import type { MouthPoint } from '@/lib/smile/teeth';

export { buildDesignPrompt, describeShade, designSummary, GUM_OPTIONS, TEXTURES, TOOTH_SHAPES } from './prompt';
export type { DesignOptions, GumId, TextureId, ToothShapeId } from './prompt';

/** Nano Banana 2 Lite: o mais barato da família e o testado no AI Studio em 2026-10-22. */
export const DEFAULT_AI_MODEL = 'gemini-3.1-flash-lite-image';
/** Modelo padrão antigo: quem nunca escolheu outro passa para o Lite. */
export const LEGACY_DEFAULT_AI_MODEL = 'gemini-2.5-flash-image';

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

/** Reduz a foto e devolve JPEG em base64 (e a largura final). */
async function photoToBase64(uri: string, maxSide: number): Promise<{ data: string; width: number }> {
  const ctx = ImageManipulator.manipulate(uri);
  const ref = await ctx.resize({ width: maxSide }).renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.92, base64: true });
  if (!out.base64) throw new Error('Não foi possível ler a foto.');
  return { data: out.base64, width: out.width };
}

/**
 * Planejamento desenhado sobre a foto: dentes (px da foto original), forma e cor-alvo. `mouth` (frações da foto)
 * recorta o desenho pela abertura dos lábios: o que fica atrás do lábio não é pintado.
 */
export type DesignGuide = { teeth: MappedTooth[]; photoWidth: number; shapeMix: number; color: RGB; mouth?: MouthPoint[] };

/** Desenha o planejamento sobre a foto já reduzida e devolve o JPEG em base64. */
function guideToBase64(photoB64: string, guide: DesignGuide): string {
  const img = decode(base64ToBytes(photoB64), { useTArray: true, formatAsRGBA: true, colorTransform: true });
  const clip = guide.mouth && guide.mouth.length >= 3 ? mouthPolygon(guide.mouth, img.width, img.height) : undefined;
  paintGuide({ data: img.data, width: img.width, height: img.height }, guide.teeth, guide.shapeMix, guide.color, img.width / guide.photoWidth, 0.88, clip);
  const jpg = encode({ data: img.data, width: img.width, height: img.height }, 88);
  return bytesToBase64(new Uint8Array(jpg.data));
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string }; text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
};

export type GenerateResult = { uri: string; prompt: string; model: string; ms: number };

/**
 * Gera a simulação a partir da foto e da instrução já montada (ver `buildDesignPrompt`). Com `guide`, manda também
 * a foto com o planejamento desenhado (imagem 2), para a IA seguir forma, tamanho, posição e cor dos dentes.
 */
export async function generateDesign(o: {
  photoUri: string;
  prompt: string;
  apiKey: string;
  model?: string;
  maxSide?: number;
  guide?: DesignGuide;
}): Promise<GenerateResult> {
  if (!o.apiKey.trim()) throw new Error('Informe a chave da API do Google em "Configurar IA", no fim da tela.');
  const model = o.model?.trim() || DEFAULT_AI_MODEL;
  const started = Date.now();
  const photo = await photoToBase64(o.photoUri, o.maxSide ?? 1536);
  const parts: Part[] = [{ text: o.prompt }, { inlineData: { mimeType: 'image/jpeg', data: photo.data } }];
  if (o.guide?.teeth.length) {
    try {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: guideToBase64(photo.data, o.guide) } });
    } catch {
      // sem guia (falha ao desenhar): segue só com a foto e o texto
    }
  }
  const uri = await callImageModel(model, o.apiKey, parts);
  return { uri, prompt: o.prompt, model, ms: Date.now() - started };
}

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };

async function callImageModel(model: string, apiKey: string, parts: Part[]): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'] } }),
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
    if (res.status === 400 && /API key/i.test(msg)) throw new Error('Chave da API inválida. Confira em "Configurar IA".');
    if (res.status === 404) throw new Error(`Modelo "${model}" não encontrado. Ajuste o nome do modelo em "Configurar IA".`);
    if (res.status === 429) {
      const zeroQuota = /limit:\s*0|quota.*0\b|free tier|billing/i.test(msg);
      throw new Error(
        zeroQuota
          ? `Sua chave não tem cota para este modelo de imagem. Confira o faturamento no Google AI Studio (os créditos podem levar um tempo para entrar). Mensagem do Google: ${msg}`
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
  return file.uri;
}
