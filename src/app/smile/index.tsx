import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Button } from '@/components/Button';
import { Card, Muted, SectionTitle } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { FaceFrame } from '@/components/FaceFrame';
import { FaceLandmarker, type FaceLandmarkerHandle } from '@/components/FaceLandmarker';
import { Handle } from '@/components/Handle';
import { MouthOutline } from '@/components/MouthOutline';
import { SmileOverlay } from '@/components/SmileOverlay';
import { SmilePanes, type Pane } from '@/components/SmilePanes';
import { labToHex } from '@/lib/color/convert';
import { getSystem } from '@/lib/color/shades';
import { detectFace, fitTeethToPhoto, flipPhoto } from '@/lib/face/detect';
import { layoutAnatomy } from '@/lib/smile/anatomy';
import { ANATOMY_CATALOG } from '@/lib/smile/anatomyCatalog';
import {
  alignMidlineToFace,
  analyzeFrame,
  DEFAULT_CENTRALS_WIDTH_MM,
  defaultFacePoints,
  LIMITS,
  setCentralWidthMm,
  type FacePoints,
} from '@/lib/smile/frame';
import { addMouthPoint, defaultMouth, fitToMouth, removeMouthPoint } from '@/lib/smile/mouth';
import { takePendingPhoto } from '@/lib/smile/pendingPhoto';
import { applyScenario, SCENARIOS } from '@/lib/smile/scenarios';
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
  type SmileParams,
  type ToothEdit,
} from '@/lib/smile/teeth';
import { getCase, isSmileCase, newCaseId, persistPhoto, saveCase, type SmileVariant } from '@/lib/storage/cases';
import { clearSmileDraft, loadSmileDraft, saveSmileDraft, type SmileDraft } from '@/lib/storage/draft';
import { useSettings } from '@/lib/useSettings';
import { colors, radius, spacing } from '@/theme';

type Photo = { uri: string; width: number; height: number };
type Touch = { pageX: number; pageY: number };
type GestureStart = { touches: Touch[]; params: SmileParams; dist: number; start: { x: number; y: number }; moved: boolean };
type Step = 'foto' | 'boca' | 'forma' | 'ajustar' | 'comparar';
type MoveMode = 'arch' | 'one';
/** O que está selecionado para mover/dimensionar no passo Ajustar. */
type Selection = { kind: 'none' } | { kind: 'arch' } | { kind: 'tooth'; fdi: string };
type CompareMode = 'edit' | 'curtain' | 'side' | 'variants';

const STEPS: { id: Step; label: string }[] = [
  { id: 'foto', label: '1 Foto' },
  { id: 'boca', label: '2 Boca' },
  { id: 'forma', label: '3 Forma e cor' },
  { id: 'ajustar', label: '4 Ajustar' },
  { id: 'comparar', label: '5 Comparar' },
];

/** Anatomia usada pelos cenários que trocam a forma (facetas etc.). */
const SCENARIO_ANATOMY = 'jan-hajto-f1';

/**
 * Smile Design em passos, com a foto fixa no alto e os comandos rolando embaixo:
 * Foto (câmera guiada) → Boca (detecção automática, editável) → Forma e cor (contorno
 * ou anatomia, já encaixados na boca) → Ajustar (conjunto ou dente a dente) → Comparar.
 * Pinça na foto é sempre zoom da imagem; para dimensionar os dentes, toque neles antes.
 */
export default function Smile() {
  const { caseId } = useLocalSearchParams<{ caseId?: string }>();
  const [settings] = useSettings();
  const { width: winW, height: winH } = useWindowDimensions();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [params, setParams] = useState<SmileParams>(DEFAULT_SMILE_PARAMS);
  const [targetShade, setTargetShade] = useState('B1');
  const [step, setStep] = useState<Step>('foto');
  const [moveMode, setMoveMode] = useState<MoveMode>('arch');
  const [selection, setSelection] = useState<Selection>({ kind: 'none' });
  const [hidden, setHidden] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fine, setFine] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState<string | null>(null);
  const [detectNote, setDetectNote] = useState<string | null>(null);
  const [patientName, setPatientName] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  // análise facial
  const [face, setFace] = useState<FacePoints | null>(null);
  const [showFace, setShowFace] = useState(false);
  const [centralsWidthMm, setCentralsWidthMm] = useState(String(DEFAULT_CENTRALS_WIDTH_MM));
  const [centralMm, setCentralMm] = useState('8.5');
  // comparação
  const [compareMode, setCompareMode] = useState<CompareMode>('edit');
  const [curtain, setCurtain] = useState(0.5);
  const [variants, setVariants] = useState<SmileVariant[]>([]);
  // zoom da vista (a foto e os dentes crescem juntos; os comandos continuam em px da vista ampliada)
  const [zoom, setZoom] = useState({ scale: 1, tx: 0, ty: 0 });
  // desfazer / refazer: fotografias dos parâmetros, gravadas quando a edição dá uma pausa
  const [history, setHistory] = useState<{ past: SmileParams[]; future: SmileParams[] }>({ past: [], future: [] });
  const lastSnapshot = useRef<SmileParams | null>(null);
  const skipSnapshot = useRef(false);

  const canvasRef = useRef<View>(null);
  const panesRef = useRef<View>(null);
  const landmarker = useRef<FaceLandmarkerHandle>(null);
  const gesture = useRef<GestureStart | null>(null);
  const zoomStart = useRef(zoom);
  const pendingDetect = useRef<Photo | null>(null);

  const system = getSystem(settings.shadeSystem);
  const set = (patch: Partial<SmileParams>) => setParams((p) => clampParams({ ...p, ...patch }));
  const anatomyOf = (id?: string) => (id ? ANATOMY_CATALOG.find((a) => a.id === id) : undefined);
  const anatomy = anatomyOf(params.anatomy);
  // tamanho do canvas: largura da tela, altura no máximo metade da tela, mantendo a proporção da foto
  const aspect = photo ? photo.width / photo.height : 4 / 3;
  const canvasW = Math.min(winW, winH * 0.5 * aspect);
  const canvasH = canvasW / aspect;
  const editOf = (fdi: string): ToothEdit => params.edits?.[fdi] ?? NO_EDIT;
  const setEdit = (fdi: string, patch: Partial<ToothEdit>) =>
    setParams((p) => ({ ...p, edits: { ...p.edits, [fdi]: clampEdit({ ...(p.edits?.[fdi] ?? NO_EDIT), ...patch }) } }));
  const selectedTooth = selection.kind === 'tooth' ? selection.fdi : null;

  const chooseShade = (id: string) => {
    const shade = system.shades.find((s) => s.id === id);
    if (!shade) return;
    setTargetShade(id);
    const lab = settings.calibrations[settings.shadeSystem]?.[id] ?? shade.lab;
    set({ tint: labToHex({ L: Math.min(96, lab.L + 6), a: lab.a, b: lab.b }) });
  };

  // ----- Reabrir um caso salvo -----
  useEffect(() => {
    if (!caseId) return;
    (async () => {
      const c = await getCase(caseId);
      if (!c || !isSmileCase(c)) return;
      const size = await new Promise<{ w: number; h: number }>((res) =>
        Image.getSize(
          c.photoUri,
          (w, h) => res({ w, h }),
          () => res({ w: 4, h: 3 }),
        ),
      );
      setPhoto({ uri: c.photoUri, width: size.w, height: size.h });
      setParams(c.params);
      setTargetShade(c.targetShade);
      setPatientName(c.patientName === 'Sem nome' ? '' : c.patientName);
      setNotes(c.notes);
      setVariants(c.variants ?? []);
      if (c.face) {
        setFace(c.face);
        setCentralsWidthMm(String(c.centralsWidthMm ?? DEFAULT_CENTRALS_WIDTH_MM));
      }
      setEditingId(c.id);
      setCreatedAt(c.createdAt);
      setStep('ajustar');
    })();
  }, [caseId]);

  const startWithPhoto = async (p: Photo) => {
    // guarda uma cópia durável da foto (a da câmera fica no cache e pode sumir) para o rascunho
    const uri = await persistPhoto(p.uri, 'draft-smile');
    setEditingId(null);
    setCreatedAt(null);
    setPhoto({ ...p, uri });
    setParams(DEFAULT_SMILE_PARAMS);
    setFace(null);
    setSelection({ kind: 'none' });
    setVariants([]);
    setCompareMode('edit');
    setDetectNote(null);
    setZoom({ scale: 1, tx: 0, ty: 0 });
    setHistory({ past: [], future: [] });
    lastSnapshot.current = null;
    chooseShade(targetShade);
    setStep('boca');
    pendingDetect.current = { ...p, uri }; // detecção automática assim que a área da foto estiver medida
  };

  const pickFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    startWithPhoto({ uri: a.uri, width: a.width, height: a.height });
  };

  const mirror = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      const uri = await flipPhoto(photo.uri);
      setPhoto({ ...photo, uri });
      setParams((p) => ({
        ...p,
        midlineX: 1 - p.midlineX,
        mouth: p.mouth ? p.mouth.map((m) => ({ x: 1 - m.x, y: m.y })).reverse() : undefined,
        edits: undefined,
      }));
      setFace((f) => (f ? (Object.fromEntries(Object.entries(f).map(([k, v]) => [k, { x: 1 - v.x, y: v.y }])) as FacePoints) : f));
    } finally {
      setBusy(false);
    }
  };

  // ----- Detecção automática: boca e rosto -----
  const runDetection = async (p: Photo) => {
    if (!landmarker.current) return;
    setDetecting('Procurando rosto e boca…');
    try {
      const det = await detectFace(landmarker.current, p.uri);
      if (!det) {
        setDetectNote('Não achei um rosto na foto. Delimite a boca à mão.');
        if (!params.mouth && area.width) set({ mouth: defaultMouth(layoutTeeth(params, area.width, area.height), area.width, area.height) });
        return;
      }
      set({ mouth: det.mouth, midlineX: det.face.philtrum.x });
      setFace(det.face);
      setDetectNote('Boca encontrada. Ajuste os pontos se precisar e siga para a forma.');
    } catch (e) {
      setDetectNote(`Detecção automática indisponível (${String((e as Error).message ?? e)}). Delimite a boca à mão.`);
      if (!params.mouth && area.width) set({ mouth: defaultMouth(layoutTeeth(params, area.width, area.height), area.width, area.height) });
    } finally {
      setDetecting(null);
    }
  };

  /** Parâmetros com o arco encaixado na boca (72% entre as comissuras, gengiva sob o lábio). */
  const archFittedParams = (base: SmileParams): SmileParams => {
    if (!base.mouth || !area.width) return base;
    const cur = anatomy ? layoutAnatomy(base, anatomy, area.width, area.height) : layoutTeeth(base, area.width, area.height);
    const t23 = cur.find((t) => t.fdi === '23');
    const t11 = cur.find((t) => t.fdi === '11');
    if (!t23 || !t11) return base;
    const half = t23.x + t23.w - base.midlineX * area.width;
    return clampParams(fitToMouth(base, base.mouth, area.width, area.height, half, t11.h));
  };
  const fitArchToMouth = () => setParams((p) => archFittedParams(p));

  /**
   * Encaixa os dentes na boca. A LARGURA vem sempre da geometria da boca (estável); a análise dos
   * pixels, quando confiável, só refina linha média, gengiva e comprimento (e as larguras relativas
   * de laterais/caninos quando quase todos os espaços foram vistos).
   */
  const fitTeeth = async () => {
    if (!photo || !params.mouth || !area.width) return;
    setDetecting('Encaixando os dentes na boca…');
    const byMouth = archFittedParams({ ...params, edits: undefined });
    try {
      const fit = await fitTeethToPhoto(photo, params.mouth, face?.philtrum.x ?? params.midlineX, byMouth);
      if (fit && fit.fit.confidence >= 0.6) {
        const refined: SmileParams = {
          ...byMouth,
          midlineX: fit.params.midlineX,
          gumY: fit.params.gumY,
          heightRatio: fit.params.heightRatio,
          edits: fit.fit.confidence >= 0.8 ? fit.params.edits : undefined,
        };
        setParams(clampParams(refined));
        setDetectNote(`Encaixados pela boca; linha média e gengiva ajustadas pelos dentes da foto (${Math.round(fit.fit.confidence * 100)}%).`);
      } else {
        setParams(byMouth);
        setDetectNote('Encaixados pela largura da boca. Ajuste no passo 4 se precisar.');
      }
    } catch {
      setParams(byMouth);
      setDetectNote('Encaixados pela largura da boca. Ajuste no passo 4 se precisar.');
    } finally {
      setDetecting(null);
    }
  };

  // ----- Foto vinda da câmera guiada e detecção automática ao medir a área -----
  useFocusEffect(
    useCallback(() => {
      const p = takePendingPhoto();
      if (p) startWithPhoto({ uri: p.uri, width: p.width, height: p.height });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  useEffect(() => {
    if (pendingDetect.current && area.width > 0) {
      const p = pendingDetect.current;
      pendingDetect.current = null;
      runDetection(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area.width, photo?.uri]);

  // ----- Rascunho automático: só segurança. Não abre sozinho; é oferecido na tela inicial do Smile Design. -----
  const hydrated = useRef(false);
  const [draft, setDraft] = useState<SmileDraft | null>(null);
  useEffect(() => {
    if (caseId) {
      hydrated.current = true;
      return;
    }
    (async () => {
      const d = await loadSmileDraft();
      if (d && d.photo?.uri) setDraft(d);
      hydrated.current = true;
    })();
  }, [caseId]);
  const resumeDraft = () => {
    const d = draft;
    if (!d) return;
    setPhoto(d.photo);
    setParams(d.params);
    setTargetShade(d.targetShade);
    if (d.face) setFace(d.face);
    if (d.centralsWidthMm) setCentralsWidthMm(d.centralsWidthMm);
    setVariants(d.variants ?? []);
    setPatientName(d.patientName ?? '');
    setNotes(d.notes ?? '');
    setEditingId(d.editingId ?? null);
    setCreatedAt(d.createdAt ?? null);
    const s = STEPS.find((x) => x.id === d.step)?.id ?? 'ajustar';
    setStep(s === 'foto' ? 'boca' : s);
    setDraft(null);
  };
  useEffect(() => {
    if (!hydrated.current || !photo) return;
    const t = setTimeout(() => {
      saveSmileDraft({
        photo,
        params,
        targetShade,
        step,
        face: face ?? undefined,
        centralsWidthMm,
        variants,
        patientName,
        notes,
        editingId: editingId ?? undefined,
        createdAt: createdAt ?? undefined,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [photo, params, targetShade, step, face, centralsWidthMm, variants, patientName, notes, editingId, createdAt]);

  // ----- Histórico para desfazer/refazer (uma fotografia a cada pausa de 500 ms na edição) -----
  useEffect(() => {
    if (!photo) return;
    if (skipSnapshot.current) {
      skipSnapshot.current = false;
      lastSnapshot.current = params;
      return;
    }
    const t = setTimeout(() => {
      const prev = lastSnapshot.current;
      if (prev && prev !== params) setHistory((h) => ({ past: [...h.past.slice(-49), prev], future: [] }));
      lastSnapshot.current = params;
    }, 500);
    return () => clearTimeout(t);
  }, [params, photo]);
  const undo = () => {
    if (!history.past.length) return;
    const prev = history.past[history.past.length - 1];
    skipSnapshot.current = true;
    setHistory({ past: history.past.slice(0, -1), future: [params, ...history.future] });
    setParams(prev);
  };
  const redo = () => {
    if (!history.future.length) return;
    const next = history.future[0];
    skipSnapshot.current = true;
    setHistory({ past: [...history.past, params], future: history.future.slice(1) });
    setParams(next);
  };

  // ----- Layout atual -----
  const teeth = !area.width ? [] : anatomy ? layoutAnatomy(params, anatomy, area.width, area.height) : layoutTeeth(params, area.width, area.height);
  const t11 = teeth.find((t) => t.fdi === '11');
  const t23 = teeth.find((t) => t.fdi === '23');
  const cwPx = params.centralWidth * area.width;
  const shapeMix = params.shapeMix ?? SHAPE_MIX[params.shape];
  const calibMm = parseFloat(centralsWidthMm.replace(',', '.')) || 0;
  const analysis = face && area.width ? analyzeFrame(face, calibMm, params, area.width, area.height) : null;

  // ----- Gestos na foto -----
  const touchesOf = (e: GestureResponderEvent): Touch[] => (e.nativeEvent.touches ?? []).map((t) => ({ pageX: t.pageX, pageY: t.pageY }));
  const dist = (t: Touch[]) => (t.length >= 2 ? Math.hypot(t[1].pageX - t[0].pageX, t[1].pageY - t[0].pageY) : 0);
  const centroid = (t: Touch[]) => ({ x: t.reduce((s, p) => s + p.pageX, 0) / t.length, y: t.reduce((s, p) => s + p.pageY, 0) / t.length });
  const clampZoom = (z: { scale: number; tx: number; ty: number }) => {
    const scale = Math.min(4, Math.max(1, z.scale));
    const w = canvasW * scale;
    const h = canvasH * scale;
    return { scale, tx: Math.min(0, Math.max(canvasW - w, z.tx)), ty: Math.min(0, Math.max(canvasH - h, z.ty)) };
  };
  /** No passo Ajustar, com algo selecionado, os gestos mexem na seleção; fora disso, mexem na vista. */
  const gestureTargetsTeeth = step === 'ajustar' && selection.kind !== 'none';

  const begin = (e: GestureResponderEvent) => {
    const t = touchesOf(e);
    gesture.current = {
      touches: t.length ? t : [{ pageX: e.nativeEvent.pageX, pageY: e.nativeEvent.pageY }],
      params,
      dist: dist(t),
      start: { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },
      moved: false,
    };
    zoomStart.current = zoom;
  };
  const onCanvasMove = (e: GestureResponderEvent) => {
    const g = gesture.current;
    if (!g || !area.width) return;
    const t = touchesOf(e);
    const now = t.length ? t : [{ pageX: e.nativeEvent.pageX, pageY: e.nativeEvent.pageY }];
    if (now.length !== g.touches.length) {
      gesture.current = { ...g, touches: now, params, dist: dist(now) };
      zoomStart.current = zoom;
      return;
    }
    const c0 = centroid(g.touches);
    const c1 = centroid(now);
    if (Math.hypot(c1.x - c0.x, c1.y - c0.y) > 6) g.moved = true;

    if (!gestureTargetsTeeth) {
      // vista: pinça amplia em torno do toque inicial; um dedo arrasta a vista ampliada
      const z0 = zoomStart.current;
      let scale = z0.scale;
      let tx = z0.tx + (c1.x - c0.x);
      let ty = z0.ty + (c1.y - c0.y);
      if (now.length >= 2 && g.dist > 10) {
        scale = z0.scale * (dist(now) / g.dist);
        const k = scale / z0.scale;
        tx = g.start.x - (g.start.x - z0.tx) * k + (c1.x - c0.x);
        ty = g.start.y - (g.start.y - z0.ty) * k + (c1.y - c0.y);
      } else if (z0.scale <= 1) {
        return; // sem zoom, um dedo não faz nada na vista
      }
      setZoom(clampZoom({ scale, tx, ty }));
      return;
    }
    if (selection.kind === 'tooth' && now.length === 1) {
      const cw = g.params.centralWidth * area.width;
      const ch = cw * g.params.heightRatio;
      const base = g.params.edits?.[selection.fdi] ?? NO_EDIT;
      setEdit(selection.fdi, { dx: base.dx + (c1.x - c0.x) / cw, dy: base.dy + (c1.y - c0.y) / ch });
      return;
    }
    if (selection.kind === 'tooth' && now.length >= 2 && g.dist > 10) {
      const base = g.params.edits?.[selection.fdi] ?? NO_EDIT;
      const k = dist(now) / g.dist;
      setEdit(selection.fdi, { sw: base.sw * k, sh: base.sh * k });
      return;
    }
    // conjunto: arrasta o arco, pinça dimensiona
    const patch: Partial<SmileParams> = {
      midlineX: g.params.midlineX + (c1.x - c0.x) / area.width,
      gumY: g.params.gumY + (c1.y - c0.y) / area.height,
    };
    if (now.length >= 2 && g.dist > 10) patch.centralWidth = g.params.centralWidth * (dist(now) / g.dist);
    set(patch);
  };
  const end = () => {
    const g = gesture.current;
    gesture.current = null;
    // toque sem arrastar no passo Ajustar: seleciona dente (Unitário) ou arco (Conjunto); fora dos dentes, limpa
    if (g && !g.moved && step === 'ajustar') {
      const px = g.start.x - zoom.tx;
      const py = g.start.y - zoom.ty;
      const hit = teeth.find((t) => px >= t.x && px <= t.x + t.w && py >= t.y && py <= t.y + t.h);
      if (!hit) setSelection({ kind: 'none' });
      else setSelection(moveMode === 'one' ? { kind: 'tooth', fdi: hit.fdi } : { kind: 'arch' });
    }
  };

  const onLengthHandle = (_dx: number, dy: number) => {
    if (!cwPx) return;
    set({ heightRatio: params.heightRatio + dy / cwPx });
  };
  const onArchHandle = (dx: number, dy: number) => {
    if (!area.width || !cwPx) return;
    const midPx = params.midlineX * area.width;
    const outerX = t23 ? t23.x + t23.w : midPx;
    const half = outerX - midPx;
    const newHalf = half + dx;
    const ch = cwPx * params.heightRatio;
    if (half > 1) set({ centralWidth: params.centralWidth * (Math.max(1, newHalf) / half), curve: params.curve - dy / (ch * 2) });
  };

  const runScenario = (id: (typeof SCENARIOS)[number]['id']) => {
    if (!area.width) return;
    const r = applyScenario(id, params, { system: settings.shadeSystem, defaultAnatomy: anatomy?.id ?? SCENARIO_ANATOMY, aspect: area.width / area.height });
    setParams(clampParams(r.params));
    if (r.shade) chooseShade(r.shade);
  };

  const saveVariant = () => {
    if (variants.length >= 3) return;
    setVariants([...variants, { name: ['A', 'B', 'C'][variants.length], params, targetShade }]);
  };
  const loadVariant = (v: SmileVariant) => {
    setParams(v.params);
    setTargetShade(v.targetShade);
    setCompareMode('edit');
  };

  // ----- Exportar e salvar -----
  const exportImage = async (): Promise<string | null> => {
    setExporting(true);
    await new Promise((r) => setTimeout(r, 60));
    try {
      const target = compareMode === 'side' || compareMode === 'variants' ? panesRef : canvasRef;
      return await captureRef(target, { format: 'jpg', quality: 0.95 });
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
    if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: 'image/jpeg' });
    else Alert.alert('Imagem gerada', uri);
  };
  const save = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      const id = editingId ?? newCaseId();
      const rendered = await exportImage();
      const photoUri = editingId ? photo.uri : await persistPhoto(photo.uri, id);
      const renderedUri = rendered ? await persistPhoto(rendered, id, '-smile') : undefined;
      await saveCase({
        kind: 'smile',
        id,
        createdAt: createdAt ?? new Date().toISOString(),
        patientName: patientName.trim() || 'Sem nome',
        notes: notes.trim(),
        photoUri,
        renderedUri,
        params,
        targetShade,
        face: face ?? undefined,
        centralsWidthMm: face ? calibMm : undefined,
        variants: variants.length ? variants : undefined,
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
      await clearSmileDraft();
      router.dismissTo({ pathname: '/cases/[id]', params: { id } });
    } catch (e) {
      Alert.alert('Erro ao salvar', String(e));
    } finally {
      setBusy(false);
    }
  };

  const discardDraft = () =>
    Alert.alert('Começar do zero', 'Descartar o rascunho atual? O que não foi salvo no caso será perdido.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: async () => {
          await clearSmileDraft();
          setPhoto(null);
          setParams(DEFAULT_SMILE_PARAMS);
          setFace(null);
          setVariants([]);
          setEditingId(null);
          setCreatedAt(null);
          setDetectNote(null);
          setStep('foto');
        },
      },
    ]);

  const goToForma = async () => {
    setStep('forma');
    await fitTeeth();
  };

  // ----- Tela sem foto -----
  if (!photo) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <FaceLandmarker ref={landmarker} />
        <Card>
          <SectionTitle>1. Foto do sorriso</SectionTitle>
          <Muted>
            Use a câmera guiada: um guia de rosto padroniza o enquadramento. Depois o app encontra a boca e encaixa
            os dentes para você escolher forma e cor.
          </Muted>
          <Button title="Fotografar com guia" onPress={() => router.push('/smile/capture')} style={{ marginTop: 12 }} />
          <Button title="Escolher da galeria" variant="secondary" onPress={pickFromGallery} style={{ marginTop: 8 }} />
        </Card>
        {draft && (
          <Card>
            <SectionTitle>Rascunho não salvo</SectionTitle>
            <Muted>
              {`Há uma simulação de ${new Date(draft.updatedAt).toLocaleString('pt-BR')} que não foi salva em Casos${
                draft.editingId ? ' (edição de um caso existente)' : ''
              }. Quer continuar de onde parou?`}
            </Muted>
            <View style={styles.chips}>
              <Chip label="Continuar rascunho" selected onPress={resumeDraft} />
              <Chip
                label="Descartar"
                onPress={async () => {
                  await clearSmileDraft();
                  setDraft(null);
                }}
              />
            </View>
          </Card>
        )}
      </ScrollView>
    );
  }

  // ----- Tela com foto: canvas fixo + passos + comandos rolando -----
  const showTeeth = step !== 'boca' && !hidden;
  const selectedForOverlay = step === 'ajustar' && !exporting && selectedTooth ? selectedTooth : undefined;
  const archHandles = step === 'ajustar' && selection.kind === 'arch' && !exporting && !!t11 && !!t23;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FaceLandmarker ref={landmarker} />
      <View style={{ alignItems: 'center', backgroundColor: '#000' }}>
        <View
          ref={canvasRef}
          collapsable={false}
          style={[styles.canvas, { width: canvasW, height: canvasH }]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={begin}
          onResponderMove={onCanvasMove}
          onResponderRelease={end}
          onResponderTerminate={end}
        >
          <View
            style={
              exporting
                ? { position: 'absolute', left: 0, top: 0, width: canvasW, height: canvasH }
                : { position: 'absolute', left: zoom.tx, top: zoom.ty, width: canvasW * zoom.scale, height: canvasH * zoom.scale }
            }
            onLayout={(e) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          >
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <SmileOverlay params={params} width={area.width} height={area.height} hidden={!showTeeth} anatomy={anatomy} selected={selectedForOverlay} />
            {face && showFace && step === 'ajustar' && !hidden && area.width > 0 && (
              <FaceFrame face={face} width={area.width} height={area.height} teeth={teeth} dentalMidlineX={params.midlineX * area.width} onChange={setFace} readOnly={exporting} />
            )}
            {params.mouth && step === 'boca' && area.width > 0 && (
              <MouthOutline mouth={params.mouth} width={area.width} height={area.height} onChange={(m) => set({ mouth: m })} readOnly={exporting} hideLine={exporting} />
            )}
            {step === 'comparar' && compareMode === 'curtain' && !hidden && area.width > 0 && (
              <>
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: curtain * area.width, overflow: 'hidden' }}>
                  <Image source={{ uri: photo.uri }} style={{ width: area.width, height: area.height }} resizeMode="cover" />
                </View>
                <View pointerEvents="none" style={[styles.curtainLine, { left: curtain * area.width - 1 }]} />
                <View pointerEvents="none" style={[styles.curtainTag, { left: 8 }]}>
                  <Text style={styles.curtainTagText}>ANTES</Text>
                </View>
                <View pointerEvents="none" style={[styles.curtainTag, { right: 8 }]}>
                  <Text style={styles.curtainTagText}>DEPOIS</Text>
                </View>
                {!exporting && <Handle x={curtain * area.width} y={area.height * 0.5} glyph="⇔" onMove={(dx) => setCurtain(Math.min(0.98, Math.max(0.02, curtain + dx / area.width)))} />}
              </>
            )}
            {archHandles && (
              <>
                <Handle x={params.midlineX * area.width} y={t11.y + t11.h + 14} glyph="↕" onMove={onLengthHandle} />
                <Handle x={t23.x + t23.w + 14} y={t23.y + t23.h * 0.5} glyph="↔" onMove={onArchHandle} />
              </>
            )}
          </View>
          {detecting && (
            <View pointerEvents="none" style={styles.detecting}>
              <Text style={styles.detectingText}>{detecting}</Text>
            </View>
          )}
          {!exporting && step === 'ajustar' && selection.kind !== 'none' && !detecting && (
            <View pointerEvents="none" style={styles.detecting}>
              <Text style={styles.detectingText}>{selection.kind === 'arch' ? 'Conjunto selecionado: arraste para mover, pinça para o tamanho' : `Dente ${selectedTooth} selecionado: arraste para mover, pinça para o tamanho`}</Text>
            </View>
          )}
          {!exporting && zoom.scale > 1 && (
            <Pressable onPress={() => setZoom({ scale: 1, tx: 0, ty: 0 })} style={styles.zoomBadge}>
              <Text style={styles.zoomBadgeText}>{`${zoom.scale.toFixed(1)}x · tocar para 1x`}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepBar} contentContainerStyle={{ paddingHorizontal: spacing.sm, alignItems: 'center' }}>
        <Pressable onPress={undo} disabled={!history.past.length} style={[styles.histBtn, !history.past.length && { opacity: 0.3 }]} hitSlop={6}>
          <Text style={styles.histText}>↶</Text>
        </Pressable>
        <Pressable onPress={redo} disabled={!history.future.length} style={[styles.histBtn, !history.future.length && { opacity: 0.3 }]} hitSlop={6}>
          <Text style={styles.histText}>↷</Text>
        </Pressable>
        <View style={{ width: 1, height: 24, backgroundColor: colors.border, marginRight: 8 }} />
        {STEPS.map((s) => (
          <Chip key={s.id} label={s.label} selected={step === s.id} onPress={() => setStep(s.id)} />
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {detectNote && <Muted>{detectNote}</Muted>}

        {step === 'foto' && (
          <Card>
            <SectionTitle>Foto</SectionTitle>
            <Muted>{'Pinça na foto dá zoom. Se a selfie saiu invertida, use "Espelhar foto". Trocar a foto reinicia a simulação.'}</Muted>
            <View style={styles.chips}>
              <Chip label="Espelhar foto" onPress={mirror} />
              <Chip label="Fotografar de novo" onPress={() => router.push('/smile/capture')} />
              <Chip label="Galeria" onPress={pickFromGallery} />
              <Chip label="Começar do zero" onPress={discardDraft} />
            </View>
            <Muted>O trabalho é guardado automaticamente como rascunho: ao sair e voltar, continua de onde parou.</Muted>
            <Button title="Ir para a boca →" variant="secondary" onPress={() => setStep('boca')} style={{ marginTop: 8 }} />
          </Card>
        )}

        {step === 'boca' && (
          <Card>
            <SectionTitle>Delimitar a boca</SectionTitle>
            <Muted>
              {params.mouth
                ? 'Arraste os pontos vermelhos (◆ comissuras, • lábios) até a borda interna dos lábios. Pinça na foto aproxima; um dedo arrasta a vista ampliada.'
                : 'Toque em "Detectar" para encontrar a boca, ou "Marcar à mão".'}
            </Muted>
            <View style={styles.chips}>
              <Chip label="Detectar de novo" onPress={() => runDetection(photo)} />
              {!params.mouth && (
                <Chip label="Marcar à mão" onPress={() => area.width && set({ mouth: defaultMouth(layoutTeeth(params, area.width, area.height), area.width, area.height) })} />
              )}
              {params.mouth && <Chip label="Remover contorno" onPress={() => set({ mouth: undefined })} />}
            </View>
            {params.mouth && (
              <View style={styles.chips}>
                <Chip label="+ ponto lábio superior" onPress={() => params.mouth && set({ mouth: addMouthPoint(params.mouth, 'upper') })} />
                <Chip label="+ ponto lábio inferior" onPress={() => params.mouth && set({ mouth: addMouthPoint(params.mouth, 'lower') })} />
                {params.mouth.length > 6 && <Chip label="− ponto" onPress={() => params.mouth && set({ mouth: removeMouthPoint(params.mouth) })} />}
              </View>
            )}
            <Button title="Boca pronta: escolher forma e cor →" onPress={goToForma} style={{ marginTop: 8 }} />
          </Card>
        )}

        {step === 'forma' && (
          <>
            <Card>
              <SectionTitle>Cor-alvo</SectionTitle>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {system.shades.map((s) => (
                  <Chip key={s.id} label={s.id} selected={targetShade === s.id} onPress={() => chooseShade(s.id)} />
                ))}
              </ScrollView>
              <SectionTitle>Anatomia</SectionTitle>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Pressable onPress={() => set({ anatomy: undefined })} style={[styles.anatomyCard, !anatomy && styles.anatomyCardSelected]}>
                  <View style={styles.anatomyThumbPlaceholder}>
                    <Text style={styles.anatomyGlyph}>◠◠</Text>
                  </View>
                  <Text style={styles.anatomyName}>Contorno</Text>
                </Pressable>
                {ANATOMY_CATALOG.map((a) => (
                  <Pressable key={a.id} onPress={() => set({ anatomy: a.id })} style={[styles.anatomyCard, anatomy?.id === a.id && styles.anatomyCardSelected]}>
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
                    <Chip label="Quadrada" selected={shapeFromMix(shapeMix) === 'square'} onPress={() => set({ shape: 'square', shapeMix: SHAPE_MIX.square })} />
                    <Chip label="Oval" selected={shapeFromMix(shapeMix) === 'oval'} onPress={() => set({ shape: 'oval', shapeMix: SHAPE_MIX.oval })} />
                    <Chip label="Triangular" selected={shapeFromMix(shapeMix) === 'triangular'} onPress={() => set({ shape: 'triangular', shapeMix: SHAPE_MIX.triangular })} />
                  </View>
                  <Control label="Transição da forma (quadrada → oval → triangular)" value={shapeMix} min={0} max={1} onChange={(v) => set({ shapeMix: v, shape: shapeFromMix(v) })} />
                </>
              )}
              <SectionTitle>Proporção</SectionTitle>
              <View style={styles.chips}>
                <Chip label="Natural" selected={params.proportion === 'natural'} onPress={() => set({ proportion: 'natural' })} />
                <Chip label="Áurea (62% / 38%)" selected={params.proportion === 'golden'} onPress={() => set({ proportion: 'golden' })} />
                <Chip label="RED (70% / 50%)" selected={params.proportion === 'red'} onPress={() => set({ proportion: 'red' })} />
              </View>
              <View style={styles.chips}>
                <Chip label="Reencaixar na boca" onPress={fitTeeth} />
              </View>
            </Card>
            <Card>
              <SectionTitle>Cenários de tratamento</SectionTitle>
              <Muted>Um toque aplica um preset de forma, proporção, comprimento e cor; a posição do arco é mantida.</Muted>
              <View style={styles.chips}>
                {SCENARIOS.map((s) => (
                  <Chip key={s.id} label={s.name} onPress={() => runScenario(s.id)} />
                ))}
              </View>
            </Card>
            <Button title="Ajustar os dentes →" onPress={() => setStep('ajustar')} />
          </>
        )}

        {step === 'ajustar' && (
          <>
            <Card>
              <SectionTitle>Ajustar</SectionTitle>
              <View style={styles.chips}>
                <Chip
                  label="Conjunto"
                  selected={moveMode === 'arch'}
                  onPress={() => {
                    setMoveMode('arch');
                    setSelection({ kind: 'arch' });
                  }}
                />
                <Chip
                  label="Unitário"
                  selected={moveMode === 'one'}
                  onPress={() => {
                    setMoveMode('one');
                    setSelection({ kind: 'none' });
                  }}
                />
              </View>
              <Muted>
                {moveMode === 'arch'
                  ? selection.kind === 'arch'
                    ? 'Conjunto selecionado: arraste para mover o arco, pinça para o tamanho, alça ↕ comprimento, alça ↔ largura e curva. Toque fora dos dentes para soltar (aí a pinça volta a ser zoom da foto).'
                    : 'Toque nos dentes para selecionar o conjunto. Sem seleção, pinça e arraste mexem na foto.'
                  : selectedTooth
                    ? `Dente ${selectedTooth}: arraste para mover, pinça para o tamanho; rotação e medidas abaixo. Toque em outro dente para trocar, fora deles para soltar.`
                    : 'Toque num dente na foto para selecioná-lo. Sem seleção, pinça e arraste mexem na foto.'}
              </Muted>
              {moveMode === 'one' && (
                <View style={styles.chips}>
                  {['13', '12', '11', '21', '22', '23'].map((fdi) => (
                    <Chip
                      key={fdi}
                      label={fdi}
                      selected={selectedTooth === fdi}
                      color={params.edits?.[fdi] ? colors.navy : undefined}
                      onPress={() => setSelection(selectedTooth === fdi ? { kind: 'none' } : { kind: 'tooth', fdi })}
                    />
                  ))}
                </View>
              )}
              {selectedTooth && (
                <>
                  <Control label="Rotação (°)" value={editOf(selectedTooth).rot} min={-25} max={25} onChange={(v) => setEdit(selectedTooth, { rot: v })} />
                  <Control label="Largura" value={editOf(selectedTooth).sw} min={0.6} max={1.4} onChange={(v) => setEdit(selectedTooth, { sw: v })} />
                  <Control label="Comprimento" value={editOf(selectedTooth).sh} min={0.6} max={1.4} onChange={(v) => setEdit(selectedTooth, { sh: v })} />
                  <View style={styles.chips}>
                    <Chip label={`Espelhar no ${mirrorFdi(selectedTooth)}`} onPress={() => setEdit(mirrorFdi(selectedTooth), mirrorEdit(editOf(selectedTooth)))} />
                    <Chip label="Zerar este" onPress={() => setEdit(selectedTooth, NO_EDIT)} />
                  </View>
                </>
              )}
              <View style={styles.chips}>
                <Chip label="Reencaixar na boca" onPress={fitTeeth} />
                {params.edits && <Chip label="Zerar ajustes individuais" onPress={() => setParams((p) => ({ ...p, edits: undefined }))} />}
              </View>
            </Card>
            <Button title="Ajuste fino" variant="ghost" onPress={() => setFine(!fine)} />
            {fine && (
              <Card>
                <Control label="Largura" value={params.centralWidth} min={0.04} max={0.2} onChange={(v) => set({ centralWidth: v })} />
                <Control label="Comprimento" value={params.heightRatio} min={0.8} max={1.6} onChange={(v) => set({ heightRatio: v })} />
                <Control label="Espaçamento" value={params.spacing} min={0} max={0.15} onChange={(v) => set({ spacing: v })} />
                <Control label="Curva do sorriso" value={params.curve} min={-0.1} max={0.35} onChange={(v) => set({ curve: v })} />
                <Control label="Opacidade" value={params.opacity} min={0.2} max={1} onChange={(v) => set({ opacity: v })} />
              </Card>
            )}
            <Card>
              <SectionTitle>Análise facial (face-bow digital)</SectionTitle>
              {!face ? (
                <>
                  <Muted>Os marcos faciais vêm da detecção automática. Se ela não rodou, marque à mão.</Muted>
                  <Button
                    title="Marcar à mão"
                    variant="secondary"
                    onPress={() => {
                      setFace(defaultFacePoints());
                      setShowFace(true);
                    }}
                    style={{ marginTop: 8 }}
                  />
                </>
              ) : (
                <>
                  <View style={styles.chips}>
                    <Chip label={showFace ? 'Ocultar linhas' : 'Mostrar linhas na foto'} selected={showFace} onPress={() => setShowFace(!showFace)} />
                    <Chip label="Alinhar linha média à face" onPress={() => area.width && setParams(clampParams(alignMidlineToFace(params, face, area.width, area.height)))} />
                  </View>
                  <View style={styles.inlineRow}>
                    <Text style={styles.controlLabel}>Largura real dos dois centrais (mm)</Text>
                    <TextInput value={centralsWidthMm} onChangeText={setCentralsWidthMm} keyboardType="decimal-pad" style={[styles.input, styles.inputSmall]} placeholderTextColor={colors.muted} />
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
                    <TextInput value={centralMm} onChangeText={setCentralMm} keyboardType="decimal-pad" style={[styles.input, styles.inputSmall]} placeholderTextColor={colors.muted} />
                    <Button
                      title="Aplicar"
                      variant="ghost"
                      onPress={() => {
                        const mm = parseFloat(centralMm.replace(',', '.'));
                        if (mm > 0 && area.width) setParams(clampParams(setCentralWidthMm(params, face, calibMm, mm, area.width, area.height)));
                      }}
                    />
                  </View>
                </>
              )}
            </Card>
            <Button title="Comparar e salvar →" variant="secondary" onPress={() => setStep('comparar')} />
          </>
        )}

        {step === 'comparar' && (
          <>
            {(compareMode === 'side' || compareMode === 'variants') && (
              <View style={{ marginBottom: spacing.md }}>
                <SmilePanes
                  ref={panesRef}
                  photoUri={photo.uri}
                  aspect={aspect}
                  panes={
                    compareMode === 'side'
                      ? ([{ label: 'ANTES' }, { label: 'DEPOIS', params, anatomy }] as Pane[])
                      : ([...variants.map((v) => ({ label: v.name, params: v.params, anatomy: anatomyOf(v.params.anatomy) })), { label: 'ATUAL', params, anatomy }] as Pane[])
                  }
                />
              </View>
            )}
            <Card>
              <SectionTitle>Comparar</SectionTitle>
              <View style={styles.chips}>
                <Chip label="Normal" selected={compareMode === 'edit'} onPress={() => setCompareMode('edit')} />
                <Chip label="Cortina" selected={compareMode === 'curtain'} onPress={() => setCompareMode('curtain')} />
                <Chip label="Lado a lado" selected={compareMode === 'side'} onPress={() => setCompareMode('side')} />
                <Chip label={`Variações (${variants.length})`} selected={compareMode === 'variants'} onPress={() => setCompareMode('variants')} />
              </View>
              <View style={styles.row}>
                <Pressable onPressIn={() => setHidden(true)} onPressOut={() => setHidden(false)} style={({ pressed }) => [styles.compare, pressed && { backgroundColor: colors.navy }]}>
                  <Text style={styles.compareText}>Segure para ver o antes</Text>
                </Pressable>
              </View>
              <View style={styles.chips}>
                {variants.map((v) => (
                  <Chip key={v.name} label={`${v.name}: ${v.targetShade}`} onPress={() => loadVariant(v)} color={colors.navy} />
                ))}
                {variants.length < 3 && <Chip label={`Guardar como ${['A', 'B', 'C'][variants.length]}`} onPress={saveVariant} />}
                {variants.length > 0 && <Chip label="Limpar variações" onPress={() => setVariants([])} />}
              </View>
              <Button title="Compartilhar imagem" variant="secondary" onPress={share} style={{ marginTop: spacing.sm }} />
            </Card>
            <Card>
              <SectionTitle>{editingId ? 'Atualizar o caso' : 'Salvar no caso'}</SectionTitle>
              <TextInput placeholder="Nome do paciente" value={patientName} onChangeText={setPatientName} style={styles.input} placeholderTextColor={colors.muted} />
              <TextInput placeholder="Observações" value={notes} onChangeText={setNotes} style={[styles.input, { height: 70, textAlignVertical: 'top' }]} multiline placeholderTextColor={colors.muted} />
              <Button title={editingId ? 'Salvar alterações' : 'Salvar simulação'} onPress={save} loading={busy} />
            </Card>
          </>
        )}
      </ScrollView>
    </View>
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

function Control({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
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
  canvas: { backgroundColor: '#000', overflow: 'hidden' },
  stepBar: { flexGrow: 0, paddingVertical: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  histBtn: { width: 36, height: 34, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 6, backgroundColor: '#fff' },
  histText: { fontSize: 20, color: colors.text, fontWeight: '700', lineHeight: 24 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.sm },
  compare: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md },
  compareText: { color: '#fff', fontWeight: '700' },
  curtainLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#fff', opacity: 0.9 },
  curtainTag: { position: 'absolute', top: 8, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  curtainTagText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  detecting: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', padding: 8, alignItems: 'center' },
  detectingText: { color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  zoomBadge: { position: 'absolute', right: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm },
  zoomBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  anatomyCard: { width: 118, marginRight: 8, marginBottom: 8, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, backgroundColor: '#2A2224', overflow: 'hidden' },
  anatomyCardSelected: { borderColor: colors.primary },
  anatomyThumb: { width: 114, height: 44 },
  anatomyThumbPlaceholder: { width: 114, height: 44, alignItems: 'center', justifyContent: 'center' },
  anatomyGlyph: { color: '#EEE3CD', fontSize: 22, letterSpacing: 2 },
  anatomyName: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: 4, paddingHorizontal: 4, backgroundColor: colors.navy },
  controlLabel: { color: colors.text, fontWeight: '600', fontSize: 13 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  inputSmall: { width: 80, marginBottom: 0, paddingVertical: 8, textAlign: 'center' },
  metrics: { marginTop: 10, backgroundColor: '#F4F6FA', borderRadius: radius.sm, padding: 10 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  metricLabel: { color: colors.muted, fontSize: 13 },
  metricValue: { color: colors.text, fontWeight: '700', fontSize: 13 },
  note: { color: colors.text, fontSize: 12, marginTop: 6, lineHeight: 17 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 12, marginBottom: 10, color: colors.text, backgroundColor: '#FBFCFE' },
});
