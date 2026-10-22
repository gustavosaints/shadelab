import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { TextureId } from '@/lib/ai/prompt';
import { applyLength, silhouette, TEXTURE_TEETH, type Fdi, type LengthEdits, type MappedTooth, type ToothMap } from '@/lib/smile/mapping';
import { fonts, radius } from '@/theme';

type Photo = { uri: string; width: number; height: number };

type Props = {
  photo: Photo;
  map: ToothMap | null;
  status: 'detecting' | 'ok' | 'failed';
  /** 0 quadrada … 1 triangular; null = nenhuma forma escolhida (só os números dos dentes). */
  shapeMix: number | null;
  texture: TextureId | null;
  lengths: LengthEdits;
  selected: Fdi | 'all';
  onSelect: (fdi: Fdi) => void;
};

const GLOW = '#F3C9BE';

/**
 * Planejamento sobre a foto (pedido do Gustavo, 2026-10-22): recorte ampliado da boca com os dentes 15–25
 * numerados; com uma forma escolhida, a silhueta dela aparece em cada dente (já com os ajustes de comprimento);
 * com uma textura escolhida, uma prévia transparente dela aparece nos incisivos 12, 11, 21 e 22. Tocar num dente
 * seleciona para ajustar só ele.
 */
export function SmileMap({ photo, map, status, shapeMix, texture, lengths, selected, onSelect }: Props) {
  const [width, setWidth] = useState(0);
  const teeth = map ? map.teeth.map((t) => applyLength(t, lengths[t.fdi], map.pxPerMm)) : [];

  // recorte em volta dos dentes (ou a foto inteira, sem mapa)
  let crop = { x: 0, y: 0, w: photo.width, h: photo.height };
  if (teeth.length) {
    const x0 = Math.min(...teeth.map((t) => t.x));
    const x1 = Math.max(...teeth.map((t) => t.x + t.w));
    const y0 = Math.min(...teeth.map((t) => t.y));
    const y1 = Math.max(...teeth.map((t) => t.y + t.h));
    const w = (x1 - x0) * 1.3;
    const h = Math.max((y1 - y0) * 2.1, w / 2.4);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    crop = { x: cx - w / 2, y: cy - h / 2, w, h };
  }
  const aspect = crop.w / crop.h;
  const s = width / crop.w;
  const toView = (t: MappedTooth): MappedTooth => ({ ...t, x: (t.x - crop.x) * s, y: (t.y - crop.y) * s, w: t.w * s, h: t.h * s });
  const view = teeth.map(toView);
  const textureMix = shapeMix ?? 0.5;

  return (
    <View style={[styles.box, { aspectRatio: aspect }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <>
          <Image
            source={{ uri: photo.uri }}
            style={{ position: 'absolute', left: -crop.x * s, top: -crop.y * s, width: photo.width * s, height: photo.height * s }}
            resizeMode="cover"
          />
          {view.length > 0 && (
            <Svg width={width} height={width / aspect} style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id="tx-body" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.2" />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.06" />
                </LinearGradient>
                <LinearGradient id="tx-gloss" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                  <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.5" />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                </LinearGradient>
                <LinearGradient id="tx-incisal" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#9DB2CF" stopOpacity="0" />
                  <Stop offset="1" stopColor="#9DB2CF" stopOpacity="0.55" />
                </LinearGradient>
                <LinearGradient id="tx-cervical" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#D9A066" stopOpacity="0.45" />
                  <Stop offset="1" stopColor="#D9A066" stopOpacity="0" />
                </LinearGradient>
                {texture &&
                  view
                    .filter((t) => TEXTURE_TEETH.includes(t.fdi))
                    .map((t) => (
                      <ClipPath key={t.fdi} id={`clip-${t.fdi}`}>
                        <Path d={silhouette(t, textureMix)} />
                      </ClipPath>
                    ))}
              </Defs>

              {/* prévia da textura nos incisivos */}
              {texture &&
                view
                  .filter((t) => TEXTURE_TEETH.includes(t.fdi))
                  .map((t) => (
                    <G key={`tx-${t.fdi}`} clipPath={`url(#clip-${t.fdi})`}>
                      {textureLayers(texture, t)}
                    </G>
                  ))}

              {/* silhuetas da forma */}
              {shapeMix !== null &&
                view.map((t) => {
                  const on = selected === 'all' || selected === t.fdi;
                  return (
                    <Path
                      key={`sil-${t.fdi}`}
                      d={silhouette(t, shapeMix)}
                      fill={texture ? 'none' : 'rgba(255,255,255,0.10)'}
                      stroke={selected === t.fdi ? GLOW : '#FFFFFF'}
                      strokeOpacity={on ? 0.95 : 0.55}
                      strokeWidth={selected === t.fdi ? 2.2 : 1.4}
                    />
                  );
                })}

              {/* números (mapeamento) e área de toque de cada dente */}
              {view.map((t) => {
                const cx = t.x + t.w / 2;
                const y = t.y - 5;
                const sel = selected === t.fdi;
                return (
                  <G key={`lbl-${t.fdi}`} onPress={() => onSelect(t.fdi)}>
                    <Rect x={t.x} y={t.y - 16} width={t.w} height={t.h + 16} fill="rgba(0,0,0,0.001)" />
                    {shapeMix === null && <Ellipse cx={cx} cy={t.y + t.h * 0.55} rx={2.2} ry={2.2} fill="#FFFFFF" opacity={0.85} />}
                    <SvgText x={cx} y={y} fontSize={10} fontWeight="700" textAnchor="middle" stroke="rgba(0,0,0,0.55)" strokeWidth={3} fill="none">
                      {t.fdi}
                    </SvgText>
                    <SvgText x={cx} y={y} fontSize={10} fontWeight="700" textAnchor="middle" fill={sel ? GLOW : '#FFFFFF'}>
                      {t.fdi}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>
          )}
          {status !== 'ok' && (
            <View style={styles.badge}>
              {status === 'detecting' && <ActivityIndicator size="small" color="#FFFFFF" />}
              <Text style={styles.badgeText}>{status === 'detecting' ? 'Mapeando os dentes…' : 'Não encontrei o sorriso automaticamente'}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

/** Camadas da prévia de textura dentro do contorno do dente (coordenadas da vista). */
function textureLayers(texture: TextureId, t: MappedTooth): ReactNode {
  const { x, y, w, h } = t;
  const at = (fx: number, fy: number) => [x + fx * w, y + fy * h] as const;
  const body = <Rect key="body" x={x} y={y} width={w} height={h} fill="url(#tx-body)" />;
  const gloss = <Rect key="gloss" x={x + w * 0.26} y={y} width={w * 0.18} height={h} fill="url(#tx-gloss)" />;
  if (texture === 'lisa') return [body, gloss];

  const strong = texture === 'caracterizada';
  const lines: ReactNode[] = [];
  // periquimácias: linhas horizontais finas e levemente curvas
  for (let k = 0; k < 9; k++) {
    const fy = 0.2 + k * 0.065;
    const [ax, ay] = at(0, fy);
    const [bx] = at(1, fy);
    lines.push(
      <Path key={`p${k}`} d={`M ${ax} ${ay} Q ${(ax + bx) / 2} ${ay - h * 0.025} ${bx} ${ay}`} stroke="#FFFFFF" strokeOpacity={strong ? 0.32 : 0.2} strokeWidth={0.6} fill="none" />,
    );
  }
  // sulcos de desenvolvimento verticais
  for (const fx of [0.36, 0.64]) {
    const [ax, ay] = at(fx, 0.15);
    const [, by] = at(fx, 0.72);
    lines.push(<Line key={`g${fx}`} x1={ax} y1={ay} x2={ax} y2={by} stroke="#FFFFFF" strokeOpacity={strong ? 0.28 : 0.16} strokeWidth={w * 0.05} strokeLinecap="round" />);
  }
  const incisal = <Rect key="inc" x={x} y={y + h * 0.78} width={w} height={h * 0.22} fill="url(#tx-incisal)" opacity={strong ? 1 : 0.6} />;
  if (!strong) return [body, ...lines, incisal, gloss];

  // caracterizada: mamelos, halo incisal, colo mais saturado, manchas brancas e trinca de esmalte
  const mamelons = [0.25, 0.5, 0.75].map((fx) => {
    const [cx, cy] = at(fx, 0.8);
    return <Ellipse key={`m${fx}`} cx={cx} cy={cy} rx={w * 0.11} ry={h * 0.09} fill="#FFFFFF" opacity={0.22} />;
  });
  const [hx0, hy] = at(0.08, 0.965);
  const [hx1] = at(0.92, 0.965);
  const halo = <Line key="halo" x1={hx0} y1={hy} x2={hx1} y2={hy} stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.2} strokeLinecap="round" />;
  const cervical = <Rect key="cerv" x={x} y={y} width={w} height={h * 0.25} fill="url(#tx-cervical)" />;
  const [s1x, s1y] = at(0.3, 0.45);
  const [s2x, s2y] = at(0.68, 0.32);
  const spots = [
    <Ellipse key="s1" cx={s1x} cy={s1y} rx={w * 0.06} ry={h * 0.025} fill="#FFFFFF" opacity={0.4} />,
    <Ellipse key="s2" cx={s2x} cy={s2y} rx={w * 0.04} ry={h * 0.018} fill="#FFFFFF" opacity={0.35} />,
  ];
  const [cx0, cy0] = at(0.55, 0.12);
  const [cx1, cy1] = at(0.5, 0.6);
  const crack = <Line key="crack" x1={cx0} y1={cy0} x2={cx1} y2={cy1} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={0.6} />;
  return [body, cervical, ...lines, ...mamelons, incisal, halo, ...spots, crack, gloss];
}

const styles = StyleSheet.create({
  box: { width: '100%', borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' },
  badge: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(31,34,43,0.85)',
  },
  badgeText: { color: '#FFFFFF', fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', flexShrink: 1 },
});
