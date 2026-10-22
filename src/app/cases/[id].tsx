import * as Print from 'expo-print';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BeforeAfter, type CompareMode } from '@/components/BeforeAfter';
import { Button } from '@/components/Button';
import { Card, Muted, SectionTitle } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ShadeRow } from '@/components/ShadeRow';
import { findShade, getSystem } from '@/lib/color/shades';
import { deleteCase, getCase, isSmileCase, type AnyCase, type ShadeCase, type SmileCase } from '@/lib/storage/cases';
import { findGingiva } from '@/lib/color/gingiva';
import { buildShadeReportHtml } from '@/lib/report/shadeReport';
import { loadSettings } from '@/lib/storage/settings';
import { colors, radius, spacing } from '@/theme';

export default function CaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [c, setCase] = useState<AnyCase | null>(null);

  useEffect(() => {
    getCase(id).then((x) => setCase(x ?? null));
  }, [id]);

  if (!c) return <View style={{ flex: 1 }} />;
  return isSmileCase(c) ? <SmileDetail c={c} /> : <ShadeDetail c={c} />;
}

function SmileDetail({ c }: { c: SmileCase }) {
  const [mode, setMode] = useState<CompareMode>('cortina');
  const [aspect, setAspect] = useState(3 / 4);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    Image.getSize(
      c.photoUri,
      (w, h) => setAspect(w / h),
      () => undefined,
    );
  }, [c.photoUri]);
  const shareImage = async () => {
    const uri = c.renderedUri ?? c.photoUri;
    if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg' });
    } else {
      Alert.alert('Imagem', uri);
    }
  };
  const remove = () =>
    Alert.alert('Excluir simulação', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteCase(c.id);
          router.back();
        },
      },
    ]);
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }} scrollEnabled={!dragging}>
      {c.renderedUri ? (
        <>
          <BeforeAfter
            beforeUri={c.photoUri}
            afterUri={c.renderedUri}
            aspect={aspect}
            mode={mode}
            onDragStart={() => setDragging(true)}
            onDragEnd={() => setDragging(false)}
          />
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <Chip label="Cortina" selected={mode === 'cortina'} onPress={() => setMode('cortina')} />
            <Chip label="Transparência" selected={mode === 'transparencia'} onPress={() => setMode('transparencia')} />
          </View>
        </>
      ) : (
        <Image source={{ uri: c.photoUri }} style={styles.photo} resizeMode="cover" />
      )}
      <Card>
        <Text style={styles.name}>{c.patientName}</Text>
        <Muted>Smile Design · {new Date(c.createdAt).toLocaleString('pt-BR')}</Muted>
      </Card>
      <Card>
        <SectionTitle>Simulação</SectionTitle>
        <Text style={styles.param}>Cor: {c.targetShade}</Text>
        {c.aiStyle && <Text style={styles.param}>{c.aiStyle}</Text>}
        {c.ai?.model && <Text style={styles.param}>Modelo de IA: {c.ai.model}</Text>}
      </Card>
      {!!c.notes && (
        <Card>
          <SectionTitle>Observações</SectionTitle>
          <Text style={{ color: colors.text, lineHeight: 20 }}>{c.notes}</Text>
        </Card>
      )}
      <Button title="Gerar outra versão" onPress={() => router.push({ pathname: '/smile', params: { caseId: c.id } })} />
      <Button title="Compartilhar simulação" variant="secondary" onPress={shareImage} style={{ marginTop: 8 }} />
      <Button title="Excluir" variant="ghost" onPress={remove} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

function ShadeDetail({ c }: { c: ShadeCase }) {

  const system = getSystem(c.shadeSystem);
  const best = c.matches[0];

  const exportPdf = async () => {
    try {
      const s = await loadSettings();
      const html = await buildShadeReportHtml(c, s);
      const { uri } = await Print.printToFileAsync({ html });
      if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('PDF gerado', uri);
      }
    } catch (e) {
      Alert.alert('Erro ao exportar', String(e));
    }
  };

  const remove = () =>
    Alert.alert('Excluir caso', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteCase(c.id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
      <Image source={{ uri: c.photoUri }} style={styles.photo} resizeMode="cover" />
      <Card>
        <Text style={styles.name}>{c.patientName}</Text>
        <Muted>
          {c.tooth ? `Dente ${c.tooth} · ` : ''}
          {new Date(c.createdAt).toLocaleString('pt-BR')} · {c.referenceLabel}
        </Muted>
      </Card>
      <Card>
        <View style={styles.bestRow}>
          <View style={[styles.swatch, { backgroundColor: c.toothHex }]} />
          <View>
            <Text style={styles.bestLabel}>Cor sugerida</Text>
            <Text style={styles.best}>{best?.shadeId ?? '—'}</Text>
            <Muted>
              L*a*b* {c.toothLab.L} / {c.toothLab.a} / {c.toothLab.b}
            </Muted>
          </View>
        </View>
        <SectionTitle>{system.name}</SectionTitle>
        {c.matches.map((m, i) => (
          <ShadeRow
            key={m.shadeId}
            rank={i + 1}
            shadeId={m.shadeId}
            lab={findShade(c.shadeSystem, m.shadeId)?.lab ?? c.toothLab}
            deltaE={m.deltaE}
            image={findShade(c.shadeSystem, m.shadeId)?.image}
          />
        ))}
      </Card>
      {c.gingivaLab && (
        <Card>
          <View style={styles.bestRow}>
            <View style={[styles.swatch, { backgroundColor: c.gingivaHex }]} />
            <View>
              <Text style={styles.bestLabel}>Gengiva</Text>
              <Muted>
                L*a*b* {c.gingivaLab.L} / {c.gingivaLab.a} / {c.gingivaLab.b}
              </Muted>
            </View>
          </View>
          {c.gingivaMatches?.map((m, i) => (
            <ShadeRow key={m.shadeId} rank={i + 1} shadeId={m.shadeId} lab={findGingiva(m.shadeId)?.lab ?? c.gingivaLab!} deltaE={m.deltaE} />
          ))}
        </Card>
      )}
      {!!c.notes && (
        <Card>
          <SectionTitle>Observações</SectionTitle>
          <Text style={{ color: colors.text, lineHeight: 20 }}>{c.notes}</Text>
        </Card>
      )}
      <Button title="Exportar PDF para o laboratório" onPress={exportPdf} />
      <Button
        title="Refazer a análise de cor"
        variant="secondary"
        style={{ marginTop: 8 }}
        onPress={() =>
          router.push({
            pathname: '/shade/analyze',
            params: {
              uri: c.photoUri,
              w: String(c.photoWidth),
              h: String(c.photoHeight),
              caseId: c.id,
              patient: c.patientName,
              tooth: c.tooth,
              notes: c.notes,
              createdAt: c.createdAt,
            },
          })
        }
      />
      <Button title="Excluir caso" variant="ghost" onPress={remove} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, marginBottom: spacing.md },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  bestRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 },
  swatch: { width: 64, height: 64, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  bestLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  best: { fontSize: 28, fontWeight: '800', color: colors.primary },
  param: { color: colors.text, lineHeight: 22 },
});
