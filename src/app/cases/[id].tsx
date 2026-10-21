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
import { loadSettings } from '@/lib/storage/settings';
import { colors, qualityLabel, radius, spacing } from '@/theme';

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
      const rows = c.matches
        .map(
          (m, i) =>
            `<tr><td>${i + 1}</td><td><b>${m.shadeId}</b></td><td>${m.deltaE.toFixed(2)}</td><td>${qualityLabel[m.quality] ?? m.quality}</td></tr>`,
        )
        .join('');
      const html = `
<html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,Helvetica,Arial;padding:28px;color:#13203A}
h1{margin:0 0 4px;font-size:22px} .muted{color:#6B7690;font-size:13px}
table{border-collapse:collapse;margin-top:10px;width:100%} td,th{border:1px solid #E3E7EF;padding:8px;text-align:left;font-size:14px}
.sw{display:inline-block;width:28px;height:28px;border-radius:6px;border:1px solid #ccc;vertical-align:middle;margin-right:8px}
.box{border:1px solid #E3E7EF;border-radius:10px;padding:14px;margin-top:14px}
</style></head><body>
<h1>Prescrição de cor</h1>
<div class="muted">${s.clinicName || 'ShadeLab'}${s.dentistName ? ' · ' + s.dentistName : ''} · ${new Date(c.createdAt).toLocaleString('pt-BR')}</div>
<div class="box">
<b>Paciente:</b> ${esc(c.patientName)}<br/>
<b>Dente:</b> ${esc(c.tooth) || '—'}<br/>
<b>Escala:</b> ${system.name} ${c.calibrated ? '(calibrada no aparelho)' : '(valores padrão)'}<br/>
<b>Referência usada:</b> ${esc(c.referenceLabel)}
</div>
<div class="box">
<span class="sw" style="background:${c.toothHex}"></span><b>Cor sugerida: ${best?.shadeId ?? '—'}</b>
<div class="muted">Dente medido L*a*b* = ${c.toothLab.L} / ${c.toothLab.a} / ${c.toothLab.b}</div>
<table><tr><th>#</th><th>Tab</th><th>ΔE00</th><th>Classificação</th></tr>${rows}</table>
</div>
${
  c.gingivaLab
    ? `<div class="box"><span class="sw" style="background:${c.gingivaHex}"></span><b>Gengiva</b> L*a*b* = ${c.gingivaLab.L} / ${c.gingivaLab.a} / ${c.gingivaLab.b}</div>`
    : ''
}
${c.notes ? `<div class="box"><b>Observações</b><br/>${esc(c.notes).replace(/\n/g, '<br/>')}</div>` : ''}
<div class="box"><img src="${c.photoUri}" style="max-width:100%;border-radius:8px"/></div>
<p class="muted">Medição por câmera corrigida por referência. Confirme visualmente com a escala antes da cimentação.</p>
</body></html>`;
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
            quality={m.quality}
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

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
