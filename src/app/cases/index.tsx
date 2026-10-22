import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Muted } from '@/components/Card';
import { SwipeRow } from '@/components/SwipeRow';
import { shareShadeCasePdf } from '@/lib/report/shareShadeCase';
import { deleteCases, isSmileCase, listCases, type AnyCase, type ShadeCase, type SmileCase } from '@/lib/storage/cases';
import { colors, fonts, pastel, radius, spacing } from '@/theme';

type Tab = 'shade' | 'smile';

/**
 * Casos separados em duas abas (pedido do Gustavo, 2026-10-22): tomada de cor e Smile Design. Na tomada de cor:
 * arrastar para a direita envia o PDF, para a esquerda exclui (com confirmação), e o modo "Selecionar" permite
 * marcar vários (ou todos) e excluir de uma vez.
 */
export default function Cases() {
  const [cases, setCases] = useState<AnyCase[]>([]);
  const [tab, setTab] = useState<Tab>('shade');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [swiping, setSwiping] = useState(false);

  const reload = useCallback(() => {
    listCases().then(setCases);
  }, []);
  useFocusEffect(reload);

  const shadeCases = cases.filter((c): c is ShadeCase => !isSmileCase(c));
  const smileCases = cases.filter(isSmileCase);
  const canSelect = tab === 'shade' && shadeCases.length > 0;

  const switchTab = (t: Tab) => {
    setTab(t);
    setSelecting(false);
    setSelected(new Set());
  };
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = shadeCases.length > 0 && selected.size === shadeCases.length;

  const confirmDelete = (title: string, message: string) =>
    new Promise<boolean>((resolve) =>
      Alert.alert(title, message, [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Excluir', style: 'destructive', onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) }),
    );

  const deleteOne = async (c: ShadeCase) => {
    const ok = await confirmDelete('Excluir caso', `Tem certeza que deseja excluir o caso de ${c.patientName}? Essa ação não pode ser desfeita.`);
    if (ok) {
      await deleteCases([c.id]);
      reload();
    }
    return ok;
  };
  const deleteSelected = async () => {
    const n = selected.size;
    if (n === 0) return;
    const ok = await confirmDelete(
      n === 1 ? 'Excluir caso' : `Excluir ${n} casos`,
      allSelected
        ? `Tem certeza que deseja excluir TODOS os ${n} casos de tomada de cor? Essa ação não pode ser desfeita.`
        : `Tem certeza que deseja excluir ${n === 1 ? 'o caso selecionado' : `os ${n} casos selecionados`}? Essa ação não pode ser desfeita.`,
    );
    if (!ok) return;
    await deleteCases([...selected]);
    stopSelecting();
    reload();
  };

  const open = (id: string) => router.push({ pathname: '/cases/[id]', params: { id } });

  const shadeRow = (item: ShadeCase) => {
    const checked = selected.has(item.id);
    return (
      <SwipeRow
        enabled={!selecting}
        onSend={() => shareShadeCasePdf(item)}
        onDelete={() => deleteOne(item)}
        onSwipeStart={() => setSwiping(true)}
        onSwipeEnd={() => setSwiping(false)}
      >
        <Pressable
          onPress={() => (selecting ? toggle(item.id) : open(item.id))}
          onLongPress={() => {
            if (selecting) return;
            setSelecting(true);
            setSelected(new Set([item.id]));
          }}
          style={({ pressed }) => [styles.row, checked && styles.rowChecked, { opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole={selecting ? 'checkbox' : 'button'}
          accessibilityState={selecting ? { checked } : undefined}
          accessibilityHint={selecting ? undefined : 'Arraste para a direita para enviar o PDF, para a esquerda para excluir'}
        >
          {selecting && (
            <View style={[styles.check, checked && styles.checkOn]}>
              {checked && <Text style={styles.checkMark}>✓</Text>}
            </View>
          )}
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
      </SwipeRow>
    );
  };

  const smileRow = (item: SmileCase) => (
    <Pressable onPress={() => open(item.id)} style={({ pressed }) => [styles.row, styles.rowSpaced, { opacity: pressed ? 0.85 : 1 }]}>
      <Image source={{ uri: item.renderedUri ?? item.photoUri }} style={styles.swatch} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.patientName}</Text>
        <Muted>Smile Design · {new Date(item.createdAt).toLocaleDateString('pt-BR')}</Muted>
      </View>
      <Text style={styles.shade}>{item.targetShade}</Text>
    </Pressable>
  );

  const empty =
    tab === 'shade' ? (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Nenhum caso de cor ainda</Text>
        <Muted>Tire a cor de um dente e salve o caso para ele aparecer aqui.</Muted>
        <Button title="Tirar cor" onPress={() => router.push('/shade/capture')} style={{ marginTop: 16 }} />
      </View>
    ) : (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Nenhum Smile Design ainda</Text>
        <Muted>Gere um Smile Design e salve o caso para ele aparecer aqui.</Muted>
        <Button title="Smile Design" onPress={() => router.push('/smile')} style={{ marginTop: 16 }} />
      </View>
    );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: canSelect
            ? () => (
                <Pressable onPress={() => (selecting ? stopSelecting() : setSelecting(true))} hitSlop={10} accessibilityRole="button">
                  <Text style={styles.headerBtn}>{selecting ? 'Cancelar' : 'Selecionar'}</Text>
                </Pressable>
              )
            : undefined,
        }}
      />

      <View style={styles.tabs}>
        {(
          [
            ['shade', 'Tomada de cor', shadeCases.length],
            ['smile', 'Smile Design', smileCases.length],
          ] as const
        ).map(([id, label, n]) => (
          <Pressable key={id} onPress={() => switchTab(id)} style={[styles.tab, tab === id && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}>
            <Text style={[styles.tabText, tab === id && styles.tabTextOn]}>{`${label} (${n})`}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'shade' ? (
        <FlatList
          data={shadeCases}
          keyExtractor={(c) => c.id}
          scrollEnabled={!swiping}
          contentContainerStyle={{ padding: spacing.md, paddingTop: 4, flexGrow: 1 }}
          ListHeaderComponent={
            shadeCases.length > 0 && !selecting ? <Text style={styles.hint}>Arraste para a direita para enviar o PDF, para a esquerda para excluir.</Text> : null
          }
          ListEmptyComponent={empty}
          renderItem={({ item }) => shadeRow(item)}
        />
      ) : (
        <FlatList
          data={smileCases}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.md, paddingTop: 4, flexGrow: 1 }}
          ListEmptyComponent={empty}
          renderItem={({ item }) => smileRow(item)}
        />
      )}

      {selecting && (
        <View style={styles.selectBar}>
          <Pressable onPress={() => setSelected(allSelected ? new Set() : new Set(shadeCases.map((c) => c.id)))} hitSlop={8} accessibilityRole="button">
            <Text style={styles.selectAll}>{allSelected ? 'Desmarcar todos' : 'Selecionar todos'}</Text>
          </Pressable>
          <Text style={styles.selectCount}>{selected.size === 1 ? '1 selecionado' : `${selected.size} selecionados`}</Text>
          <Pressable
            onPress={deleteSelected}
            disabled={selected.size === 0}
            style={[styles.deleteBtn, selected.size === 0 && { opacity: 0.4 }]}
            accessibilityRole="button"
          >
            <Text style={styles.deleteText}>{allSelected ? 'Excluir todos' : 'Excluir'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', margin: spacing.md, marginBottom: 8, padding: 4, borderRadius: radius.lg, backgroundColor: pastel.blush },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.lg - 4, alignItems: 'center' },
  tabOn: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  tabText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  tabTextOn: { fontFamily: fonts.medium, color: colors.text },
  hint: { color: colors.muted, fontSize: 12, marginBottom: 10, textAlign: 'center' },
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
  },
  rowSpaced: { marginBottom: 10 },
  rowChecked: { borderColor: colors.primary, backgroundColor: '#FBF4F2' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  swatch: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  shade: { fontSize: 20, fontWeight: '800', color: colors.primary },
  headerBtn: { color: colors.primary, fontFamily: fonts.medium, fontSize: 16 },
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectAll: { color: colors.primary, fontFamily: fonts.medium, fontSize: 15 },
  selectCount: { color: colors.muted, fontSize: 13 },
  deleteBtn: { backgroundColor: colors.danger, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10 },
  deleteText: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 15 },
});
