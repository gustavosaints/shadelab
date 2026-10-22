import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '@/theme';

/**
 * Logomarca do Cypris Smile (proposta D): "Cypris" na serifa fina Italiana, arco de sorriso rosé e "SMILE"
 * espaçado em Jost Light. `size` é o tamanho da palavra "Cypris" em pt; o resto acompanha.
 */
export function Logo({ size = 56, color = colors.ink, arc = colors.rose }: { size?: number; color?: string; arc?: string }) {
  const arcW = size * 2.5;
  const arcH = size * 0.25;
  return (
    <View style={styles.wrap} accessible accessibilityRole="image" accessibilityLabel="Cypris Smile">
      <Text style={{ fontFamily: fonts.display, fontSize: size, lineHeight: size * 1.15, letterSpacing: size * 0.06, color, marginRight: -size * 0.06 }}>
        Cypris
      </Text>
      <Svg width={arcW} height={arcH} viewBox="0 0 260 26">
        <Path d="M6 4 Q130 30 254 4" fill="none" stroke={arc} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
      <Text
        style={{
          fontFamily: fonts.light,
          fontSize: Math.max(9, size * 0.155),
          letterSpacing: size * 0.105,
          marginRight: -size * 0.105,
          marginTop: size * 0.08,
          color: colors.muted,
        }}
      >
        SMILE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
});
