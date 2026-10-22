import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { TextureId } from '@/lib/ai/prompt';
import { silhouette, TEXTURE_TEETH, type ArchHandle, type Fdi, type MappedTooth } from '@/lib/smile/mapping';
import { mouthPath } from '@/lib/smile/mouth';
import type { MouthPoint } from '@/lib/smile/teeth';
import { fonts, radius } from '@/theme';

type Photo = { uri: string; width: number; height: number };

type Props = {
  photo: Photo;
  /** Altura da vista (px); a largura é a do pai. O recorte segue essa proporção. */
  height: number;
  /** Dentes como devem aparecer (arco e comprimentos já aplicados), em px da foto. */
  teeth: MappedTooth[];
  status: 'detecting' | 'ok' | 'failed';
  /** 0 quadrada … 1 triangular; null = nenhuma forma escolhida (só os números dos dentes). */
  shapeMix: number | null;
  texture: TextureId | null;
  selected: Fdi | 'all';
  onSelect: (fdi: Fdi) => void;
  /** Alças do arco na foto (mover, largura, abrir/fechar + curva). dx/dy: total desde o toque, em px da foto. */
  onArchDrag?: (handle: ArchHandle, dx: number, dy: number, phase: 'start' | 'move' | 'end') => void;
  /** Texto mostrado no canto enquanto arrasta uma alça (ex.: "abertura +40 %"). */
  hint?: string | null;
  /** Contorno da boca (lado de dentro dos lábios), desenhado de leve para conferir a delimitação automática. */
  mouth?: MouthPoint[] | null;
};

const CYAN = '#4FD1C5';

const GLOW = '#F3C9BE';

/**
 * Planejamento sobre a foto (pedido do Gustavo, 2026-10-22): recorte ampliado da boca com os dentes 15–25
 * numerados; com uma forma escolhida, a silhueta dela aparece em cada dente (já com os ajustes de comprimento);
 * com uma textura escolhida, uma prévia transparente dela aparece nos incisivos 12, 11, 21 e 22. Tocar num dente
 * seleciona para ajustar só ele. Pinça aproxima (até 5x) e, aproximada, um dedo arrasta a vista.
 */
export function SmileMap({ photo, height, teeth, status, shapeMix, texture, selected, onSelect, onArchDrag, hint, mouth }: Props) {
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState({ scale: 1, tx: 0, ty: 0 });
  const gesture = useRef<{ x: number; y: number; dist: number; scale: number; tx: number; ty: number; pinch: boolean } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  // a foto inteira, centralizada no quadro (o rosto não é cortado; a pinça aproxima — pedido do Gustavo)
  const aspect = width && height ? width / height : 1;
  const fit = photo.width / photo.height > aspect ? { w: photo.width, h: photo.width / aspect } : { w: photo.height * aspect, h: photo.height };
  const crop = { x: (photo.width - fit.w) / 2, y: (photo.height - fit.h) / 2, ...fit };
  const s = width / crop.w;
  // números, contornos e alças mantêm o tamanho na tela com zoom (divididos pelo zoom)
  const z = zoom.scale;
  const toView = (t: MappedTooth): MappedTooth => ({ ...t, x: (t.x - crop.x) * s, y: (t.y - crop.y) * s, w: t.w * s, h: t.h * s });
  const view = teeth.map(toView);
  const textureMix = shapeMix ?? 0.5;

  // ----- zoom: pinça com dois dedos; com zoom, um dedo arrasta (toques curtos continuam escolhendo o dente) -----
  const touches = (e: GestureResponderEvent) => e.nativeEvent.touches ?? [];
  const spread = (e: GestureResponderEvent) => {
    const t = touches(e);
    return t.length >= 2 ? Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY) : 0;
  };
  const clampZoom = (z: { scale: number; tx: number; ty: number }) => {
    const mx = ((z.scale - 1) * width) / 2;
    const my = ((z.scale - 1) * height) / 2;
    return { scale: z.scale, tx: Math.max(-mx, Math.min(mx, z.tx)), ty: Math.max(-my, Math.min(my, z.ty)) };
  };
  const startCapture = (e: GestureResponderEvent) => {
    start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    return touches(e).length >= 2;
  };
  const moveCapture = (e: GestureResponderEvent) => {
    if (touches(e).length >= 2) return true;
    if (zoom.scale <= 1 || !start.current) return false;
    return Math.hypot(e.nativeEvent.pageX - start.current.x, e.nativeEvent.pageY - start.current.y) > 8;
  };
  const grant = (e: GestureResponderEvent) => {
    gesture.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, dist: spread(e), scale: zoom.scale, tx: zoom.tx, ty: zoom.ty, pinch: touches(e).length >= 2 };
  };
  const move = (e: GestureResponderEvent) => {
    const g = gesture.current;
    if (!g) return;
    const d = spread(e);
    if (d > 0) {
      if (!g.pinch || !g.dist) {
        gesture.current = { ...g, dist: d, scale: zoom.scale, pinch: true };
        return;
      }
      setZoom(clampZoom({ scale: Math.max(1, Math.min(8, (g.scale * d) / g.dist)), tx: zoom.tx, ty: zoom.ty }));
    } else if (!g.pinch) {
      setZoom(clampZoom({ scale: zoom.scale, tx: g.tx + e.nativeEvent.pageX - g.x, ty: g.ty + e.nativeEvent.pageY - g.y }));
    }
  };
  const release = () => {
    gesture.current = null;
    start.current = null;
    if (zoom.scale < 1.05) setZoom({ scale: 1, tx: 0, ty: 0 });
  };

  return (
    <View
      style={[styles.box, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponderCapture={startCapture}
      onMoveShouldSetResponderCapture={moveCapture}
      onResponderGrant={grant}
      onResponderMove={move}
      onResponderRelease={release}
      onResponderTerminate={release}
      onResponderTerminationRequest={() => false}
    >
      {width > 0 && (
        <View style={[StyleSheet.absoluteFill, { transform: [{ translateX: zoom.tx }, { translateY: zoom.ty }, { scale: zoom.scale }] }]}>
          <Image
            source={{ uri: photo.uri }}
            style={{ position: 'absolute', left: -crop.x * s, top: -crop.y * s, width: photo.width * s, height: photo.height * s }}
            resizeMode="cover"
          />
          {mouth && mouth.length >= 3 && (
            <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Path
                d={mouthPath(
                  mouth.map((p) => ({ x: ((p.x * photo.width - crop.x) * s) / width, y: ((p.y * photo.height - crop.y) * s) / height })),
                  width,
                  height,
                )}
                fill="none"
                stroke={GLOW}
                strokeOpacity={0.8}
                strokeWidth={1.4 / z}
                strokeDasharray={`${5 / z} ${4 / z}`}
              />
            </Svg>
          )}
          {view.length > 0 && (
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
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
                      strokeWidth={(selected === t.fdi ? 2.2 : 1.4) / z}
                    />
                  );
                })}

              {/* números (mapeamento) e área de toque de cada dente */}
              {view.map((t) => {
                const cx = t.x + t.w / 2;
                const y = t.y - 5 / z;
                const sel = selected === t.fdi;
                return (
                  <G key={`lbl-${t.fdi}`}>
                    {shapeMix === null && <Ellipse cx={cx} cy={t.y + t.h * 0.55} rx={2.2 / z} ry={2.2 / z} fill="#FFFFFF" opacity={0.85} />}
                    <SvgText x={cx} y={y} fontSize={10 / z} fontWeight="700" textAnchor="middle" stroke="rgba(0,0,0,0.55)" strokeWidth={3 / z} fill="none">
                      {t.fdi}
                    </SvgText>
                    <SvgText x={cx} y={y} fontSize={10 / z} fontWeight="700" textAnchor="middle" fill={sel ? GLOW : '#FFFFFF'}>
                      {t.fdi}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>
          )}
          {view.length > 0 && <ArchBody view={view} z={z} scale={s * z} onDrag={onArchDrag} onTap={onSelect} />}
          {onArchDrag && view.length > 0 && archHandles(view, s * z, z, onArchDrag)}
        </View>
      )}
      {width > 0 && (
        <>
          {zoom.scale > 1 && (
            <Pressable onPress={() => setZoom({ scale: 1, tx: 0, ty: 0 })} style={styles.zoomBadge} hitSlop={8}>
              <Text style={styles.zoomText}>{`${zoom.scale.toFixed(1)}x · tocar para 1x`}</Text>
            </Pressable>
          )}
          {hint ? (
            <View style={styles.hint} pointerEvents="none">
              <Text style={styles.hintText}>{hint}</Text>
            </View>
          ) : null}
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

/**
 * Alças do arco (estilo SmileCloud): círculo no meio, em cima, move o arco; colchetes ciano nas pontas abrem/fecham
 * o arco (para os lados) e mudam a curva do sorriso (para cima/baixo); barras brancas nas laterais mudam a largura.
 * `scale` converte px de tela em px da foto.
 */
function archHandles(view: MappedTooth[], scale: number, z: number, onDrag: NonNullable<Props['onArchDrag']>): ReactNode {
  const x0 = Math.min(...view.map((t) => t.x));
  const x1 = Math.max(...view.map((t) => t.x + t.w));
  const top = Math.min(...view.map((t) => t.y));
  const bottom = Math.max(...view.map((t) => t.y + t.h));
  const mid = view.find((t) => t.fdi === '11' || t.fdi === '21');
  const midX = mid ? (mid.fdi === '11' ? mid.x + mid.w : mid.x) : (x0 + x1) / 2;
  const items: { key: ArchHandle; x: number; y: number; body: ReactNode; label: string }[] = [
    { key: 'move', x: midX, y: top - 20 / z, body: <MoveIcon />, label: 'Mover o arco' },
    { key: 'distalL', x: x0 - 4 / z, y: top - 4 / z, body: <Bracket side="L" />, label: 'Abrir ou fechar o arco e mudar a curva do sorriso' },
    { key: 'distalR', x: x1 + 4 / z, y: top - 4 / z, body: <Bracket side="R" />, label: 'Abrir ou fechar o arco e mudar a curva do sorriso' },
    { key: 'widthL', x: x0 - 14 / z, y: bottom, body: <View style={styles.widthBar} />, label: 'Largura do arco' },
    { key: 'widthR', x: x1 + 14 / z, y: bottom, body: <View style={styles.widthBar} />, label: 'Largura do arco' },
  ];
  return items.map((h) => (
    <Handle key={h.key} handle={h.key} x={h.x} y={h.y} scale={scale} z={z} onDrag={onDrag} label={h.label}>
      {h.body}
    </Handle>
  ));
}

function Handle({
  handle,
  x,
  y,
  scale,
  z,
  onDrag,
  label,
  children,
}: {
  handle: ArchHandle;
  x: number;
  y: number;
  scale: number;
  /** zoom atual: a alça é desenhada 1/z para ficar do mesmo tamanho na tela */
  z: number;
  onDrag: NonNullable<Props['onArchDrag']>;
  label: string;
  children: ReactNode;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const delta = (e: GestureResponderEvent) => {
    const st = start.current ?? { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    return [(e.nativeEvent.pageX - st.x) / scale, (e.nativeEvent.pageY - st.y) / scale] as const;
  };
  return (
    <View
      style={[styles.handle, { left: x - HANDLE_HIT / 2, top: y - HANDLE_HIT / 2, transform: [{ scale: 1 / z }] }]}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        onDrag(handle, 0, 0, 'start');
      }}
      onResponderMove={(e) => onDrag(handle, ...delta(e), 'move')}
      onResponderRelease={(e) => {
        onDrag(handle, ...delta(e), 'end');
        start.current = null;
      }}
      onResponderTerminate={(e) => {
        onDrag(handle, ...delta(e), 'end');
        start.current = null;
      }}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
    >
      {children}
    </View>
  );
}

const HANDLE_HIT = 40;

/**
 * Área dos dentes (pedido do Gustavo, 2026-10-22): arrastar com um dedo em cima das silhuetas move o conjunto
 * inteiro; um toque rápido seleciona o dente tocado. Dois dedos ficam com a pinça (zoom) da foto.
 */
function ArchBody({
  view,
  z,
  scale,
  onDrag,
  onTap,
}: {
  view: MappedTooth[];
  z: number;
  scale: number;
  onDrag?: Props['onArchDrag'];
  onTap: (fdi: Fdi) => void;
}) {
  const start = useRef<{ x: number; y: number; lx: number; moving: boolean } | null>(null);
  const pad = 14 / z;
  const x0 = Math.min(...view.map((t) => t.x)) - pad;
  const x1 = Math.max(...view.map((t) => t.x + t.w)) + pad;
  const y0 = Math.min(...view.map((t) => t.y)) - pad;
  const y1 = Math.max(...view.map((t) => t.y + t.h)) + pad;
  const delta = (e: GestureResponderEvent) => {
    const st = start.current!;
    return [(e.nativeEvent.pageX - st.x) / scale, (e.nativeEvent.pageY - st.y) / scale] as const;
  };
  const finish = (e: GestureResponderEvent, cancelled: boolean) => {
    const st = start.current;
    start.current = null;
    if (!st) return;
    if (st.moving) onDrag?.('move', ...delta(e), 'end');
    else if (!cancelled) {
      // toque: o dente debaixo do dedo (ou o mais próximo na horizontal)
      const x = x0 + st.lx;
      const hit = view.reduce((b, t) => (Math.abs(t.x + t.w / 2 - x) < Math.abs(b.x + b.w / 2 - x) ? t : b), view[0]);
      onTap(hit.fdi);
    }
  };
  return (
    <View
      style={{ position: 'absolute', left: x0, top: y0, width: x1 - x0, height: y1 - y0 }}
      onStartShouldSetResponder={(e) => (e.nativeEvent.touches?.length ?? 1) < 2}
      onMoveShouldSetResponder={() => false}
      onResponderTerminationRequest={(e) => (e.nativeEvent.touches?.length ?? 0) >= 2}
      onResponderGrant={(e) => {
        start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, lx: e.nativeEvent.locationX, moving: false };
      }}
      onResponderMove={(e) => {
        const st = start.current;
        if (!st || !onDrag) return;
        const [dx, dy] = delta(e);
        if (!st.moving) {
          if (Math.hypot(dx * scale, dy * scale) < 6) return;
          st.moving = true;
          onDrag('move', 0, 0, 'start');
        }
        onDrag('move', dx, dy, 'move');
      }}
      onResponderRelease={(e) => finish(e, false)}
      onResponderTerminate={(e) => finish(e, true)}
      accessibilityLabel="Dentes: arraste para mover o conjunto, toque para escolher um dente"
    />
  );
}

function MoveIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Rect x={1} y={1} width={22} height={22} rx={11} fill="rgba(31,34,43,0.7)" stroke="#FFFFFF" strokeWidth={1.4} />
      <Path d="M12 5 L14.5 8 H9.5 Z M12 19 L9.5 16 H14.5 Z M5 12 L8 9.5 V14.5 Z M19 12 L16 14.5 V9.5 Z" fill="#FFFFFF" />
    </Svg>
  );
}

function Bracket({ side }: { side: 'L' | 'R' }) {
  const d = side === 'L' ? 'M5 17 V5 H17' : 'M5 5 H17 V17';
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      <Path d={d} stroke="rgba(0,0,0,0.45)" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d} stroke={CYAN} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
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
  handle: { position: 'absolute', width: HANDLE_HIT, height: HANDLE_HIT, alignItems: 'center', justifyContent: 'center' },
  widthBar: { width: 6, height: 24, borderRadius: 3, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)' },
  hint: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(31,34,43,0.8)' },
  hintText: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 12 },
  zoomBadge: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(31,34,43,0.75)' },
  zoomText: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 11 },
  badgeText: { color: '#FFFFFF', fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', flexShrink: 1 },
});
