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
import { SmileOverlay } from '@/components/SmileOverlay';
import { labToHex } from '@/lib/color/convert';
import { getSystem } from '@/lib/color/shades';
import { clampParams, DEFAULT_SMILE_PARAMS, type SmileParams } from '@/lib/smile/teeth';
import { newCaseId, persistPhoto, saveCase } from '@/lib/storage/cases';
import { useSettings } from '@/lib/useSettings';
import { colors, radius, spacing } from '@/theme';

type Photo = { uri: string; width: number; height: number };

export default function Smile() {
  const [settings] = useSettings();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [params, setParams] = useState<SmileParams>(DEFAULT_SMILE_PARAMS);
  const [targetShade, setTargetShade] = useState('B1');
  const [hidden, setHidden] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [notes, setNotes] = useState('');
  const canvasRef = useRef<View>(null);
  const dragStart = useRef<{ x: number; y: number; midlineX: number; gumY: number } | null>(null);

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

  // Arrastar em qualquer ponto da foto move o conjunto (linha média + linha cervical).
  const onGrant = (e: GestureResponderEvent) => {
    dragStart.current = {
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
      midlineX: params.midlineX,
      gumY: params.gumY,
    };
  };
  const onMove = (e: GestureResponderEvent) => {
    const s = dragStart.current;
    if (!s || !area.width) return;
    set({
      midlineX: s.midlineX + (e.nativeEvent.pageX - s.x) / area.width,
      gumY: s.gumY + (e.nativeEvent.pageY - s.y) / area.height,
    });
  };

  const exportImage = async (): Promise<string | null> => {
    try {
      return await captureRef(canvasRef, { format: 'jpg', quality: 0.95 });
    } catch (e) {
      Alert.alert('Não foi possível exportar', String(e));
      return null;
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

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View
        ref={canvasRef}
        collapsable={false}
        style={[styles.canvas, { aspectRatio: aspect }]}
        onLayout={(e) => setArea(e.nativeEvent.layout)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
      >
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <SmileOverlay params={params} width={area.width} height={area.height} hidden={hidden} />
      </View>

      <View style={{ padding: spacing.md }}>
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
          <SectionTitle>Cor-alvo</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {system.shades.map((s) => (
              <Chip key={s.id} label={s.id} selected={targetShade === s.id} onPress={() => chooseShade(s.id)} />
            ))}
          </ScrollView>
          <SectionTitle>Forma</SectionTitle>
          <View style={styles.chips}>
            <Chip label="Oval" selected={params.shape === 'oval'} onPress={() => set({ shape: 'oval' })} />
            <Chip label="Quadrada" selected={params.shape === 'square'} onPress={() => set({ shape: 'square' })} />
            <Chip
              label="Triangular"
              selected={params.shape === 'triangular'}
              onPress={() => set({ shape: 'triangular' })}
            />
          </View>
          <SectionTitle>Proporção</SectionTitle>
          <View style={styles.chips}>
            <Chip
              label="Natural (78% / 84%)"
              selected={params.proportion === 'natural'}
              onPress={() => set({ proportion: 'natural' })}
            />
            <Chip
              label="Áurea (62% / 38%)"
              selected={params.proportion === 'golden'}
              onPress={() => set({ proportion: 'golden' })}
            />
          </View>
        </Card>

        <Card>
          <SectionTitle>Ajustes</SectionTitle>
          <Muted>Arraste a foto para posicionar a linha média e a linha cervical.</Muted>
          <Control label="Largura" value={params.centralWidth} min={0.04} max={0.2} onChange={(v) => set({ centralWidth: v })} />
          <Control label="Comprimento" value={params.heightRatio} min={0.8} max={1.6} onChange={(v) => set({ heightRatio: v })} />
          <Control label="Espaçamento" value={params.spacing} min={0} max={0.15} onChange={(v) => set({ spacing: v })} />
          <Control label="Curva do sorriso" value={params.curve} min={-0.1} max={0.35} onChange={(v) => set({ curve: v })} />
          <Control label="Opacidade" value={params.opacity} min={0.2} max={1} onChange={(v) => set({ opacity: v })} />
        </Card>

        <Button title="Compartilhar imagem" variant="secondary" onPress={share} />

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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  compare: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  compareText: { color: '#fff', fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  controlLabel: { color: colors.text, fontWeight: '600', fontSize: 13 },
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
