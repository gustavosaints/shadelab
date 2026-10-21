import * as Print from 'expo-print';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card, Muted, SectionTitle } from '@/components/Card';
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
  const shapeLabel = { oval: 'Oval', square: 'Quadrada', triangular: 'Triangular' }[c.params.shape];
  const propLabel = { natural: 'Natural', golden: 'Áurea', red: 'RED (70% / 50%)' }[c.params.proportion];
  const frame = c.frame;
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
      {c.renderedUri && <Image source={{ uri: c.renderedUri }} style={styles.photo} resizeMode="cover" />}
      <Card>
        <Text style={styles.name}>{c.patientName}</Text>
        <Muted>Smile Design · {new Date(c.createdAt).toLocaleString('pt-BR')}</Muted>
      </Card>
      <Card>
        <SectionTitle>Parâmetros</SectionTitle>
        <Text style={styles.param}>Cor-alvo: {c.targetShade}</Text>
        <Text style={styles.param}>Forma: {shapeLabel}</Text>
        <Text style={styles.param}>Proporção: {propLabel}</Text>
        <Text style={styles.param}>Relação altura/largura: {c.params.heightRatio.toFixed(2)}</Text>
        {frame && (
          <>
            <Text style={styles.param}>
              Análise facial: linha média {frame.midlineShiftMm.toFixed(1)} mm · bipupilar {frame.bipupillaryDeg.toFixed(1)}° · central{' '}
              {frame.widthHeightPct.toFixed(0)}% ({frame.centralWidthMm.toFixed(1)} × {frame.centralHeightMm.toFixed(1)} mm)
            </Text>
            {frame.notes.map((n, i) => (
              <Text key={i} style={styles.param}>
                • {n}
              </Text>
            ))}
          </>
        )}
      </Card>
      {!!c.notes && (
        <Card>
          <SectionTitle>Observações</SectionTitle>
          <Text style={{ color: colors.text, lineHeight: 20 }}>{c.notes}</Text>
        </Card>
      )}
      <Card>
        <SectionTitle>Foto original</SectionTitle>
        <Image source={{ uri: c.photoUri }} style={styles.photo} resizeMode="cover" />
      </Card>
      <Button title="Editar simulação" onPress={() => router.push({ pathname: '/smile', params: { caseId: c.id } })} />
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
