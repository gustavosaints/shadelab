import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/components/Button';
import { Card, Muted, SectionTitle } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Marker } from '@/components/Marker';
import { ShadeRow } from '@/components/ShadeRow';
import { correctedLab, type ReferenceSpec } from '@/lib/color/calibrate';
import { labToHex, roundLab, type Lab } from '@/lib/color/convert';
import { matchShade, type MatchResult } from '@/lib/color/match';
import { findShade, getSystem, NEUTRAL_REFERENCES } from '@/lib/color/shades';
import { sampleRegion, type Sample } from '@/lib/image/sample';
import { newCaseId, persistPhoto, saveCase } from '@/lib/storage/cases';
import { loadSettings, saveCalibration, saveSettings, type ReferenceMode, type Settings } from '@/lib/storage/settings';
import { colors, radius, spacing } from '@/theme';

type Params = { uri: string; w: string; h: string; mode?: 'shade' | 'calibrate'; shade?: string };
type Pt = { x: number; y: number };

const MARKER_SCREEN = 40; // tamanho do quadrado na tela, em px

export default function Analyze() {
  const { uri, w, h, mode = 'shade', shade: calibShade } = useLocalSearchParams<Params>();
  const imgW = Number(w) || 1;
  const imgH = Number(h) || 1;

  const [settings, setSettings] = useState<Settings | null>(null);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [tooth, setTooth] = useState<Pt>({ x: imgW * 0.5, y: imgH * 0.45 });
  const [ref, setRef] = useState<Pt>({ x: imgW * 0.5, y: imgH * 0.6 });
  const [gingiva, setGingiva] = useState<Pt>({ x: imgW * 0.5, y: imgH * 0.3 });
  const [useGingiva, setUseGingiva] = useState(false);
  const [refMode, setRefMode] = useState<ReferenceMode>('gray18');
  const [refTab, setRefTab] = useState('A2');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    match: MatchResult;
    toothSample: Sample;
    refSample?: Sample;
    gingivaLab?: Lab;
  } | null>(null);
  const [patientName, setPatientName] = useState('');
  const [toothNumber, setToothNumber] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setRefMode(s.referenceMode);
      setRefTab(s.referenceTab);
    });
  }, []);

  // Geometria: imagem com "contain" dentro da área
  const geo = useMemo(() => {
    if (!layout.width || !layout.height) return { scale: 1, ox: 0, oy: 0 };
    const scale = Math.min(layout.width / imgW, layout.height / imgH);
    return { scale, ox: (layout.width - imgW * scale) / 2, oy: (layout.height - imgH * scale) / 2 };
  }, [layout, imgW, imgH]);

  const toScreen = (p: Pt) => ({ x: geo.ox + p.x * geo.scale, y: geo.oy + p.y * geo.scale });
  const moveBy = (set: (f: (p: Pt) => Pt) => void) => (dx: number, dy: number) =>
    set((p) => ({
      x: Math.max(0, Math.min(imgW, p.x + dx / geo.scale)),
      y: Math.max(0, Math.min(imgH, p.y + dy / geo.scale)),
    }));

  const markerImgSize = MARKER_SCREEN / geo.scale;
  const rectFor = (p: Pt) => ({
    x: p.x - markerImgSize / 2,
    y: p.y - markerImgSize / 2,
    width: markerImgSize,
    height: markerImgSize,
  });

  const system = settings ? getSystem(settings.shadeSystem) : null;
  const refLabel =
    refMode === 'none'
      ? 'Sem referência'
      : refMode === 'tab'
        ? `Tab ${refTab}`
        : NEUTRAL_REFERENCES[refMode].name;

  const analyze = async () => {
    if (!settings || !system) return;
    setBusy(true);
    setResult(null);
    try {
      const toothSample = await sampleRegion(uri, rectFor(tooth), imgW, imgH);
      let refSample: Sample | undefined;
      let refSpec: ReferenceSpec | undefined;
      if (refMode !== 'none') {
        refSample = await sampleRegion(uri, rectFor(ref), imgW, imgH);
        let known: Lab | undefined;
        if (refMode === 'tab') {
          const calib = settings.calibrations[settings.shadeSystem]?.[refTab];
          known = calib ?? findShade(settings.shadeSystem, refTab)?.lab;
        } else {
          known = NEUTRAL_REFERENCES[refMode].lab;
        }
        if (known) refSpec = { measured: refSample.rgb, known };
      }
      const lab = correctedLab(toothSample.rgb, refSpec);
      const match = matchShade(lab, settings.shadeSystem, {
        topN: 3,
        calibration: settings.calibrations[settings.shadeSystem],
      });
      let gingivaLab: Lab | undefined;
      if (useGingiva) {
        const g = await sampleRegion(uri, rectFor(gingiva), imgW, imgH);
        gingivaLab = correctedLab(g.rgb, refSpec);
      }
      setResult({ match, toothSample, refSample, gingivaLab });
      if (toothSample.spread > 0.03) {
        Alert.alert(
          'Região heterogênea',
          'A área do dente tem muita variação (reflexo, borda ou mancha). Mova o quadrado para o terço médio do dente e repita.',
        );
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
    await saveCalibration(settings.shadeSystem, calibShade, roundLab(result.match.measured, 2));
    Alert.alert('Calibração salva', `${calibShade} registrado com L*a*b* ${fmtLab(result.match.measured)}.`, [
      { text: 'OK', onPress: () => router.dismissTo('/settings') },
    ]);
  };

  const save = async () => {
    if (!result || !settings) return;
    setBusy(true);
    try {
      const id = newCaseId();
      const photoUri = await persistPhoto(uri, id);
      await saveCase({
        id,
        createdAt: new Date().toISOString(),
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
      });
      router.dismissTo({ pathname: '/cases/[id]', params: { id } });
    } catch (e) {
      Alert.alert('Erro ao salvar', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.imageArea} onLayout={(e) => setLayout(e.nativeEvent.layout)}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          {layout.width > 0 && (
            <>
              <Marker
                {...toScreen(tooth)}
                size={MARKER_SCREEN}
                color={colors.primary}
                label="Dente"
                onMove={moveBy(setTooth)}
              />
              {refMode !== 'none' && (
                <Marker
                  {...toScreen(ref)}
                  size={MARKER_SCREEN}
                  color={colors.accent}
                  label="Referência"
                  onMove={moveBy(setRef)}
                />
              )}
              {useGingiva && (
                <Marker
                  {...toScreen(gingiva)}
                  size={MARKER_SCREEN}
                  color="#E05C8A"
                  label="Gengiva"
                  onMove={moveBy(setGingiva)}
                />
              )}
            </>
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
            <Muted>
              Arraste os quadrados: azul no terço médio do dente, verde sobre a referência. A referência
              corrige balanço de branco e exposição.
            </Muted>
            {mode === 'shade' && (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Medir cor da gengiva</Text>
                <Switch value={useGingiva} onValueChange={setUseGingiva} />
              </View>
            )}
          </Card>

          <Button
            title={mode === 'calibrate' ? `Medir tab ${calibShade}` : 'Analisar cor'}
            onPress={analyze}
            loading={busy}
            disabled={!settings}
          />

          {result && (
            <Card style={{ marginTop: spacing.md }}>
              <View style={styles.measuredRow}>
                <View style={[styles.bigSwatch, { backgroundColor: labToHex(result.match.measured) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.measuredTitle}>Cor medida do dente</Text>
                  <Text style={styles.labText}>L*a*b* {fmtLab(result.match.measured)}</Text>
                  <Muted>
                    {refLabel}
                    {result.match.calibrated ? ' · escala calibrada' : ' · valores padrão da escala'}
                  </Muted>
                </View>
              </View>

              {mode === 'calibrate' ? (
                <>
                  <Muted>
                    Este valor será salvo como a cor do tab {calibShade} no seu aparelho. Meça todos os tabs
                    nas mesmas condições de luz.
                  </Muted>
                  <Button title={`Salvar como ${calibShade}`} onPress={saveAsCalibration} style={{ marginTop: 12 }} />
                </>
              ) : (
                <>
                  <SectionTitle>{`Melhores correspondências · ${system?.name ?? ''}`}</SectionTitle>
                  {result.match.matches.map((m, i) => (
                    <ShadeRow
                      key={m.shade.id}
                      rank={i + 1}
                      shadeId={m.shade.id}
                      lab={m.shade.lab}
                      deltaE={m.deltaE}
                      quality={m.quality}
                    />
                  ))}
                  <Muted>
                    Confiança {Math.round(result.match.confidence * 100)}%. ΔE00 ≤ 0,8 imperceptível; ≤ 1,8
                    clinicamente aceitável (Paravina et al., 2015).
                  </Muted>
                  {result.gingivaLab && (
                    <View style={[styles.measuredRow, { marginTop: 12 }]}>
                      <View style={[styles.bigSwatch, { backgroundColor: labToHex(result.gingivaLab) }]} />
                      <View>
                        <Text style={styles.measuredTitle}>Gengiva</Text>
                        <Text style={styles.labText}>L*a*b* {fmtLab(result.gingivaLab)}</Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </Card>
          )}

          {result && mode === 'shade' && (
            <Card>
              <SectionTitle>Salvar caso</SectionTitle>
              <TextInput
                placeholder="Nome do paciente"
                value={patientName}
                onChangeText={setPatientName}
                style={styles.input}
                placeholderTextColor={colors.muted}
              />
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
  imageArea: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#000' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  switchLabel: { color: colors.text, fontWeight: '600' },
  measuredRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
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
