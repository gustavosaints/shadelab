/**
 * Smile Design por IA (redesenho de 2026-10-22, pedido do Gustavo: tirar toda a parte manual de colocar dentes).
 * Foto → escolhas (forma, textura, cor da escala, gengiva) → o Gemini gera a simulação → antes e depois com
 * cortina deslizante ou transparência → salvar no caso. Cada geração vira uma variação que pode ser comparada.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { AiConfig } from '@/components/AiConfig';
import { BeforeAfter, type CompareMode } from '@/components/BeforeAfter';
import { Button } from '@/components/Button';
import { Card, Muted, SectionTitle } from '@/components/Card';
import { Chip } from '@/components/Chip';
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
import { takePendingPhoto } from '@/lib/smile/pendingPhoto';
import { DEFAULT_SMILE_PARAMS } from '@/lib/smile/teeth';
import { getCase, isSmileCase, newCaseId, persistPhoto, saveCase } from '@/lib/storage/cases';
import { useSettings } from '@/lib/useSettings';
import { colors, radius, spacing } from '@/theme';

type Photo = { uri: string; width: number; height: number };
type Choice = { shape: ToothShapeId; texture: TextureId; gum: GumId; shadeId: string };
type Result = { uri: string; choice: Choice; model: string; ms: number };

export default function SmileDesign() {
  const { caseId } = useLocalSearchParams<{ caseId?: string }>();
  const [settings, reloadSettings] = useSettings();
  const system = getSystem(settings.shadeSystem);

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [choice, setChoice] = useState<Choice>({ shape: 'retangular', texture: 'natural', gum: 'manter', shadeId: 'B1' });
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

  const hasKey = settings.aiApiKey.trim().length > 0;
  const result = results[current];
  const aspect = photo ? photo.width / photo.height : 3 / 4;
  const shadeIds = system.shades.map((s) => s.id);
  const shadeId = shadeIds.includes(choice.shadeId) ? choice.shadeId : shadeIds[0];

  const startWithPhoto = (p: Photo) => {
    setPhoto(p);
    setResults([]);
    setCurrent(0);
    setEditingId(null);
    setCreatedAt(null);
  };

  // foto vinda da câmera guiada
  useFocusEffect(
    useCallback(() => {
      const p = takePendingPhoto();
      if (p) startWithPhoto({ uri: p.uri, width: p.width, height: p.height });
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
      setPhoto({ uri: c.photoUri, width: size.w, height: size.h });
      const ch: Choice = {
        shape: (c.ai?.shape as ToothShapeId) ?? 'retangular',
        texture: (c.ai?.texture as TextureId) ?? 'natural',
        gum: (c.ai?.gum as GumId) ?? 'manter',
        shadeId: c.targetShade,
      };
      setChoice(ch);
      setResults(c.renderedUri ? [{ uri: c.renderedUri, choice: ch, model: c.ai?.model ?? '', ms: 0 }] : []);
      setCurrent(0);
      setPatientName(c.patientName === 'Sem nome' ? '' : c.patientName);
      setNotes(c.notes);
      setEditingId(c.id);
      setCreatedAt(c.createdAt);
    })();
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
    const ch = { ...choice, shadeId };
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
        prompt: buildDesignPrompt({ ...ch, shadeLab }),
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
  }, [pending]);

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

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" scrollEnabled={!dragging}>
      {/* foto ou antes/depois */}
      <View>
        {result ? (
          <BeforeAfter
            ref={compareRef}
            beforeUri={photo.uri}
            afterUri={result.uri}
            aspect={aspect}
            mode={mode}
            onDragStart={() => setDragging(true)}
            onDragEnd={() => setDragging(false)}
          />
        ) : (
          <View style={[styles.photoBox, { aspectRatio: aspect }]}>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </View>
        )}
        {generating && <SmileGenerating photoUri={photo.uri} aspect={aspect} steps={genSteps} resultUri={pending?.uri} onDone={finishReveal} />}
      </View>

      {result && (
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

      <Card style={{ marginTop: result ? 0 : spacing.md }}>
        <SectionTitle>Forma dos dentes</SectionTitle>
        <View style={styles.chips}>
          {TOOTH_SHAPES.map((s) => (
            <Chip key={s.id} label={s.name} selected={choice.shape === s.id} onPress={() => setChoice({ ...choice, shape: s.id })} />
          ))}
        </View>
        <SectionTitle>Textura</SectionTitle>
        <View style={styles.chips}>
          {TEXTURES.map((t) => (
            <Chip key={t.id} label={t.name} selected={choice.texture === t.id} onPress={() => setChoice({ ...choice, texture: t.id })} />
          ))}
        </View>
        <SectionTitle>{`Cor · ${system.name}`}</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {shadeIds.map((id) => (
            <Chip key={id} label={id} selected={shadeId === id} onPress={() => setChoice({ ...choice, shadeId: id })} />
          ))}
        </ScrollView>
        <SectionTitle>Gengiva</SectionTitle>
        <View style={styles.chips}>
          {GUM_OPTIONS.map((g) => (
            <Chip key={g.id} label={g.name} selected={choice.gum === g.id} onPress={() => setChoice({ ...choice, gum: g.id })} />
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
  );
}

const styles = StyleSheet.create({
  photoBox: { width: '100%', backgroundColor: '#000', borderRadius: radius.md, overflow: 'hidden' },
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
