/**
 * Smile Design por IA (redesenho de 2026-10-22, pedido do Gustavo: tirar toda a parte manual de colocar dentes).
 * Foto → escolhas (forma, textura, cor da escala, gengiva) → o Gemini gera a simulação → antes e depois com
 * cortina deslizante ou transparência → salvar no caso. Cada geração vira uma variação que pode ser comparada.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { AiConfig } from '@/components/AiConfig';
import { BeforeAfter, type CompareMode } from '@/components/BeforeAfter';
import { Button } from '@/components/Button';
import { Card, Muted, SectionTitle } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { FaceLandmarker, type FaceLandmarkerHandle } from '@/components/FaceLandmarker';
import { MouthEditor } from '@/components/MouthEditor';
import { SmileMap } from '@/components/SmileMap';
import { SmileGenerating } from '@/components/SmileGenerating';
import {
  buildDesignPrompt,
  DEFAULT_AI_MODEL,
  designSummary,
  generateDesign,
  GUM_OPTIONS,
  TEXTURES,
  TOOTH_SHAPES,
  type GumId,
  type TextureId,
  type ToothShapeId,
} from '@/lib/ai/smileGen';
import { getSystem } from '@/lib/color/shades';
import { detectFace, fitTeethToPhoto } from '@/lib/face/detect';
import {
  applyLength,
  ARCH_MOVE_STEP_MM,
  ARCH_WIDTH_STEP_MM,
  archTeeth,
  bumpLength,
  clampArch,
  DEFAULT_ARCH,
  describeArch,
  commonLength,
  describeLengths,
  LENGTH_STEP_MM,
  mapFromMouth,
  mapFromParams,
  MAPPED_TEETH,
  mirrorLabels,
  plausibleFit,
  type ArchEdit,
  type Fdi,
  type LengthEdit,
  type LengthEdits,
  type ToothMap,
} from '@/lib/smile/mapping';
import { centeredMouth, mouthBounds } from '@/lib/smile/mouth';
import type { MouthPoint } from '@/lib/smile/teeth';
import { takePendingPhoto } from '@/lib/smile/pendingPhoto';
import { DEFAULT_SMILE_PARAMS } from '@/lib/smile/teeth';
import { getCase, isSmileCase, newCaseId, persistPhoto, saveCase } from '@/lib/storage/cases';
import { useSettings } from '@/lib/useSettings';
import { colors, fonts, radius, spacing } from '@/theme';

type Photo = { uri: string; width: number; height: number };
/** Forma e textura começam sem escolha (pedido do Gustavo): a pessoa escolhe antes de gerar. */
type Choice = { shape: ToothShapeId | null; texture: TextureId | null; gum: GumId; shadeId: string };
type ReadyChoice = Choice & { shape: ToothShapeId; texture: TextureId };
type Result = { uri: string; choice: ReadyChoice; model: string; ms: number };
type MapStatus = 'detecting' | 'ok' | 'failed';

const fmtMm = (v: number | null) =>
  v === null ? 'vários' : v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} mm`;

export default function SmileDesign() {
  const { caseId } = useLocalSearchParams<{ caseId?: string }>();
  const [settings, reloadSettings] = useSettings();
  const system = getSystem(settings.shadeSystem);

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [choice, setChoice] = useState<Choice>({ shape: null, texture: null, gum: 'manter', shadeId: 'B1' });
  // mapeamento dos dentes 15–25 na foto, ajustes de comprimento (mm) e dente selecionado
  const landmarker = useRef<FaceLandmarkerHandle>(null);
  const mapToken = useRef(0);
  const [map, setMap] = useState<ToothMap | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>('detecting');
  const [lengths, setLengths] = useState<LengthEdits>({});
  const [arch, setArch] = useState<ArchEdit>(DEFAULT_ARCH);
  const [target, setTarget] = useState<Fdi | 'all'>('all');
  const [view, setView] = useState<'plan' | 'compare'>('plan');
  // contorno da boca (do detector ou marcado à mão) e o rascunho enquanto delimita
  const [mouth, setMouth] = useState<MouthPoint[] | null>(null);
  const [mouthDraft, setMouthDraft] = useState<MouthPoint[] | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState<CompareMode>('cortina');
  const [generating, setGenerating] = useState(false);
  // animação da espera: legendas das etapas e o resultado que está sendo revelado
  const [genSteps, setGenSteps] = useState<string[]>([]);
  const [pending, setPending] = useState<Result | null>(null);
  const [dragging, setDragging] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const compareRef = useRef<View>(null);

  const { width: windowW, height: windowH } = useWindowDimensions();
  const [areaH, setAreaH] = useState(0);
  const hasKey = settings.aiApiKey.trim().length > 0;
  const result = results[current];
  const aspect = photo ? photo.width / photo.height : 3 / 4;
  const shadeIds = system.shades.map((s) => s.id);
  const shadeId = shadeIds.includes(choice.shadeId) ? choice.shadeId : shadeIds[0];

  /** Encaixa os 10 dentes dentro do contorno da boca: autofit pelos pixels quando confiável, senão pela largura. */
  const mapInMouth = async (p: Photo, m: MouthPoint[], midX: number, mirrored: boolean, token: number) => {
    let tm: ToothMap | null = null;
    try {
      const fit = await fitTeethToPhoto(p, m, midX, DEFAULT_SMILE_PARAMS);
      if (fit && fit.fit.confidence >= 0.4 && plausibleFit(fit.params, m, p.width, p.height)) tm = mapFromParams(fit.params, p.width, p.height);
    } catch {
      tm = null;
    }
    tm = tm ?? mapFromMouth(m, p.width, p.height, midX * p.width);
    if (token !== mapToken.current) return;
    setMap(mirrored ? mirrorLabels(tm) : tm);
    setMapStatus('ok');
  };

  /** Acha a boca (MediaPipe) e encaixa os dentes. Sem rosto na foto (sorriso de perto), pede para delimitar. */
  const runMapping = async (p: Photo) => {
    const token = ++mapToken.current;
    setMap(null);
    setMouth(null);
    setMouthDraft(null);
    setMapStatus('detecting');
    setLengths({});
    setArch(DEFAULT_ARCH);
    setTarget('all');
    try {
      if (!landmarker.current) throw new Error('sem detector');
      const det = await detectFace(landmarker.current, p.uri);
      if (token !== mapToken.current) return;
      if (!det) {
        setMapStatus('failed');
        return;
      }
      setMouth(det.mouth);
      await mapInMouth(p, det.mouth, det.face.philtrum.x, det.mirrored, token);
    } catch {
      if (token === mapToken.current) setMapStatus('failed');
    }
  };

  const startMouthEdit = () => {
    if (!photo) return;
    setMouthDraft(mouth ?? centeredMouth(photo.width, photo.height));
    setView('plan');
  };
  const finishMouthEdit = () => {
    if (!photo || !mouthDraft) return;
    const m = mouthDraft;
    const token = ++mapToken.current;
    setMouth(m);
    setMouthDraft(null);
    setMap(null);
    setMapStatus('detecting');
    const midX = mouthBounds(m, photo.width, photo.height).centerX / photo.width;
    mapInMouth(photo, m, midX, false, token).catch(() => setMapStatus('failed'));
  };

  const startWithPhoto = (p: Photo) => {
    setPhoto(p);
    setResults([]);
    setCurrent(0);
    setEditingId(null);
    setCreatedAt(null);
    setView('plan');
    runMapping(p);
  };

  // foto vinda da câmera guiada
  useFocusEffect(
    useCallback(() => {
      const p = takePendingPhoto();
      if (p) startWithPhoto({ uri: p.uri, width: p.width, height: p.height });
      // só ao ganhar foco: a foto pendente é consumida uma vez
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // reabrir um caso salvo: foto, simulação e escolhas
  useEffect(() => {
    if (!caseId) return;
    (async () => {
      const c = await getCase(caseId);
      if (!c || !isSmileCase(c)) return;
      const size = await new Promise<{ w: number; h: number }>((res) =>
        Image.getSize(
          c.photoUri,
          (w, h) => res({ w, h }),
          () => res({ w: 3, h: 4 }),
        ),
      );
      const p = { uri: c.photoUri, width: size.w, height: size.h };
      setPhoto(p);
      runMapping(p);
      const saved: ReadyChoice = {
        shape: (c.ai?.shape as ToothShapeId) ?? 'arredondado',
        texture: (c.ai?.texture as TextureId) ?? 'natural',
        gum: (c.ai?.gum as GumId) ?? 'manter',
        shadeId: c.targetShade,
      };
      // a forma retangular saiu do app: o caso antigo abre sem forma escolhida
      setChoice({ ...saved, shape: TOOTH_SHAPES.some((sh) => sh.id === saved.shape) ? saved.shape : null });
      setResults(c.renderedUri ? [{ uri: c.renderedUri, choice: saved, model: c.ai?.model ?? '', ms: 0 }] : []);
      setView(c.renderedUri ? 'compare' : 'plan');
      setCurrent(0);
      setPatientName(c.patientName === 'Sem nome' ? '' : c.patientName);
      setNotes(c.notes);
      setEditingId(c.id);
      setCreatedAt(c.createdAt);
    })();
    // só quando muda o caso aberto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const pickFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    startWithPhoto({ uri: a.uri, width: a.width, height: a.height });
  };

  const generate = async () => {
    if (!photo) return;
    if (!hasKey) {
      setConfigOpen(true);
      Alert.alert('Falta a chave da IA', 'Cole a chave da API do Google em "Configurar IA", no fim da tela.');
      return;
    }
    if (!choice.shape || !choice.texture) {
      Alert.alert('Escolha a forma e a textura', 'Antes de gerar, toque numa forma e numa textura dos dentes.');
      return;
    }
    const ch: ReadyChoice = { ...choice, shape: choice.shape, texture: choice.texture, shadeId };
    const shade = system.shades.find((s) => s.id === ch.shadeId) ?? system.shades[0];
    const shadeLab = settings.calibrations[settings.shadeSystem]?.[shade.id] ?? shade.lab;
    const nameOf = (list: { id: string; name: string }[], id: string) => (list.find((o) => o.id === id)?.name ?? id).toLowerCase();
    setGenSteps([
      'Analisando o rosto e o sorriso',
      `Desenhando a forma ${nameOf(TOOTH_SHAPES, ch.shape)}`,
      `Aplicando a textura ${nameOf(TEXTURES, ch.texture)}`,
      `Ajustando a cor ${shade.id}`,
      ch.gum === 'plastia' ? 'Simulando a plastia gengival' : 'Preservando lábios e gengiva',
      'Finalizando os detalhes',
    ]);
    setPending(null);
    setGenerating(true);
    try {
      const r = await generateDesign({
        photoUri: photo.uri,
        prompt: buildDesignPrompt({ ...ch, shadeLab, lengths: [describeArch(arch), describeLengths(lengths)].filter(Boolean).join(' ') }),
        apiKey: settings.aiApiKey,
        model: settings.aiModel || DEFAULT_AI_MODEL,
      });
      // a animação revela a imagem e chama `finishReveal`
      setPending({ uri: r.uri, choice: ch, model: r.model, ms: r.ms });
    } catch (e) {
      setGenerating(false);
      Alert.alert('Não foi possível gerar', String((e as Error).message ?? e));
    }
  };

  const finishReveal = useCallback(() => {
    if (pending)
      setResults((list) => {
        const next = [...list, pending];
        setCurrent(next.length - 1);
        return next;
      });
    setPending(null);
    setGenerating(false);
    setView('compare');
  }, [pending]);

  // dentes na foto: encaixe original (recorte da vista) e com o arco + comprimentos (o que aparece)
  const frameTeeth = map ? archTeeth(map) : [];
  const planTeeth = map ? archTeeth(map, arch).map((t) => applyLength(t, lengths[t.fdi], map.pxPerMm)) : [];

  // ajustes de comprimento: todos os dentes ou o selecionado
  const targets: readonly Fdi[] = target === 'all' ? MAPPED_TEETH : [target];
  const bump = (which: keyof LengthEdit, sign: 1 | -1) => {
    setLengths((cur) => bumpLength(cur, targets, which, sign * LENGTH_STEP_MM));
    setView('plan');
  };
  const changeArch = (next: Partial<ArchEdit>) => {
    setArch((cur) => clampArch({ ...cur, ...next }));
    setView('plan');
  };
  const pick = (next: Partial<Choice>) => {
    setChoice({ ...choice, ...next });
    setView('plan');
  };

  const share = async (what: 'compare' | 'result') => {
    try {
      const uri = what === 'compare' && compareRef.current ? await captureRef(compareRef, { format: 'jpg', quality: 0.95 }) : result?.uri;
      if (!uri) return;
      if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: 'image/jpeg' });
      else Alert.alert('Imagem', uri);
    } catch (e) {
      Alert.alert('Não foi possível compartilhar', String(e));
    }
  };

  const save = async () => {
    if (!photo || !result) return;
    setSaving(true);
    try {
      const id = editingId ?? newCaseId();
      const photoUri = editingId ? photo.uri : await persistPhoto(photo.uri, id);
      const renderedUri = await persistPhoto(result.uri, id, `-smile-${Date.now()}`);
      await saveCase({
        kind: 'smile',
        id,
        createdAt: createdAt ?? new Date().toISOString(),
        patientName: patientName.trim() || 'Sem nome',
        notes: notes.trim(),
        photoUri,
        renderedUri,
        params: DEFAULT_SMILE_PARAMS,
        targetShade: result.choice.shadeId,
        aiStyle: designSummary(result.choice),
        ai: { shape: result.choice.shape, texture: result.choice.texture, gum: result.choice.gum, model: result.model },
      });
      router.dismissTo({ pathname: '/cases/[id]', params: { id } });
    } catch (e) {
      Alert.alert('Erro ao salvar', String(e));
    } finally {
      setSaving(false);
    }
  };

  // ----- sem foto -----
  if (!photo) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Card>
          <SectionTitle>Smile Design por IA</SectionTitle>
          <Muted>
            Fotografe o sorriso de frente, escolha a forma, a textura e a cor dos dentes, e a IA gera a simulação sobre a
            própria foto. Depois compare o antes e o depois.
          </Muted>
          <Button title="Fotografar com guia" onPress={() => router.push('/smile/capture')} style={{ marginTop: 12 }} />
          <Button title="Escolher da galeria" variant="secondary" onPress={pickFromGallery} style={{ marginTop: 8 }} />
        </Card>
        <Button title={configOpen ? 'Ocultar configuração da IA' : hasKey ? 'Configurar IA' : 'Configurar IA (falta a chave)'} variant="ghost" onPress={() => setConfigOpen(!configOpen)} />
        {configOpen && <AiConfig settings={settings} onSaved={reloadSettings} />}
      </ScrollView>
    );
  }

  // a foto ocupa metade da tela (pedido do Gustavo); a foto inteira (antes e depois / gerando) cabe nessa altura
  const chipsH = result && !generating ? 44 : 0;
  const photoH = Math.max(160, (areaH || windowH * 0.85) / 2 - chipsH - spacing.sm * 2);
  const fullW = Math.min(windowW - spacing.md * 2, photoH * aspect);
  const fullBox = { width: fullW, height: fullW / aspect, alignSelf: 'center' as const };

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setAreaH(e.nativeEvent.layout.height)}>
      <FaceLandmarker ref={landmarker} />
      {/* foto fixa no topo; as opções rolam embaixo */}
      <View style={styles.fixed}>
        {result && !generating && (
          <View style={styles.chips}>
            <Chip label="Planejamento" selected={view === 'plan'} onPress={() => setView('plan')} />
            <Chip label="Antes e depois" selected={view === 'compare'} onPress={() => setView('compare')} />
          </View>
        )}
        <View style={generating || (result && view === 'compare') ? fullBox : undefined}>
          {generating ? (
            <View style={[styles.photoBox, StyleSheet.absoluteFill]}>
              <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            </View>
          ) : result && view === 'compare' ? (
            <BeforeAfter
              ref={compareRef}
              beforeUri={photo.uri}
              afterUri={result.uri}
              aspect={aspect}
              mode={mode}
              onDragStart={() => setDragging(true)}
              onDragEnd={() => setDragging(false)}
            />
          ) : mouthDraft ? (
            <MouthEditor photo={photo} height={photoH} mouth={mouthDraft} onChange={setMouthDraft} onDragStart={() => setDragging(true)} onDragEnd={() => setDragging(false)} />
          ) : (
            <SmileMap
              photo={photo}
              height={photoH}
              teeth={planTeeth}
              frame={frameTeeth}
              status={mapStatus}
              shapeMix={TOOTH_SHAPES.find((sh) => sh.id === choice.shape)?.mix ?? null}
              texture={choice.texture}
              selected={target}
              onSelect={(fdi) => setTarget(target === fdi ? 'all' : fdi)}
            />
          )}
          {generating && <SmileGenerating photoUri={photo.uri} steps={genSteps} resultUri={pending?.uri} onDone={finishReveal} />}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingTop: 4, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!dragging}
      >
        {view === 'plan' &&
          (mouthDraft ? (
            <Card style={{ marginTop: spacing.md }}>
              <SectionTitle>Delimitar a boca</SectionTitle>
              <Muted>
                Arraste os pontos até a borda dos lábios: C nos cantos da boca, S no lábio de cima e I no lábio de baixo. A vista
                se aproxima a cada ponto solto. Depois toque em Pronto para eu encontrar os dentes.
              </Muted>
              <Button title="Pronto, encontrar os dentes" onPress={finishMouthEdit} style={{ marginTop: 12 }} />
              <Button title="Cancelar" variant="ghost" onPress={() => setMouthDraft(null)} />
            </Card>
          ) : mapStatus === 'failed' ? (
            <Card style={{ marginTop: spacing.md }}>
              <Muted>
                Não encontrei o sorriso automaticamente (acontece em fotos de perto, sem o rosto inteiro). Marque a borda dos
                lábios e eu encontro os dentes.
              </Muted>
              <Button title="Delimitar a boca" onPress={startMouthEdit} style={{ marginTop: 12 }} />
            </Card>
          ) : mapStatus === 'ok' ? (
            <Button title="Ajustar a boca" variant="ghost" onPress={startMouthEdit} />
          ) : null)}

        {result && view === 'compare' && (
          <Card style={{ marginTop: spacing.md }}>
            <View style={styles.chips}>
              <Chip label="Cortina" selected={mode === 'cortina'} onPress={() => setMode('cortina')} />
              <Chip label="Transparência" selected={mode === 'transparencia'} onPress={() => setMode('transparencia')} />
            </View>
            <Muted>
              {mode === 'cortina'
                ? 'Arraste na foto para passar a linha de um lado para o outro.'
                : 'Arraste a barra para misturar o antes e o depois (útil para ver a gengiva numa plastia gengival).'}
            </Muted>
            {results.length > 1 && (
              <>
                <SectionTitle>Variações</SectionTitle>
                <View style={styles.chips}>
                  {results.map((r, i) => (
                    <Chip key={r.uri} label={`${i + 1}: ${designSummary(r.choice)}`} selected={i === current} onPress={() => setCurrent(i)} />
                  ))}
                </View>
              </>
            )}
            <Muted>{`${designSummary(result.choice)}${result.model ? ` · ${result.model}` : ''}${result.ms ? ` · ${Math.round(result.ms / 1000)} s` : ''}`}</Muted>
            <View style={styles.row}>
              <Button title="Compartilhar antes e depois" variant="secondary" onPress={() => share('compare')} />
              <Button title="Só a simulação" variant="ghost" onPress={() => share('result')} />
            </View>
          </Card>
        )}

        <Card style={{ marginTop: result && view === 'compare' ? 0 : spacing.md }}>
          <SectionTitle>Forma dos dentes</SectionTitle>
          <View style={styles.chips}>
            {TOOTH_SHAPES.map((s) => (
              <Chip key={s.id} label={s.name} selected={choice.shape === s.id} onPress={() => pick({ shape: s.id })} />
            ))}
          </View>
          <Muted>
            {choice.shape ? 'A silhueta aparece sobre os dentes 15 a 25 na foto.' : 'Toque numa forma para ver a silhueta dela sobre os dentes do paciente.'}
          </Muted>

          {map && (
            <>
              <Text style={styles.subTitle}>Arco</Text>
              <View style={styles.chips}>
                <Chip label="Proporção natural" selected={!arch.golden} onPress={() => changeArch({ golden: false })} />
                <Chip label="Proporção áurea" selected={arch.golden} onPress={() => changeArch({ golden: true })} />
              </View>
              <View style={styles.stepRow}>
                <Text style={styles.stepLabel}>Largura</Text>
                <Pressable onPress={() => changeArch({ centralMm: arch.centralMm - ARCH_WIDTH_STEP_MM })} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel="Fechar o arco">
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stepValue}>{`central ${arch.centralMm.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} mm`}</Text>
                <Pressable onPress={() => changeArch({ centralMm: arch.centralMm + ARCH_WIDTH_STEP_MM })} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel="Abrir o arco">
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
              <View style={styles.stepRow}>
                <Text style={styles.stepLabel}>Altura</Text>
                <Pressable onPress={() => changeArch({ dyMm: arch.dyMm - ARCH_MOVE_STEP_MM })} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel="Subir o arco">
                  <Text style={styles.stepBtnText}>↑</Text>
                </Pressable>
                <Text style={styles.stepValue}>
                  {arch.dyMm === 0 ? 'no lugar' : `${Math.abs(arch.dyMm).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} mm ${arch.dyMm > 0 ? 'abaixo' : 'acima'}`}
                </Text>
                <Pressable onPress={() => changeArch({ dyMm: arch.dyMm + ARCH_MOVE_STEP_MM })} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel="Descer o arco">
                  <Text style={styles.stepBtnText}>↓</Text>
                </Pressable>
              </View>
              <Muted>
                {arch.golden
                  ? 'Proporção áurea: central 1,618 : lateral 1 : canino 0,618, mantida ao fechar ou abrir o arco.'
                  : '− fecha e + abre o arco (todas as larguras juntas); ↑ ↓ sobe e desce o arco inteiro.'}
              </Muted>
              {(arch.golden || arch.centralMm !== DEFAULT_ARCH.centralMm || arch.dyMm !== 0) && (
                <Button title="Zerar arco" variant="ghost" onPress={() => changeArch(DEFAULT_ARCH)} />
              )}

              <Text style={styles.subTitle}>Tamanho</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Chip label="Todos" selected={target === 'all'} onPress={() => setTarget('all')} />
                {MAPPED_TEETH.map((fdi) => (
                  <Chip key={fdi} label={fdi} selected={target === fdi} onPress={() => setTarget(fdi)} />
                ))}
              </ScrollView>
              {(['incisal', 'cervical'] as const).map((which) => (
                <View key={which} style={styles.stepRow}>
                  <Text style={styles.stepLabel}>{which === 'incisal' ? 'Incisal' : 'Cervical'}</Text>
                  <Pressable onPress={() => bump(which, -1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`Encurtar pela ${which}`}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepValue}>{fmtMm(commonLength(lengths, targets, which))}</Text>
                  <Pressable onPress={() => bump(which, 1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`Alongar pela ${which}`}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </Pressable>
                </View>
              ))}
              <Muted>
                {`${target === 'all' ? 'Todos os dentes' : `Dente ${target}`} · + alonga, − encurta (0,5 mm por toque). Toque num dente na foto para ajustar só ele.`}
              </Muted>
              {Object.keys(lengths).length > 0 && <Button title="Zerar tamanhos" variant="ghost" onPress={() => setLengths({})} />}
            </>
          )}

          <SectionTitle>Textura</SectionTitle>
          <View style={styles.chips}>
            {TEXTURES.map((t) => (
              <Chip key={t.id} label={t.name} selected={choice.texture === t.id} onPress={() => pick({ texture: t.id })} />
            ))}
          </View>
          {choice.texture && <Muted>Prévia da textura nos dentes 12, 11, 21 e 22.</Muted>}
          <SectionTitle>{`Cor · ${system.name}`}</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {shadeIds.map((id) => (
              <Chip key={id} label={id} selected={shadeId === id} onPress={() => pick({ shadeId: id })} />
            ))}
          </ScrollView>
          <SectionTitle>Gengiva</SectionTitle>
          <View style={styles.chips}>
            {GUM_OPTIONS.map((g) => (
              <Chip key={g.id} label={g.name} selected={choice.gum === g.id} onPress={() => pick({ gum: g.id })} />
            ))}
          </View>
          <Button
            title={generating ? 'Gerando…' : results.length ? 'Gerar nova variação' : 'Gerar Smile Design com IA'}
            onPress={generate}
            loading={generating}
            disabled={generating}
            style={{ marginTop: spacing.md }}
          />
          <Muted>A foto é enviada ao Google para gerar a simulação. Cada geração custa alguns centavos dos créditos da sua conta.</Muted>
        </Card>

        {result && (
          <Card>
            <SectionTitle>{editingId ? 'Atualizar o caso' : 'Salvar no caso'}</SectionTitle>
            <TextInput placeholder="Nome do paciente" value={patientName} onChangeText={setPatientName} style={styles.input} placeholderTextColor={colors.muted} />
            <TextInput
              placeholder="Observações"
              value={notes}
              onChangeText={setNotes}
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              multiline
              placeholderTextColor={colors.muted}
            />
            <Button title={editingId ? 'Atualizar caso' : 'Salvar caso'} onPress={save} loading={saving} />
          </Card>
        )}

        <Button title="Trocar foto" variant="ghost" onPress={() => setPhoto(null)} />
        <Button title={configOpen ? 'Ocultar configuração da IA' : hasKey ? 'Configurar IA' : 'Configurar IA (falta a chave)'} variant="ghost" onPress={() => setConfigOpen(!configOpen)} />
        {configOpen && <AiConfig settings={settings} onSaved={reloadSettings} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  photoBox: { backgroundColor: '#000', borderRadius: radius.md, overflow: 'hidden' },
  fixed: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, backgroundColor: colors.bg },
  subTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, marginTop: 14, marginBottom: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  stepLabel: { width: 72, color: colors.text, fontSize: 15 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 22, color: colors.primary, marginTop: -2 },
  stepValue: { minWidth: 76, textAlign: 'center', color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 10,
    color: colors.text,
    backgroundColor: '#FBFCFE',
  },
});
