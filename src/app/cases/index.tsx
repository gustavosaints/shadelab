import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Muted } from '@/components/Card';
import { listCases, type ShadeCase } from '@/lib/storage/cases';
import { colors, radius, spacing } from '@/theme';

export default function Cases() {
  const [cases, setCases] = useState<ShadeCase[]>([]);
  useFocusEffect(
    useCallback(() => {
      listCases().then(setCases);
    }, []),
  );

  if (cases.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Nenhum caso ainda</Text>
        <Muted>Tire a cor de um dente e salve o caso para ele aparecer aqui.</Muted>
        <Button title="Tirar cor" onPress={() => router.push('/shade/capture')} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <FlatList
      data={cases}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: spacing.md }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/cases/[id]', params: { id: item.id } })}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={[styles.swatch, { backgroundColor: item.toothHex }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.patientName}</Text>
            <Muted>
              {item.tooth ? `Dente ${item.tooth} · ` : ''}
              {new Date(item.createdAt).toLocaleDateString('pt-BR')}
            </Muted>
          </View>
          <Text style={styles.shade}>{item.matches[0]?.shadeId ?? '—'}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: 10,
  },
  swatch: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  shade: { fontSize: 20, fontWeight: '800', color: colors.primary },
});
