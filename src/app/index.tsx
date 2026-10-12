import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSettings } from '@/lib/useSettings';
import { getSystem } from '@/lib/color/shades';
import { colors, radius, spacing } from '@/theme';

type Tile = { title: string; subtitle: string; route: string; color: string; soon?: boolean };

export default function Home() {
  const [settings] = useSettings();
  const system = getSystem(settings.shadeSystem);
  const calibrated = Object.keys(settings.calibrations[settings.shadeSystem] ?? {}).length;

  const tiles: Tile[] = [
    {
      title: 'Tirar cor',
      subtitle: 'Fotografe o dente com a referência e compare com a escala',
      route: '/shade/capture',
      color: colors.primary,
    },
    {
      title: 'Smile Design',
      subtitle: 'Simule o novo sorriso sobre a foto do paciente',
      route: '/smile',
      color: colors.accent,
      soon: true,
    },
    { title: 'Casos', subtitle: 'Histórico de pacientes e envio ao laboratório', route: '/cases', color: colors.navy },
    {
      title: 'Configurações',
      subtitle: `Escala: ${system.name} · ${calibrated}/${system.shades.length} tabs calibrados`,
      route: '/settings',
      color: colors.muted,
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Cor digital para a clínica</Text>
        <Text style={styles.heroText}>
          Tire a cor com a câmera, corrija pela referência e registre o caso para o laboratório.
        </Text>
      </View>
      {tiles.map((t) => (
        <Pressable
          key={t.title}
          onPress={() => router.push(t.route as never)}
          style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={[styles.bar, { backgroundColor: t.color }]} />
          <View style={{ flex: 1 }}>
            <View style={styles.tileHead}>
              <Text style={styles.tileTitle}>{t.title}</Text>
              {t.soon && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>em breve</Text>
                </View>
              )}
            </View>
            <Text style={styles.tileSub}>{t.subtitle}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md },
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.lg },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  heroText: { color: '#C9D3E6', fontSize: 14, lineHeight: 20 },
  tile: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  bar: { width: 6 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, paddingBottom: 4 },
  tileTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  tileSub: { color: colors.muted, paddingHorizontal: spacing.md, paddingBottom: spacing.md, lineHeight: 18 },
  badge: { backgroundColor: '#E8F7F1', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
});
