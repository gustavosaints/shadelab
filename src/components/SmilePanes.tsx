import { forwardRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SmileOverlay } from '@/components/SmileOverlay';
import type { SmileLibraryEntry } from '@/lib/smile/smileLibrary';
import type { SmileParams } from '@/lib/smile/teeth';
import { radius } from '@/theme';

export type Pane = { label: string; params?: SmileParams; library?: SmileLibraryEntry };

type Props = {
  photoUri: string;
  /** Largura/altura da foto. */
  aspect: number;
  /** Painéis da esquerda para a direita; `params` ausente = foto original ("antes"). */
  panes: Pane[];
};

/**
 * Painéis lado a lado (antes/depois ou variações) com a simulação desenhada em
 * cada um. Como o layout é em frações da imagem, a mesma simulação se adapta à
 * largura menor do painel. Pode ser capturado para exportar.
 */
export const SmilePanes = forwardRef<View, Props>(function SmilePanes({ photoUri, aspect, panes }, ref) {
  const [paneSize, setPaneSize] = useState({ width: 0, height: 0 });
  return (
    <View ref={ref} collapsable={false} style={styles.row}>
      {panes.map((p, i) => (
        <View key={i} style={[styles.pane, { aspectRatio: aspect }]} onLayout={i === 0 ? (e) => setPaneSize(e.nativeEvent.layout) : undefined}>
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {p.params && paneSize.width > 0 && (
            <SmileOverlay params={p.params} width={paneSize.width} height={paneSize.height} library={p.library} />
          )}
          <View style={styles.tag}>
            <Text style={styles.tagText}>{p.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2, backgroundColor: '#000' },
  pane: { flex: 1, overflow: 'hidden', backgroundColor: '#000' },
  tag: {
    position: 'absolute',
    left: 6,
    top: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  tagText: { color: '#fff', fontWeight: '800', fontSize: 11 },
});
