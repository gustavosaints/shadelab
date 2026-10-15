import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card, Muted, SectionTitle } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { DEFAULT_AI_MODEL, generateSmile, SMILE_STYLES, type SmileStyleId } from '@/lib/ai/smileGen';
import { labToHex } from '@/lib/color/convert';
import { getSystem } from '@/lib/color/shades';
import { DEFAULT_SMILE_PARAMS } from '@/lib/smile/teeth';
import { newCaseId, persistPhoto, saveCase } from '@/lib/storage/cases';
import { saveSettings } from '@/lib/storage/settings';
import { useSettings } from '@/lib/useSettings';
import { colors, radius, spacing } from '@/theme';

type Photo = { uri: string; width: number; height: number };

/**
 * Gerar sorriso por IA: foto do sorriso → estilo + cor da escala → a IA devolve a
 * foto com os dentes novos. Separado do Smile Design manual.
 */
export default function AiSmile() {
  const [settings, reload] = useSettings();
  const system = getSystem(settings.shadeSystem);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [style, setStyle] = useState<SmileStyleId>('natural');
  const [shade, setShade] = useState('B2');
  const [result, setResult] = useState<{ uri: string; model: string; ms: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBefore, setShowBefore] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState<string | null>(null);
  const [modelDraft, setModelDraft] = useState<string | null>(null);
  const [patientName, setPatientName] = useState('');
  const [saving, setSaving] = useState(false);

  const hasKey = settings.aiApiKey.trim().length > 0;
  const shadeDef = system.shades.find((s) => s.id === shade) ?? system.shades[0];
  const shadeLab = settings.calibrations[settings.shadeSystem]?.[shadeDef.id] ?? shadeDef.lab;

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
    setResult(null);
  };

  const generate = async () => {
    if (!photo) return;
    if (!hasKey) {
      setConfigOpen(true);
      Alert.alert('Falta a chave da IA', 'Informe a chave da API do Google em "Configurar IA".');
      return;
    }
    setBusy(true);
    try {
      const r = await generateSmile({
        photoUri: photo.uri,
        style,
        shadeId: shadeDef.id,
        shadeLab,
        apiKey: settings.aiApiKey,
        model: settings.aiModel || DEFAULT_AI_MODEL,
      });
      setResult({ uri: r.uri, model: r.model, ms: r.ms });
    } catch (e) {
      Alert.alert('Não foi possível gerar', String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const saveConfig = async () => {
    await saveSettings({ aiApiKey: (keyDraft ?? settings.aiApiKey).trim(), aiModel: (modelDraft ?? settings.aiModel).trim() || DEFAULT_AI_MODEL });
    await reload();
    setConfigOpen(false);
    Alert.alert('Salvo', 'A chave fica guardada só neste aparelho.');
  };

  const share = async () => {
    if (!result) return;
    if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(result.uri);
    else Alert.alert('Imagem gerada', result.uri);
  };

  const save = async () => {
    if (!photo || !result) return;
    setSaving(true);
    try {
      const id = newCaseId();
      const photoUri = await persistPhoto(photo.uri, id);
      const renderedUri = await persistPhoto(result.uri, id, '-ia');
      const styleName = SMILE_STYLES.find((s) => s.id === style)?.name ?? style;
      await saveCase({
        kind: 'smile',
        id,
        createdAt: new Date().toISOString(),
        patientName: patientName.trim() || 'Sem nome',
        notes: `Gerado por IA (${result.model}) · estilo ${styleName} · cor ${shadeDef.id}`,
        photoUri,
        renderedUri,
        params: DEFAULT_SMILE_PARAMS,
        targetShade: shadeDef.id,
        aiStyle: style,
      });
      router.dismissTo({ pathname: '/cases/[id]', params: { id } });
    } catch (e) {
      Alert.alert('Erro ao salvar', String(e));
    } finally {
      setSaving(false);
    }
  };

  const aspect = photo ? photo.width / photo.height : 4 / 3;
  const shown = result && !showBefore ? result.uri : photo?.uri;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {!photo ? (
        <Card>
          <SectionTitle>Foto do sorriso</SectionTitle>
          <Muted>
            Paciente de frente, sorriso amplo mostrando os dentes, boa luz. A IA troca só os dentes e mantém o resto da
            foto.
          </Muted>
          <Button title="Fotografar" onPress={() => pick(true)} style={{ marginTop: 12 }} />
          <Button title="Escolher da galeria" variant="secondary" onPress={() => pick(false)} style={{ marginTop: 8 }} />
        </Card>
      ) : (
        <>
          <Pressable
            onPressIn={() => setShowBefore(true)}
            onPressOut={() => setShowBefore(false)}
            style={[styles.canvas, { aspectRatio: aspect }]}
          >
            {shown && <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
            {busy && (
              <View style={styles.overlay}>
                <Text style={styles.overlayText}>Gerando o sorriso… (10 a 40 s)</Text>
              </View>
            )}
            {result && !busy && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{showBefore ? 'ANTES' : 'DEPOIS (IA)'}</Text>
              </View>
            )}
          </Pressable>
          <View style={styles.row}>
            <Muted>{result ? 'Segure a imagem para ver o antes.' : 'A foto será enviada à IA ao gerar.'}</Muted>
            <Button title="Trocar foto" variant="ghost" onPress={() => setPhoto(null)} />
          </View>
        </>
      )}

      <Card>
        <SectionTitle>Tipo de sorriso</SectionTitle>
        <View style={styles.chips}>
          {SMILE_STYLES.map((s) => (
            <Chip key={s.id} label={s.name} selected={style === s.id} onPress={() => setStyle(s.id)} />
          ))}
        </View>
        <Muted>{SMILE_STYLES.find((s) => s.id === style)?.description}</Muted>

        <SectionTitle>{`Cor (${system.name})`}</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {system.shades.map((s) => (
            <Chip key={s.id} label={s.id} selected={shade === s.id} onPress={() => setShade(s.id)} />
          ))}
        </ScrollView>
        <View style={styles.swatchRow}>
          <View style={[styles.swatch, { backgroundColor: labToHex(shadeLab) }]} />
          <Muted>
            {`${shadeDef.id} · L* ${shadeLab.L.toFixed(0)}${settings.calibrations[settings.shadeSystem]?.[shadeDef.id] ? ' (sua escala calibrada)' : ' (valor de catálogo)'}`}
          </Muted>
        </View>

        <Button
          title={busy ? 'Gerando…' : result ? 'Gerar de novo' : 'Gerar sorriso por IA'}
          onPress={generate}
          loading={busy}
          style={{ marginTop: 12 }}
        />
        <Muted>
          Ao gerar, a foto é enviada ao serviço de IA do Google. Use só com consentimento do paciente. Cada geração
          consome créditos da sua chave.
        </Muted>
      </Card>

      {result && (
        <Card>
          <SectionTitle>Resultado</SectionTitle>
          <Muted>
            Modelo {result.model} · {(result.ms / 1000).toFixed(0)} s. A simulação é ilustrativa: confira a forma e a cor
            antes de mostrar ao paciente.
          </Muted>
          <Button title="Compartilhar imagem" variant="secondary" onPress={share} style={{ marginTop: 8 }} />
          <TextInput
            placeholder="Nome do paciente"
            value={patientName}
            onChangeText={setPatientName}
            style={styles.input}
            placeholderTextColor={colors.muted}
          />
          <Button title="Salvar no caso" onPress={save} loading={saving} />
        </Card>
      )}

      <Button title={configOpen ? 'Ocultar configuração da IA' : hasKey ? 'Configurar IA' : 'Configurar IA (falta a chave)'} variant="ghost" onPress={() => setConfigOpen(!configOpen)} />
      {configOpen && (
        <Card>
          <SectionTitle>Serviço de IA (Google Gemini)</SectionTitle>
          <Muted>
            Crie uma chave em aistudio.google.com (API key) e cole aqui. Ela fica guardada só neste aparelho. O modelo
            padrão é {DEFAULT_AI_MODEL}; troque se o Google lançar um mais novo.
          </Muted>
          <TextInput
            placeholder="Chave da API"
            value={keyDraft ?? settings.aiApiKey}
            onChangeText={setKeyDraft}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            placeholderTextColor={colors.muted}
          />
          <TextInput
            placeholder="Modelo"
            value={modelDraft ?? settings.aiModel}
            onChangeText={setModelDraft}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={colors.muted}
          />
          <Button title="Salvar" variant="secondary" onPress={saveConfig} />
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  canvas: { width: '100%', backgroundColor: '#000', overflow: 'hidden', borderRadius: radius.md },
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  tag: { position: 'absolute', left: 10, top: 10, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  tagText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginVertical: 8,
    color: colors.text,
    backgroundColor: '#FBFCFE',
  },
});
