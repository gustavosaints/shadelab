import { StyleSheet, Text, View } from 'react-native';
import { labToHex, type Lab } from '@/lib/color/convert';
import { colors, radius } from '@/theme';

type Props = {
  shadeId: string;
  lab: Lab;
  deltaE: number;
  rank: number;
};

const RANK_LABEL: Record<number, string> = { 1: 'Mais provável', 2: 'Alternativa mais próxima' };

/** Linha de resultado: amostra da cor, nome do tab e o papel dele (mais provável / alternativa). */
export function ShadeRow({ shadeId, lab, deltaE, rank }: Props) {
  const first = rank === 1;
  return (
    <View style={[styles.row, first && styles.rowFirst]}>
      <View style={[styles.swatch, first && styles.swatchFirst, { backgroundColor: labToHex(lab) }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.role}>{RANK_LABEL[rank] ?? `${rank}ª opção`}</Text>
        <Text style={[styles.name, first && styles.nameFirst]}>{shadeId}</Text>
        <Text style={styles.de}>distância ΔE00 {deltaE.toFixed(1)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  rowFirst: { backgroundColor: '#F3F6FB', borderRadius: radius.md, paddingHorizontal: 10, marginBottom: 4 },
  swatch: { width: 48, height: 48, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  swatchFirst: { width: 64, height: 64 },
  role: { color: colors.muted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  nameFirst: { fontSize: 28 },
  de: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
