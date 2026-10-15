import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Button } from '@/components/Button';
import { Card, Muted, SectionTitle } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { FaceFrame } from '@/components/FaceFrame';
import { Handle } from '@/components/Handle';
import { MouthOutline } from '@/components/MouthOutline';
import { SmileOverlay } from '@/components/SmileOverlay';
import { labToHex } from '@/lib/color/convert';
import { getSystem } from '@/lib/color/shades';
import { layoutAnatomy } from '@/lib/smile/anatomy';
import { ANATOMY_CATALOG } from '@/lib/smile/anatomyCatalog';
import { defaultMouth, fitToMouth } from '@/lib/smile/mouth';
import {
  alignMidlineToFace,
  analyzeFrame,
  DEFAULT_CENTRALS_WIDTH_MM,
  defaultFacePoints,
  LIMITS,
  setCentralWidthMm,
  type FacePoints,
} from '@/lib/smile/frame';
import {
  clampEdit,
  clampParams,
  DEFAULT_SMILE_PARAMS,
  layoutTeeth,
  mirrorEdit,
  mirrorFdi,
  NO_EDIT,
  SHAPE_MIX,
  shapeFromMix,
  WIDTH_RATIOS,
  type SmileParams,
  type ToothEdit,
} from '@/lib/smile/teeth';
import { newCaseId, persistPhoto, saveCase } from '@/lib/storage/cases';
import { useSettings } from '@/lib/useSettings';
import { colors, radius, spacing } from '@/theme';

type Photo = { uri: string; width: number; height: number };
type Touch = { pageX: number; pageY: number };

type GestureStart = {
  touches: Touch[];
  params: SmileParams;
  dist: number;
};

export default function Smile() {
  const [settings] = useSettings();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [params, setParams] = useState<SmileParams>(DEFAULT_SMILE_PARAMS);
  const [targetShade, setTargetShade] = useState('B1');
  const [hidden, setHidden] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fine, setFine] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [notes, setNotes] = useState('');
  // ----- Análise facial (face-bow digital, estilo DSD) -----
  const [face, setFace] = useState<FacePoints | null>(null);
  const [centralsWidthMm, setCentralsWidthMm] = useState(String(DEFAULT_CENTRALS_WIDTH_MM));
  const [centralMm, setCentralMm] = useState('8.5');
  // ----- Contorno da boca (recorte dos dentes pelos lábios) -----
  const [editMouth, setEditMouth] = useState(false);
  // ----- Edição dente a dente -----
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const editOf = (fdi: string): ToothEdit => params.edits?.[fdi] ?? NO_EDIT;
  const setEdit = (fdi: string, patch: Partial<ToothEdit>) =>
    setParams((p) => ({ ...p, edits: { ...p.edits, [fdi]: clampEdit({ ...(p.edits?.[fdi] ?? NO_EDIT), ...patch }) } }));
  const canvasRef = useRef<View>(null);
  const gesture = useRef<GestureStart | null>(null);

  const system = getSystem(settings.shadeSystem);

  const set = (patch: Partial<SmileParams>) => setParams((p) => clampParams({ ...p, ...patch }));

  const chooseShade = (id: string) => {
    const shade = system.shades.find((s) => s.id === id);
    if (!shade) return;
    setTargetShade(id);
    const lab = settings.calibrations[settings.shadeSystem]?.[id] ?? shade.lab;
    set({ tint: labToHex({ L: Math.min(96, lab.L + 6), a: lab.a, b: lab.b }) });
  };

  const pick = async (fromCamera: boolean) => {
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Sem acesso à câmera', 'Permita a câmera nas configurações do aparelho.');
        return;
      }
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 1, cameraType: ImagePicker.CameraType.front })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setPhoto({ uri: a.uri, width: a.width, height: a.height });
    setParams(DEFAULT_SMILE_PARAMS);
    chooseShade(targetShade);
  };

  // ----- Gestos na foto: 1 dedo move, 2 dedos (pinça) dimensionam -----
  const touchesOf = (e: GestureResponderEvent): Touch[] =>
    (e.nativeEvent.touches ?? []).map((t) => ({ pageX: t.pageX, pageY: t.pageY }));
  const dist = (t: Touch[]) => (t.length >= 2 ? Math.hypot(t[1].pageX - t[0].pageX, t[1].pageY - t[0].pageY) : 0);
  const centroid = (t: Touch[]) => ({
    x: t.reduce((s, p) => s + p.pageX, 0) / t.length,
    y: t.reduce((s, p) => s + p.pageY, 0) / t.length,
  });

  const begin = (e: GestureResponderEvent) => {
    const t = touchesOf(e);
    gesture.current = { touches: t.length ? t : [{ pageX: e.nativeEvent.pageX, pageY: e.nativeEvent.pageY }], params, dist: dist(t) };
    setDragging(true);
  };
  const onCanvasMove = (e: GestureResponderEvent) => {
    const g = gesture.current;
    if (!g || !area.width) return;
    const t = touchesOf(e);
    const now = t.length ? t : [{ pageX: e.nativeEvent.pageX, pageY: e.nativeEvent.pageY }];
    if (now.length !== g.touches.length) {
      // mudou o número de dedos: recomeça o gesto a partir do estado atual
      gesture.current = { touches: now, params, dist: dist(now) };
      return;
    }
    const c0 = centroid(g.touches);
    const c1 = centroid(now);
    if (selectedTooth && now.length === 1) {
      // um dedo com dente selecionado: move só esse dente (em frações do central)
      const cw = g.params.centralWidth * area.width;
      const ch = cw * g.params.heightRatio;
      const base = g.params.edits?.[selectedTooth] ?? NO_EDIT;
      setEdit(selectedTooth, { dx: base.dx + (c1.x - c0.x) / cw, dy: base.dy + (c1.y - c0.y) / ch });
      return;
    }
    const patch: Partial<SmileParams> = {
      midlineX: g.params.midlineX + (c1.x - c0.x) / area.width,
      gumY: g.params.gumY + (c1.y - c0.y) / area.height,
    };
    if (now.length >= 2 && g.dist > 10) {
      patch.centralWidth = g.params.centralWidth * (dist(now) / g.dist);
    }
    set(patch);
  };
  const end = () => {
    gesture.current = null;
    setDragging(false);
  };

  // ----- Alças: comprimento (incisal dos centrais) e largura/curva (canino) -----
  const anatomy = params.anatomy ? ANATOMY_CATALOG.find((a) => a.id === params.anatomy) : undefined;
  const teeth = !area.width
    ? []
    : anatomy
      ? layoutAnatomy(params, anatomy, area.width, area.height)
      : layoutTeeth(params, area.width, area.height);
  const t11 = teeth.find((t) => t.fdi === '11');
  const t23 = teeth.find((t) => t.fdi === '23');
  const cwPx = params.centralWidth * area.width;
  const ratios = WIDTH_RATIOS[params.proportion];
  const shapeMix = params.shapeMix ?? SHAPE_MIX[params.shape];
  const calibMm = parseFloat(centralsWidthMm.replace(',', '.')) || 0;
  const analysis = face && area.width ? analyzeFrame(face, calibMm, params, area.width, area.height) : null;
  const archFactor = 1 + ratios.lateral + ratios.canine + 2.5 * params.spacing;

  const onLengthHandle = (_dx: number, dy: number) => {
    if (!cwPx) return;
    set({ heightRatio: params.heightRatio + dy / cwPx });
  };
  const onArchHandle = (dx: number, dy: number) => {
    if (!area.width || !cwPx) return;
    const midPx = params.midlineX * area.width;
    const outerX = t23 ? t23.x + t23.w : midPx;
    const half = outerX - midPx; // meia largura atual do arco (vale para contorno e anatomia)
    const newHalf = half + dx;
    const ch = cwPx * params.heightRatio;
    set({
      centralWidth: half > 1 ? params.centralWidth * (Math.max(1, newHalf) / half) : Math.max(1, newHalf) / archFactor / area.width,
      curve: params.curve - dy / (ch * 2),
    });
  };

  const exportImage = async (): Promise<string | null> => {
    setExporting(true);
    await new Promise((r) => setTimeout(r, 60));
    try {
      return await captureRef(canvasRef, { format: 'jpg', quality: 0.95 });
    } catch (e) {
      Alert.alert('Não foi possível exportar', String(e));
      return null;
    } finally {
      setExporting(false);
    }
  };

  const share = async () => {
    const uri = await exportImage();
    if (!uri) return;
    if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg' });
    } else {
      Alert.alert('Imagem gerada', uri);
    }
  };

  const save = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      const id = newCaseId();
      const rendered = await exportImage();
      const photoUri = await persistPhoto(photo.uri, id);
      const renderedUri = rendered ? await persistPhoto(rendered, id, '-smile') : undefined;
      await saveCase({
        kind: 'smile',
        id,
        createdAt: new Date().toISOString(),
        patientName: patientName.trim() || 'Sem nome',
        notes: notes.trim(),
        photoUri,
        renderedUri,
        params,
        targetShade,
        face: face ?? undefined,
        centralsWidthMm: face ? calibMm : undefined,
        frame: analysis
          ? {
              midlineShiftMm: analysis.midlineShiftMm,
              bipupillaryDeg: analysis.bipupillaryDeg,
              commissuralDeg: analysis.commissuralDeg,
              widthHeightPct: analysis.widthHeightPct,
              centralWidthMm: analysis.centralWidthMm,
              centralHeightMm: analysis.centralHeightMm,
              notes: analysis.notes,
            }
          : undefined,
      });
      router.dismissTo({ pathname: '/cases/[id]', params: { id } });
    } catch (e) {
      Alert.alert('Erro ao salvar', String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!photo) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Card>
          <SectionTitle>Foto do sorriso</SectionTitle>
          <Muted>
            Paciente de frente, sorriso amplo, câmera na altura da boca. Boa luz e fundo neutro ajudam a
            simulação a parecer real.
          </Muted>
          <Button title="Fotografar" onPress={() => pick(true)} style={{ marginTop: 12 }} />
          <Button title="Escolher da galeria" variant="secondary" onPress={() => pick(false)} style={{ marginTop: 8 }} />
        </Card>
      </ScrollView>
    );
  }

  const aspect = photo.width / photo.height;
  const showHandles = !hidden && !exporting && !!t11 && !!t23;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" scrollEnabled={!dragging}>
      <View
        ref={canvasRef}
        collapsable={false}
        style={[styles.canvas, { aspectRatio: aspect }]}
        onLayout={(e) => setArea(e.nativeEvent.layout)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={begin}
        onResponderMove={onCanvasMove}
        onResponderRelease={end}
        onResponderTerminate={end}
      >
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <SmileOverlay
          params={params}
          width={area.width}
          height={area.height}
          hidden={hidden}
          anatomy={anatomy}
          selected={exporting ? undefined : (selectedTooth ?? undefined)}
        />
        {face && !hidden && area.width > 0 && (
          <FaceFrame
            face={face}
            width={area.width}
            height={area.height}
            teeth={teeth}
            dentalMidlineX={params.midlineX * area.width}
            onChange={setFace}
            readOnly={exporting}
          />
        )}
        {params.mouth && !hidden && area.width > 0 && (
          <MouthOutline
            mouth={params.mouth}
            width={area.width}
            height={area.height}
            onChange={(m) => set({ mouth: m })}
            readOnly={!editMouth || exporting}
            hideLine={exporting}
          />
        )}
        {showHandles && !editMouth && (
          <>
            <Handle x={params.midlineX * area.width} y={t11.y + t11.h + 14} glyph="↕" onMove={onLengthHandle} />
            <Handle x={t23.x + t23.w + 14} y={t23.y + t23.h * 0.5} glyph="↔" onMove={onArchHandle} />
          </>
        )}
      </View>

      <View style={{ padding: spacing.md }}>
        <Muted>Arraste para mover · pinça para dimensionar · alça ↕ comprimento · alça ↔ largura e curva</Muted>
        <View style={styles.row}>
          <Pressable
            onPressIn={() => setHidden(true)}
            onPressOut={() => setHidden(false)}
            style={({ pressed }) => [styles.compare, pressed && { backgroundColor: colors.navy }]}
          >
            <Text style={styles.compareText}>Segure para ver o antes</Text>
          </Pressable>
          <Button title="Trocar foto" variant="ghost" onPress={() => setPhoto(null)} />
        </View>

        <Card>
          <SectionTitle>Boca</SectionTitle>
          {!params.mouth ? (
            <>
              <Muted>
                Delimite a abertura dos lábios: os dentes ficam recortados dentro dela, o lábio superior esconde a
                cervical e nada vaza pelos cantos.
              </Muted>
              <Button
                title="Delimitar boca"
                variant="secondary"
                style={{ marginTop: 8 }}
                onPress={() => {
                  if (!area.width || !teeth.length) return;
                  set({ mouth: defaultMouth(teeth, area.width, area.height) });
                  setEditMouth(true);
                }}
              />
            </>
          ) : (
            <>
              <Muted>
                {editMouth
                  ? 'Arraste os pontos vermelhos: ◆ comissuras, • lábio superior e inferior. Os dentes só aparecem dentro da linha.'
                  : 'Dentes recortados pelo contorno da boca.'}
              </Muted>
              <View style={styles.chips}>
                <Chip label={editMouth ? 'Concluir contorno' : 'Editar contorno'} selected={editMouth} onPress={() => setEditMouth(!editMouth)} />
                <Chip
                  label="Encaixar dentes na boca"
                  onPress={() => {
                    if (!params.mouth || !area.width || !t23 || !t11) return;
                    const half = t23.x + t23.w - params.midlineX * area.width;
                    set(fitToMouth(params, params.mouth, area.width, area.height, half, t11.h));
                  }}
                />
                <Chip
                  label="Remover"
                  onPress={() => {
                    set({ mouth: undefined });
                    setEditMouth(false);
                  }}
                />
              </View>
            </>
          )}
        </Card>

        <Card>
          <SectionTitle>Cor-alvo</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {system.shades.map((s) => (
              <Chip key={s.id} label={s.id} selected={targetShade === s.id} onPress={() => chooseShade(s.id)} />
            ))}
          </ScrollView>
          <SectionTitle>Anatomia</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable
              onPress={() => set({ anatomy: undefined })}
              style={[styles.anatomyCard, !anatomy && styles.anatomyCardSelected]}
            >
              <View style={styles.anatomyThumbPlaceholder}>
                <Text style={styles.anatomyGlyph}>◠◠</Text>
              </View>
              <Text style={styles.anatomyName}>Contorno</Text>
            </Pressable>
            {ANATOMY_CATALOG.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => set({ anatomy: a.id })}
                style={[styles.anatomyCard, anatomy?.id === a.id && styles.anatomyCardSelected]}
              >
                <Image source={a.thumb} style={styles.anatomyThumb} resizeMode="contain" />
                <Text style={styles.anatomyName} numberOfLines={1}>
                  {a.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {!anatomy && (
            <>
              <SectionTitle>Forma</SectionTitle>
              <View style={styles.chips}>
                <Chip
                  label="Quadrada"
                  selected={shapeFromMix(shapeMix) === 'square'}
                  onPress={() => set({ shape: 'square', shapeMix: SHAPE_MIX.square })}
                />
                <Chip label="Oval" selected={shapeFromMix(shapeMix) === 'oval'} onPress={() => set({ shape: 'oval', shapeMix: SHAPE_MIX.oval })} />
                <Chip
                  label="Triangular"
                  selected={shapeFromMix(shapeMix) === 'triangular'}
                  onPress={() => set({ shape: 'triangular', shapeMix: SHAPE_MIX.triangular })}
                />
              </View>
              <Control
                label="Transição da forma (quadrada → oval → triangular)"
                value={shapeMix}
                min={0}
                max={1}
                onChange={(v) => set({ shapeMix: v, shape: shapeFromMix(v) })}
              />
            </>
          )}
          <SectionTitle>Proporção</SectionTitle>
          <View style={styles.chips}>
            <Chip
              label="Natural (78% / 74%)"
              selected={params.proportion === 'natural'}
              onPress={() => set({ proportion: 'natural' })}
            />
            <Chip
              label="Áurea (62% / 38%)"
              selected={params.proportion === 'golden'}
              onPress={() => set({ proportion: 'golden' })}
            />
            <Chip label="RED (70% / 50%)" selected={params.proportion === 'red'} onPress={() => set({ proportion: 'red' })} />
          </View>
        </Card>

        <Card>
          <SectionTitle>Análise facial (face-bow digital)</SectionTitle>
          {!face ? (
            <>
              <Muted>
                Marque pupilas, glabela, filtro, comissuras e os distais dos centrais sobre a foto. O app calcula o
                desvio da linha média em mm, a inclinação da foto e a relação largura/comprimento do central.
              </Muted>
              <Button title="Ativar linhas faciais" variant="secondary" onPress={() => setFace(defaultFacePoints())} style={{ marginTop: 8 }} />
            </>
          ) : (
            <>
              <Muted>Arraste os pontos: ◉ pupilas · G glabela · F filtro · C comissuras · 11/21 distais dos centrais.</Muted>
              <View style={styles.inlineRow}>
                <Text style={styles.controlLabel}>Largura real dos dois centrais (mm)</Text>
                <TextInput
                  value={centralsWidthMm}
                  onChangeText={setCentralsWidthMm}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.inputSmall]}
                  placeholderTextColor={colors.muted}
                />
              </View>
              {analysis && (
                <View style={styles.metrics}>
                  <Metric label="Linha média dental × facial" value={analysis.pxPerMm ? `${analysis.midlineShiftMm.toFixed(1)} mm` : '—'} warn={Math.abs(analysis.midlineShiftMm) >= LIMITS.midlineShiftMm} />
                  <Metric label="Inclinação (bipupilar)" value={`${analysis.bipupillaryDeg.toFixed(1)}°`} warn={Math.abs(analysis.bipupillaryDeg) >= LIMITS.cantDeg} />
                  <Metric label="Comissuras" value={`${analysis.commissuralDeg.toFixed(1)}°`} />
                  <Metric
                    label="Central: largura / comprimento"
                    value={`${analysis.widthHeightPct.toFixed(0)}%${analysis.pxPerMm ? ` (${analysis.centralWidthMm.toFixed(1)} × ${analysis.centralHeightMm.toFixed(1)} mm)` : ''}`}
                    warn={analysis.widthHeightPct < LIMITS.widthHeightPct.min || analysis.widthHeightPct > LIMITS.widthHeightPct.max}
                  />
                  {analysis.notes.map((n, i) => (
                    <Text key={i} style={styles.note}>
                      • {n}
                    </Text>
                  ))}
                </View>
              )}
              <View style={styles.inlineRow}>
                <Text style={styles.controlLabel}>Largura do central (mm)</Text>
                <TextInput
                  value={centralMm}
                  onChangeText={setCentralMm}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.inputSmall]}
                  placeholderTextColor={colors.muted}
                />
                <Button
                  title="Aplicar"
                  variant="ghost"
                  onPress={() => {
                    const mm = parseFloat(centralMm.replace(',', '.'));
                    if (face && mm > 0 && area.width) setParams(clampParams(setCentralWidthMm(params, face, calibMm, mm, area.width, area.height)));
                  }}
                />
              </View>
              <View style={styles.row}>
                <Button
                  title="Alinhar linha média à face"
                  variant="secondary"
                  onPress={() => face && area.width && setParams(clampParams(alignMidlineToFace(params, face, area.width, area.height)))}
                />
                <Button title="Desativar" variant="ghost" onPress={() => setFace(null)} />
              </View>
            </>
          )}
        </Card>

        <Card>
          <SectionTitle>Dente a dente</SectionTitle>
          <Muted>
            {selectedTooth
              ? `Dente ${selectedTooth} selecionado: arraste na foto para mover, use os controles para tamanho e rotação (curva do sorriso).`
              : 'Toque num dente para ajustá-lo individualmente.'}
          </Muted>
          <View style={styles.chips}>
            {['13', '12', '11', '21', '22', '23'].map((fdi) => (
              <Chip
                key={fdi}
                label={fdi}
                selected={selectedTooth === fdi}
                color={params.edits?.[fdi] && params.edits[fdi] !== NO_EDIT ? colors.navy : undefined}
                onPress={() => setSelectedTooth(selectedTooth === fdi ? null : fdi)}
              />
            ))}
          </View>
          {selectedTooth && (
            <>
              <Control label="Rotação (°)" value={editOf(selectedTooth).rot} min={-25} max={25} onChange={(v) => setEdit(selectedTooth, { rot: v })} />
              <Control label="Deslocar ↔" value={editOf(selectedTooth).dx} min={-0.6} max={0.6} onChange={(v) => setEdit(selectedTooth, { dx: v })} />
              <Control label="Deslocar ↕" value={editOf(selectedTooth).dy} min={-0.6} max={0.6} onChange={(v) => setEdit(selectedTooth, { dy: v })} />
              <Control label="Largura" value={editOf(selectedTooth).sw} min={0.6} max={1.4} onChange={(v) => setEdit(selectedTooth, { sw: v })} />
              <Control label="Comprimento" value={editOf(selectedTooth).sh} min={0.6} max={1.4} onChange={(v) => setEdit(selectedTooth, { sh: v })} />
              <View style={styles.chips}>
                <Chip
                  label={`Espelhar no ${mirrorFdi(selectedTooth)}`}
                  onPress={() => setEdit(mirrorFdi(selectedTooth), mirrorEdit(editOf(selectedTooth)))}
                />
                <Chip label="Zerar este" onPress={() => setEdit(selectedTooth, NO_EDIT)} />
                <Chip
                  label="Zerar todos"
                  onPress={() => {
                    setParams((p) => ({ ...p, edits: undefined }));
                    setSelectedTooth(null);
                  }}
                />
              </View>
            </>
          )}
        </Card>

        <Button title={fine ? 'Ocultar ajuste fino' : 'Ajuste fino'} variant="ghost" onPress={() => setFine(!fine)} />
        {fine && (
          <Card>
            <Control label="Largura" value={params.centralWidth} min={0.04} max={0.2} onChange={(v) => set({ centralWidth: v })} />
            <Control label="Comprimento" value={params.heightRatio} min={0.8} max={1.6} onChange={(v) => set({ heightRatio: v })} />
            <Control label="Espaçamento" value={params.spacing} min={0} max={0.15} onChange={(v) => set({ spacing: v })} />
            <Control label="Curva do sorriso" value={params.curve} min={-0.1} max={0.35} onChange={(v) => set({ curve: v })} />
            <Control label="Opacidade" value={params.opacity} min={0.2} max={1} onChange={(v) => set({ opacity: v })} />
          </Card>
        )}

        <Button title="Compartilhar imagem" variant="secondary" onPress={share} style={{ marginTop: spacing.sm }} />

        <Card style={{ marginTop: spacing.md }}>
          <SectionTitle>Salvar no caso</SectionTitle>
          <TextInput
            placeholder="Nome do paciente"
            value={patientName}
            onChangeText={setPatientName}
            style={styles.input}
            placeholderTextColor={colors.muted}
          />
          <TextInput
            placeholder="Observações"
            value={notes}
            onChangeText={setNotes}
            style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
            multiline
            placeholderTextColor={colors.muted}
          />
          <Button title="Salvar simulação" onPress={save} loading={busy} />
        </Card>
      </View>
    </ScrollView>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, warn && { color: colors.danger }]}>{value}</Text>
    </View>
  );
}

function Control({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.controlLabel}>{label}</Text>
      <Slider
        value={value}
        minimumValue={min}
        maximumValue={max}
        onValueChange={onChange}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
        style={{ width: '100%', height: 36 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: '100%', backgroundColor: '#000', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.md },
  compare: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  compareText: { color: '#fff', fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  anatomyCard: {
    width: 118,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#2A2224',
    overflow: 'hidden',
  },
  anatomyCardSelected: { borderColor: colors.primary },
  anatomyThumb: { width: 114, height: 44 },
  anatomyThumbPlaceholder: { width: 114, height: 44, alignItems: 'center', justifyContent: 'center' },
  anatomyGlyph: { color: '#EEE3CD', fontSize: 22, letterSpacing: 2 },
  anatomyName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: colors.navy,
  },
  controlLabel: { color: colors.text, fontWeight: '600', fontSize: 13 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  inputSmall: { width: 80, marginBottom: 0, paddingVertical: 8, textAlign: 'center' },
  metrics: { marginTop: 10, backgroundColor: '#F4F6FA', borderRadius: radius.sm, padding: 10 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  metricLabel: { color: colors.muted, fontSize: 13 },
  metricValue: { color: colors.text, fontWeight: '700', fontSize: 13 },
  note: { color: colors.text, fontSize: 12, marginTop: 6, lineHeight: 17 },
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
