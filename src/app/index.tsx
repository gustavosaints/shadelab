import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Logo } from '@/components/Logo';
import { getSystem } from '@/lib/color/shades';
import { useAuth } from '@/lib/AuthContext';
import { useSettings } from '@/lib/useSettings';
import { colors, fonts, pastel, radius, spacing } from '@/theme';

type IconId = 'cor' | 'smile' | 'casos' | 'config';
type Tile = { title: string; subtitle: string; route: string; bg: string; icon: IconId };

/** Ícones de traço fino, no mesmo espírito da logomarca. */
function TileIcon({ id }: { id: IconId }) {
  const s = { stroke: colors.ink, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      {id === 'cor' && (
        <>
          <Rect x={8} y={3} width={10} height={20} rx={5} {...s} />
          <Path d="M8 9 H18" {...s} />
          <Circle cx={13} cy={16} r={2.2} {...s} />
        </>
      )}
      {id === 'smile' && (
        <>
          <Path d="M4 13 Q13 22 22 13" {...s} />
          <Path d="M13 3 Q13.6 6.4 17 7 Q13.6 7.6 13 11 Q12.4 7.6 9 7 Q12.4 6.4 13 3 Z" {...s} />
        </>
      )}
      {id === 'casos' && (
        <>
          <Path d="M3 8 Q3 6 5 6 H10 L12 8 H21 Q23 8 23 10 V19 Q23 21 21 21 H5 Q3 21 3 19 Z" {...s} />
          <Path d="M3 11 H23" {...s} />
        </>
      )}
      {id === 'config' && (
        <>
          <Path d="M4 7 H22 M4 13 H22 M4 19 H22" {...s} />
          <Circle cx={9} cy={7} r={2.2} fill={colors.surface} stroke={colors.ink} strokeWidth={1.6} />
          <Circle cx={17} cy={13} r={2.2} fill={colors.surface} stroke={colors.ink} strokeWidth={1.6} />
          <Circle cx={11} cy={19} r={2.2} fill={colors.surface} stroke={colors.ink} strokeWidth={1.6} />
        </>
      )}
    </Svg>
  );
}

export default function Home() {
  const [settings] = useSettings();
  const { user, lock } = useAuth();
  const insets = useSafeAreaInsets();
  const system = getSystem(settings.shadeSystem);
  const calibrated = Object.keys(settings.calibrations[settings.shadeSystem] ?? {}).length;

  const tiles: Tile[] = [
    { title: 'Tirar cor', subtitle: 'Fotografe o dente e compare com a escala, terço a terço', route: '/shade/capture', bg: pastel.blush, icon: 'cor' },
    { title: 'Smile Design', subtitle: 'Forma, textura e cor: a IA gera o novo sorriso, com antes e depois', route: '/smile', bg: pastel.sage, icon: 'smile' },
    { title: 'Casos', subtitle: 'Histórico dos pacientes e envio ao laboratório', route: '/cases', bg: pastel.powder, icon: 'casos' },
    {
      title: 'Configurações',
      subtitle: `Escala ${system.name} · ${calibrated}/${system.shades.length} tabs calibrados`,
      route: '/settings',
      bg: pastel.sand,
      icon: 'config',
    },
  ];

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Logo size={52} />
        {user && <Text style={styles.greeting}>{`Olá, ${user}`}</Text>}
      </View>
      {tiles.map((t) => (
        <Pressable
          key={t.title}
          onPress={() => router.push(t.route as never)}
          accessibilityRole="button"
          accessibilityLabel={t.title}
          style={({ pressed }) => [styles.tile, { backgroundColor: t.bg, opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={styles.iconWrap}>
            <TileIcon id={t.icon} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tileTitle}>{t.title}</Text>
            <Text style={styles.tileSub}>{t.subtitle}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
      <Pressable onPress={lock} style={styles.logout} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.logoutText}>Sair</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, gap: 12 },
  header: { alignItems: 'center', marginBottom: spacing.lg, gap: 14 },
  greeting: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, paddingVertical: 18, paddingHorizontal: spacing.md },
  iconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontFamily: fonts.medium, fontSize: 18, color: colors.text, marginBottom: 3 },
  tileSub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#5E5A60' },
  chevron: { fontSize: 26, color: colors.muted, marginTop: -2 },
  logout: { alignSelf: 'center', marginTop: spacing.md, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  logoutText: { fontFamily: fonts.medium, fontSize: 15, color: colors.primary },
});
