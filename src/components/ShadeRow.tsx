import { StyleSheet, Text, View } from 'react-native';
import { labToHex, type Lab } from '@/lib/color/convert';
import { colors, qualityColor, qualityLabel, radius } from '@/theme';

type Props = {
  shadeId: string;
  lab: Lab;
  deltaE: number;
  quality: string;
  rank: number;
};

export function ShadeRow({ shadeId, lab, deltaE, quality, rank }: Props) {
  const bar = Math.max(4, Math.min(100, 100 - deltaE * 12));
  return (
    <View style={styles.row}>
      <View style={[styles.swatch, { backgroundColor: labToHex(lab) }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.line}>
          <Text style={styles.name}>
            {rank}. {shadeId}
          </Text>
          <Text style={[styles.quality, { color: qualityColor[quality] }]}>{qualityLabel[quality]}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${bar}%`, backgroundColor: qualityColor[quality] }]} />
        </View>
        <Text style={styles.de}>ΔE00 = {deltaE.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  swatch: { width: 48, height: 48, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  quality: { fontSize: 12, fontWeight: '700' },
  track: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  de: { color: colors.muted, fontSize: 12, marginTop: 4 },
});
