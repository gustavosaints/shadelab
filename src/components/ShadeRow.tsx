import { Image, StyleSheet, Text, View } from 'react-native';
import { labToHex, type Lab } from '@/lib/color/convert';
import { describe3dMaster, type HcvDiff } from '@/lib/color/hcv';
import { colors, radius } from '@/theme';

type Props = {
  shadeId: string;
  lab: Lab;
  deltaE: number;
  rank: number;
  /** Foto do tab real da escala (asset), mostrada no lugar da amostra de cor. */
  image?: number;
  /** Dente × tab em valor, croma e matiz. */
  hcv?: HcvDiff;
};

const RANK_LABEL: Record<number, string> = { 1: 'Mais provável', 2: 'Alternativa mais próxima' };

/** Linha de resultado: amostra da cor, nome do tab e o papel dele (mais provável / alternativa). */
export function ShadeRow({ shadeId, lab, deltaE, rank, image, hcv }: Props) {
  const master = describe3dMaster(shadeId);
  const first = rank === 1;
  return (
    <View style={[styles.row, first && styles.rowFirst]}>
      <View style={[styles.swatch, first && styles.swatchFirst, { backgroundColor: labToHex(lab) }]}>
        {image !== undefined && <Image source={image} style={styles.tabImg} resizeMode="cover" accessibilityLabel={`Tab ${shadeId} da escala`} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.role}>{RANK_LABEL[rank] ?? `${rank}ª opção`}</Text>
        <Text style={[styles.name, first && styles.nameFirst]}>{shadeId}</Text>
        <Text style={styles.de}>distância ΔE00 {deltaE.toFixed(1)}</Text>
        {hcv && (
          <View style={styles.hcv}>
            <Text style={styles.hcvLine}>
              <Text style={styles.hcvKey}>Valor </Text>
              {hcv.text.value}
            </Text>
            <Text style={styles.hcvLine}>
              <Text style={styles.hcvKey}>Croma </Text>
              {hcv.text.chroma}
            </Text>
            <Text style={styles.hcvLine}>
              <Text style={styles.hcvKey}>Matiz </Text>
              {hcv.text.hue}
            </Text>
          </View>
        )}
        {master && <Text style={styles.master}>{master}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  rowFirst: { backgroundColor: '#F7EFEC', borderRadius: radius.md, paddingHorizontal: 10, marginBottom: 4 },
  swatch: { width: 48, height: 48, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  swatchFirst: { width: 64, height: 64 },
  tabImg: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', borderRadius: radius.sm },
  role: { color: colors.muted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  nameFirst: { fontSize: 28 },
  de: { color: colors.muted, fontSize: 12, marginTop: 2 },
  hcv: { marginTop: 4 },
  hcvLine: { color: colors.text, fontSize: 12, lineHeight: 17 },
  hcvKey: { fontWeight: '700', color: colors.primaryDark },
  master: { color: colors.muted, fontSize: 11, marginTop: 3, lineHeight: 15 },
});
