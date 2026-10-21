import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Button } from '@/components/Button';
import { Card, Muted, SectionTitle } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { FaceLandmarker, type FaceLandmarkerHandle } from '@/components/FaceLandmarker';
import { Marker } from '@/components/Marker';
import { ShadeRow } from '@/components/ShadeRow';
import { correctedLab, type ReferenceSpec } from '@/lib/color/calibrate';
import { labToHex, roundLab, type Lab } from '@/lib/color/convert';
import { matchGingiva, type GingivaMatch } from '@/lib/color/gingiva';
import { findCentralIncisor } from '@/lib/face/findTooth';
import { matchShadeProfile, type MatchResult, type ThirdsProfile } from '@/lib/color/match';
import { findShade, getSystem, NEUTRAL_REFERENCES } from '@/lib/color/shades';
import { cropToFile } from '@/lib/image/crop';
import { sampleRegion, sampleThirds, type Rect, type Sample } from '@/lib/image/sample';
import { newCaseId, persistPhoto, saveCase } from '@/lib/storage/cases';
import { loadSettings, saveCalibration, saveGingivaCalibration, saveSettings, type ReferenceMode, type Settings } from '@/lib/storage/settings';
import { colors, radius, spacing } from '@/theme';

type Params = {
  uri: string;
  w: string;
  h: string;
  mode?: 'shade' | 'calibrate' | 'calibrate-gingiva';
  /** Tab sendo calibrado (dente: A1…; gengiva: G1…). */
  shade?: string;
  /** Reanálise de um caso existente: o salvar atualiza este caso. */
  caseId?: string;
  patient?: string;
  tooth?: string;
  notes?: string;
  createdAt?: string;
};
type Touch = { pageX: number; pageY: number };
type Zoom = { scale: number; tx: number; ty: number };

/** Variação relativa de luminância acima da qual a região é considerada heterogênea. */
const HETEROGENEOUS_CV = 0.2;
const MIN_RECT_PX = 12;
const MAX_ZOOM = 5;

const touchesOf = (e: GestureResponderEvent): Touch[] => (e.nativeEvent.touches ?? []).map((t) => ({ pageX: t.pageX, pageY: t.pageY }));
const centroid = (t: Touch[]) => ({ x: t.reduce((s, p) => s + p.pageX, 0) / t.length, y: t.reduce((s, p) => s + p.pageY, 0) / t.length });
const dist = (t: Touch[]) => (t.length >= 2 ? Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY) : 0);

export default function Analyze() {
  const {
    uri,
    w,
    h,
    mode = 'shade',
    shade: calibShade,
    caseId,
    patient,
    tooth: toothParam,
    notes: notesParam,
    createdAt: createdAtParam,
  } = useLocalSearchParams<Params>();
  const imgW = Number(w) || 1;
  const imgH = Number(h) || 1;

  const [settings, setSettings] = useState<Settings | null>(null);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<Zoom>({ scale: 1, tx: 0, ty: 0 });
  // retângulos em pixels da imagem: o do dente cobre a coroa inteira (colo → borda incisal)
  const [tooth, setTooth] = useState<Rect>({ x: imgW * 0.46, y: imgH * 0.37, width: imgW * 0.08, height: imgH * 0.12 });
  const [ref, setRef] = useState<Rect>({ x: imgW * 0.46, y: imgH * 0.57, width: imgW * 0.08, height: imgW * 0.08 });
  const [gingiva, setGingiva] = useState<Rect>({ x: imgW * 0.46, y: imgH * 0.27, width: imgW * 0.08, height: imgW * 0.06 });
  const [useGingiva, setUseGingiva] = useState(false);
  const [lowerTooth, setLowerTooth] = useState(false);
  const [refMode, setRefMode] = useState<ReferenceMode>('gray18');
  const [refTab, setRefTab] = useState('A2');
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [result, setResult] = useState<{
    match: MatchResult;
    profile: ThirdsProfile;
    whole: Sample;
    refSample?: Sample;
    gingivaLab?: Lab;
    gingivaMatches?: GingivaMatch[];
  } | null>(null);
  const calibratingGingiva = mode === 'calibrate-gingiva';
  const landmarker = useRef<FaceLandmarkerHandle>(null);
  const [placing, setPlacing] = useState(false);
  const [placeNote, setPlaceNote] = useState<string | null>(null);
  const placedOnce = useRef(false);
  const [patientName, setPatientName] = useState(patient && patient !== 'Sem nome' ? patient : '');
  const [toothNumber, setToothNumber] = useState(toothParam ?? '');
  const [notes, setNotes] = useState(notesParam ?? '');

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setRefMode(s.referenceMode);
      setRefTab(s.referenceTab);
    });
  }, []);

  /** Acha um central na foto e põe os quadros do dente e da gengiva já no tamanho certo. */
  const placeOnTooth = async () => {
    if (placing) return;
    setPlacing(true);
    setPlaceNote(null);
    try {
      const found = await findCentralIncisor({ uri, width: imgW, height: imgH }, landmarker.current);
      if (!found) {
        setPlaceNote('Não achei o dente sozinho. Arraste o quadro azul para a coroa e puxe a alça para o tamanho.');
        return;
      }
      setTooth(found.tooth);
      setGingiva(found.gingiva);
      setPlaceNote(`Quadro colocado no dente ${found.fdi}${found.source === 'face' ? ' (boca detectada)' : ''}. Confira e ajuste se precisar.`);
    } catch (e) {
      setPlaceNote(`Não consegui localizar o dente (${String((e as Error).message ?? e)}).`);
    } finally {
      setPlacing(false);
    }
  };
  // ao abrir a foto (só na tomada de cor), tenta colocar o quadro no dente uma vez
  useEffect(() => {
    if (mode !== 'shade' || placedOnce.current || !layout.width) return;
    placedOnce.current = true;
    const t = setTimeout(() => placeOnTooth(), 400); // dá tempo do detector (WebView) carregar
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.width, mode]);

  // Geometria: imagem com "contain" dentro da vista ampliada (layout × zoom)
  const inner = { width: layout.width * zoom.scale, height: layout.height * zoom.scale };
  const geo = useMemo(() => {
    if (!inner.width || !inner.height) return { scale: 1, ox: 0, oy: 0 };
    const scale = Math.min(inner.width / imgW, inner.height / imgH);
    return { scale, ox: (inner.width - imgW * scale) / 2, oy: (inner.height - imgH * scale) / 2 };
  }, [inner.width, inner.height, imgW, imgH]);

  const toScreen = (r: Rect) => ({
    x: geo.ox + (r.x + r.width / 2) * geo.scale,
    y: geo.oy + (r.y + r.height / 2) * geo.scale,
    width: r.width * geo.scale,
    height: r.height * geo.scale,
  });
  const moveBy = (set: (f: (r: Rect) => Rect) => void) => (dx: number, dy: number) =>
    set((r) => ({
      ...r,
      x: Math.max(0, Math.min(imgW - r.width, r.x + dx / geo.scale)),
      y: Math.max(0, Math.min(imgH - r.height, r.y + dy / geo.scale)),
    }));
  const resizeBy = (set: (f: (r: Rect) => Rect) => void) => (dw: number, dh: number) =>
    set((r) => ({
      ...r,
      width: Math.max(MIN_RECT_PX, Math.min(imgW - r.x, r.width + dw / geo.scale)),
      height: Math.max(MIN_RECT_PX, Math.min(imgH - r.y, r.height + dh / geo.scale)),
    }));

  // ----- zoom por pinça e arrasto da vista (os quadros capturam o próprio toque antes) -----
  const gesture = useRef<{ touches: Touch[]; dist: number; start: { x: number; y: number }; zoom: Zoom } | null>(null);
  const clampZoom = (z: Zoom): Zoom => {
    const scale = Math.min(MAX_ZOOM, Math.max(1, z.scale));
    const W = layout.width * scale;
    const H = layout.height * scale;
    return { scale, tx: Math.min(0, Math.max(layout.width - W, z.tx)), ty: Math.min(0, Math.max(layout.height - H, z.ty)) };
  };
  const onGrant = (e: GestureResponderEvent) => {
    const t = touchesOf(e);
    const now = t.length ? t : [{ pageX: e.nativeEvent.pageX, pageY: e.nativeEvent.pageY }];
    gesture.current = { touches: now, dist: dist(now), start: { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }, zoom };
  };
  const onMove = (e: GestureResponderEvent) => {
    const g = gesture.current;
    if (!g) return;
    const t = touchesOf(e);
    const now = t.length ? t : [{ pageX: e.nativeEvent.pageX, pageY: e.nativeEvent.pageY }];
    if (now.length !== g.touches.length) {
      gesture.current = { ...g, touches: now, dist: dist(now), zoom };
      return;
    }
    const c0 = centroid(g.touches);
    const c1 = centroid(now);
    let scale = g.zoom.scale;
    let tx = g.zoom.tx + (c1.x - c0.x);
    let ty = g.zoom.ty + (c1.y - c0.y);
    if (now.length >= 2 && g.dist > 10) {
      scale = g.zoom.scale * (dist(now) / g.dist);
      const k = scale / g.zoom.scale;
      tx = g.start.x - (g.start.x - g.zoom.tx) * k + (c1.x - c0.x);
      ty = g.start.y - (g.start.y - g.zoom.ty) * k + (c1.y - c0.y);
    } else if (g.zoom.scale <= 1) return;
    setZoom(clampZoom({ scale, tx, ty }));
  };
  const onEnd = () => {
    gesture.current = null;
  };

  const system = settings ? getSystem(settings.shadeSystem) : null;
  const refLabel = refMode === 'none' ? 'Sem referência' : refMode === 'tab' ? `Tab ${refTab}` : NEUTRAL_REFERENCES[refMode].name;

  const analyze = async () => {
    if (!settings || !system) return;
    setBusy(true);
    setResult(null);
    setWarning(null);
    try {
      let refSample: Sample | undefined;
      let refSpec: ReferenceSpec | undefined;
      if (refMode !== 'none') {
        refSample = await sampleRegion(uri, ref, imgW, imgH);
        let known: Lab | undefined;
        if (refMode === 'tab') {
          const calib = settings.calibrations[settings.shadeSystem]?.[refTab];
          known = calib ?? findShade(settings.shadeSystem, refTab)?.lab;
        } else {
          known = NEUTRAL_REFERENCES[refMode].lab;
        }
        if (known) refSpec = { measured: refSample.rgb, known };
      }
      // dente inteiro: três terços (colo → incisal) comparados com o tab inteiro
      const thirds = await sampleThirds(uri, tooth, imgW, imgH, !lowerTooth);
      const profile: ThirdsProfile = {
        cervical: correctedLab(thirds.cervical.rgb, refSpec),
        middle: correctedLab(thirds.middle.rgb, refSpec),
        incisal: correctedLab(thirds.incisal.rgb, refSpec),
      };
      const match = matchShadeProfile(profile, settings.shadeSystem, {
        topN: 2,
        calibration: settings.calibrations[settings.shadeSystem],
        calibrationThirds: settings.calibrationThirds[settings.shadeSystem],
      });
      let gingivaLab: Lab | undefined;
      let gingivaMatches: GingivaMatch[] | undefined;
      if (calibratingGingiva) {
        gingivaLab = correctedLab(thirds.whole.rgb, refSpec);
      } else if (useGingiva) {
        const g = await sampleRegion(uri, gingiva, imgW, imgH);
        gingivaLab = correctedLab(g.rgb, refSpec);
        gingivaMatches = matchGingiva(gingivaLab, settings.gingivaCalibrations).matches;
      }
      setResult({ match, profile, whole: thirds.whole, refSample, gingivaLab, gingivaMatches });
      if (thirds.middle.cv > HETEROGENEOUS_CV) {
        setWarning(
          `Variação de ${Math.round(thirds.middle.cv * 100)}% no terço médio do dente. Se houver reflexo, borda ou mancha dentro do quadro, ajuste o quadro para cobrir só a coroa e repita.`,
        );
      } else if (refSample && refSample.cv > HETEROGENEOUS_CV) {
        setWarning(`Variação de ${Math.round(refSample.cv * 100)}% dentro do quadro da referência. Centralize o quadro na referência, longe das bordas.`);
      }
      await saveSettings({ referenceMode: refMode, referenceTab: refTab });
    } catch (e) {
      Alert.alert('Não foi possível analisar', String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveAsCalibration = async () => {
    if (!result || !settings || !calibShade) return;
    // guarda também a foto recortada do tab real, para o PDF mostrar a escala de verdade
    let image: string | undefined;
    try {
      image = await cropToFile(uri, tooth, imgW, imgH, calibratingGingiva ? `gingiva-${calibShade}` : `${settings.shadeSystem}-${calibShade}`);
    } catch {
      image = undefined;
    }
    if (calibratingGingiva) {
      if (!result.gingivaLab) return;
      await saveGingivaCalibration(calibShade, roundLab(result.gingivaLab, 2), image);
      Alert.alert('Calibração salva', `Gengiva ${calibShade} registrada (L*a*b* ${fmtLab(result.gingivaLab)}).`, [{ text: 'OK', onPress: () => router.dismissTo('/settings') }]);
      return;
    }
    const p = result.profile;
    await saveCalibration(
      settings.shadeSystem,
      calibShade,
      roundLab(p.middle, 2),
      { cervical: roundLab(p.cervical, 2), middle: roundLab(p.middle, 2), incisal: roundLab(p.incisal, 2) },
      image,
    );
    Alert.alert('Calibração salva', `${calibShade} registrado por terços (médio L*a*b* ${fmtLab(p.middle)}).`, [
      { text: 'OK', onPress: () => router.dismissTo('/settings') },
    ]);
  };

  const save = async () => {
    if (!result || !settings) return;
    setBusy(true);
    try {
      const id = caseId || newCaseId();
      const photoUri = caseId ? uri : await persistPhoto(uri, id);
      await saveCase({
        id,
        createdAt: createdAtParam || new Date().toISOString(),
        patientName: patientName.trim() || 'Sem nome',
        tooth: toothNumber.trim(),
        notes: notes.trim(),
        photoUri,
        photoWidth: imgW,
        photoHeight: imgH,
        shadeSystem: settings.shadeSystem,
        referenceLabel: refLabel,
        calibrated: result.match.calibrated,
        toothLab: roundLab(result.match.measured, 2),
        toothHex: labToHex(result.match.measured),
        gingivaLab: result.gingivaLab ? roundLab(result.gingivaLab, 2) : undefined,
        gingivaHex: result.gingivaLab ? labToHex(result.gingivaLab) : undefined,
        matches: result.match.matches.map((m) => ({ shadeId: m.shade.id, deltaE: m.deltaE, quality: m.quality })),
        confidence: result.match.confidence,
        toothRect: { x: Math.round(tooth.x), y: Math.round(tooth.y), width: Math.round(tooth.width), height: Math.round(tooth.height) },
        lowerTooth,
        thirds: { cervical: roundLab(result.profile.cervical, 2), middle: roundLab(result.profile.middle, 2), incisal: roundLab(result.profile.incisal, 2) },
        gingivaRect: useGingiva ? { x: Math.round(gingiva.x), y: Math.round(gingiva.y), width: Math.round(gingiva.width), height: Math.round(gingiva.height) } : undefined,
        gingivaMatches: result.gingivaMatches?.map((m) => ({ shadeId: m.shade.id, deltaE: m.deltaE })),
      });
      router.dismissTo({ pathname: '/cases/[id]', params: { id } });
    } catch (e) {
      Alert.alert('Erro ao salvar', String(e));
    } finally {
      setBusy(false);
    }
  };

  const thirdsRow = (p: ThirdsProfile) => (
    <View style={styles.thirdsRow}>
      {(['cervical', 'middle', 'incisal'] as const).map((k) => (
        <View key={k} style={styles.thirdItem}>
          <View style={[styles.thirdSwatch, { backgroundColor: labToHex(p[k]) }]} />
          <Text style={styles.thirdLabel}>{k === 'cervical' ? 'Cervical' : k === 'middle' ? 'Médio' : 'Incisal'}</Text>
          <Text style={styles.thirdLab}>{fmtLab(p[k])}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FaceLandmarker ref={landmarker} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View
          style={styles.imageArea}
          onLayout={(e) => setLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={onGrant}
          onResponderMove={onMove}
          onResponderRelease={onEnd}
          onResponderTerminate={onEnd}
        >
          <View style={{ position: 'absolute', left: zoom.tx, top: zoom.ty, width: inner.width, height: inner.height }}>
            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
            {layout.width > 0 && (
              <>
                <Marker
                  {...toScreen(tooth)}
                  color={calibratingGingiva ? '#E05C8A' : colors.primary}
                  label={mode === 'shade' ? 'Dente' : `Tab ${calibShade}`}
                  onMove={moveBy(setTooth)}
                  onResize={resizeBy(setTooth)}
                  thirds={!calibratingGingiva}
                />
                {refMode !== 'none' && (
                  <Marker {...toScreen(ref)} color={colors.accent} label="Referência" onMove={moveBy(setRef)} onResize={resizeBy(setRef)} />
                )}
                {useGingiva && (
                  <Marker {...toScreen(gingiva)} color="#E05C8A" label="Gengiva" onMove={moveBy(setGingiva)} onResize={resizeBy(setGingiva)} />
                )}
              </>
            )}
          </View>
          {zoom.scale > 1 && (
            <Pressable onPress={() => setZoom({ scale: 1, tx: 0, ty: 0 })} style={styles.zoomBadge}>
              <Text style={styles.zoomBadgeText}>{`${zoom.scale.toFixed(1)}x · tocar para 1x`}</Text>
            </Pressable>
          )}
        </View>

        <View style={{ padding: spacing.md }}>
          <Card>
            <SectionTitle>Referência na foto</SectionTitle>
            <View style={styles.chips}>
              <Chip label="Nenhuma" selected={refMode === 'none'} onPress={() => setRefMode('none')} />
              <Chip label="Cinza 18%" selected={refMode === 'gray18'} onPress={() => setRefMode('gray18')} />
              <Chip label="Branco" selected={refMode === 'white'} onPress={() => setRefMode('white')} />
              <Chip label="Tab da escala" selected={refMode === 'tab'} onPress={() => setRefMode('tab')} />
            </View>
            {refMode === 'tab' && system && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                {system.shades.map((s) => (
                  <Chip key={s.id} label={s.id} selected={refTab === s.id} onPress={() => setRefTab(s.id)} />
                ))}
              </ScrollView>
            )}
            <SectionTitle>{mode === 'shade' ? 'Quadro do dente' : calibratingGingiva ? 'Quadro do tab de gengiva' : 'Quadro do tab'}</SectionTitle>
            <View style={styles.chips}>
              <Chip label="Superior (colo em cima)" selected={!lowerTooth} onPress={() => setLowerTooth(false)} />
              <Chip label="Inferior (colo embaixo)" selected={lowerTooth} onPress={() => setLowerTooth(true)} />
              {mode === 'shade' && <Chip label={placing ? 'Procurando o dente…' : 'Achar o dente de novo'} onPress={placeOnTooth} />}
            </View>
            {placeNote && <Muted>{placeNote}</Muted>}
            <Muted>
              O quadro azul é colocado sozinho num incisivo central; se precisar, arraste-o e mude o tamanho pela alça redonda do
              canto ou com dois dedos (pinça) em cima do quadro. Pinça fora dos quadros aproxima a foto. O dente é lido em três
              terços (cervical, médio e incisal) e comparado com o tab inteiro da escala. O quadro verde vai sobre a referência,
              que corrige balanço de branco e exposição.
            </Muted>
            {mode === 'shade' && (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Medir cor da gengiva</Text>
                <Switch value={useGingiva} onValueChange={setUseGingiva} />
              </View>
            )}
          </Card>

          <Button title={mode === 'shade' ? 'Analisar cor' : `Medir tab ${calibShade}`} onPress={analyze} loading={busy} disabled={!settings} />

          {result && (
            <Card style={{ marginTop: spacing.md }}>
              <View style={styles.measuredRow}>
                <View style={[styles.bigSwatch, { backgroundColor: labToHex(result.match.measured) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.measuredTitle}>{calibratingGingiva ? 'Leitura do quadro' : 'Cor medida (terço médio)'}</Text>
                  <Text style={styles.labText}>L*a*b* {fmtLab(result.match.measured)}</Text>
                  <Muted>
                    {refLabel}
                    {result.match.calibrated ? ' · escala calibrada' : ' · valores padrão da escala'}
                  </Muted>
                </View>
              </View>
              {!calibratingGingiva && thirdsRow(result.profile)}

              {warning && (
                <View style={styles.warnBox}>
                  <Text style={styles.warnText}>{warning}</Text>
                </View>
              )}

              {calibratingGingiva ? (
                <>
                  <View style={styles.measuredRow}>
                    <View style={[styles.bigSwatch, { backgroundColor: result.gingivaLab ? labToHex(result.gingivaLab) : '#ccc' }]} />
                    <View>
                      <Text style={styles.measuredTitle}>Tab de gengiva {calibShade}</Text>
                      <Text style={styles.labText}>L*a*b* {result.gingivaLab ? fmtLab(result.gingivaLab) : '—'}</Text>
                    </View>
                  </View>
                  <Button title={`Salvar como ${calibShade}`} onPress={saveAsCalibration} style={{ marginTop: 12 }} />
                </>
              ) : mode === 'calibrate' ? (
                <>
                  <Muted>
                    Os três terços serão salvos como a cor do tab {calibShade} no seu aparelho. Meça todos os tabs nas mesmas condições de
                    luz, com o quadro cobrindo o tab inteiro.
                  </Muted>
                  <Button title={`Salvar como ${calibShade}`} onPress={saveAsCalibration} style={{ marginTop: 12 }} />
                </>
              ) : (
                <>
                  <SectionTitle>{`Resultado · ${system?.name ?? ''}`}</SectionTitle>
                  {result.match.matches.map((m, i) => (
                    <ShadeRow key={m.shade.id} rank={i + 1} shadeId={m.shade.id} lab={m.shade.lab} deltaE={m.deltaE} />
                  ))}
                  <Muted>
                    {result.match.confidence >= 0.5
                      ? 'O mais provável está bem separado da alternativa.'
                      : 'As duas opções estão próximas: confira na boca com os dois tabs lado a lado.'}
                  </Muted>
                  {result.gingivaLab && (
                    <>
                      <View style={[styles.measuredRow, { marginTop: 12 }]}>
                        <View style={[styles.bigSwatch, { backgroundColor: labToHex(result.gingivaLab) }]} />
                        <View>
                          <Text style={styles.measuredTitle}>Gengiva</Text>
                          <Text style={styles.labText}>L*a*b* {fmtLab(result.gingivaLab)}</Text>
                        </View>
                      </View>
                      {result.gingivaMatches?.map((m, i) => (
                        <ShadeRow key={m.shade.id} rank={i + 1} shadeId={m.shade.id} lab={m.shade.lab} deltaE={m.deltaE} />
                      ))}
                      <Muted>Escala de gengiva IPS Gingiva (G1–G5). Calibre os seus tabs em Configurações para usar a cor real deles.</Muted>
                    </>
                  )}
                </>
              )}
            </Card>
          )}

          {result && mode === 'shade' && (
            <Card>
              <SectionTitle>Salvar caso</SectionTitle>
              <TextInput placeholder="Nome do paciente" value={patientName} onChangeText={setPatientName} style={styles.input} placeholderTextColor={colors.muted} />
              <TextInput
                placeholder="Dente (FDI, ex.: 11)"
                value={toothNumber}
                onChangeText={setToothNumber}
                style={styles.input}
                keyboardType="number-pad"
                placeholderTextColor={colors.muted}
              />
              <TextInput
                placeholder="Observações para o laboratório"
                value={notes}
                onChangeText={setNotes}
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                multiline
                placeholderTextColor={colors.muted}
              />
              <Button title="Salvar caso" onPress={save} loading={busy} />
            </Card>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function fmtLab(l: Lab) {
  return `${l.L.toFixed(1)}  ${l.a.toFixed(1)}  ${l.b.toFixed(1)}`;
}

const styles = StyleSheet.create({
  imageArea: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#000', overflow: 'hidden' },
  zoomBadge: { position: 'absolute', right: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm },
  zoomBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  switchLabel: { color: colors.text, fontWeight: '600' },
  measuredRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  thirdsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  thirdItem: { flex: 1, alignItems: 'center' },
  thirdSwatch: { width: '100%', height: 28, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  thirdLabel: { color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 4 },
  thirdLab: { color: colors.muted, fontSize: 10, fontVariant: ['tabular-nums'] },
  warnBox: {
    backgroundColor: '#FFF7E0',
    borderColor: '#F0D48A',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: 10,
  },
  warnText: { color: '#7A5A00', fontSize: 13, lineHeight: 18 },
  bigSwatch: { width: 64, height: 64, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  measuredTitle: { fontWeight: '700', color: colors.text, fontSize: 15 },
  labText: { color: colors.text, fontVariant: ['tabular-nums'], marginVertical: 2 },
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
