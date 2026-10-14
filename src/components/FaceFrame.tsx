import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { Handle } from '@/components/Handle';
import { FACE_POINT_LABELS, frameCurves, lineXAtY, smoothPath, type Box, type FacePoints, type Pt } from '@/lib/smile/frame';

type Props = {
  face: FacePoints;
  width: number;
  height: number;
  /** Caixas dos dentes da simulação (px) para as curvas do smile frame. */
  teeth: Box[];
  /** Linha média dental da simulação (px). */
  dentalMidlineX: number;
  onChange?: (face: FacePoints) => void;
  /** Esconde as alças (ex.: na exportação). */
  readOnly?: boolean;
};

const COLORS = {
  horizontal: '#4FC3F7', // bipupilar e intercomissural
  midline: '#FFD54F', // linha média facial
  dental: '#FF8A65', // linha média dental
  smile: '#81C784', // curva do sorriso
  gingival: '#F06292', // curva gengival
  papilla: '#F8BBD0', // papilas
  calib: '#FFFFFF',
};

const GLYPH: Record<keyof FacePoints, string> = {
  pupilR: '◉',
  pupilL: '◉',
  glabella: 'G',
  philtrum: 'F',
  commissureR: 'C',
  commissureL: 'C',
  centralsDistalR: '11',
  centralsDistalL: '21',
};

/**
 * Face-bow digital (estilo DSD): linhas bipupilar, intercomissural e média facial
 * sobre a foto, calibração pelos distais dos centrais e curvas do smile frame
 * (sorriso, gengival e papilas) sobre a simulação.
 */
export function FaceFrame({ face, width, height, teeth, dentalMidlineX, onChange, readOnly }: Props) {
  if (width <= 0 || height <= 0) return null;
  const P = (p: Pt) => ({ x: p.x * width, y: p.y * height });
  const pr = P(face.pupilR);
  const pl = P(face.pupilL);
  const cr = P(face.commissureR);
  const cl = P(face.commissureL);
  const dr = P(face.centralsDistalR);
  const dl = P(face.centralsDistalL);
  // linha média facial estendida por toda a altura
  const mTop = { x: lineXAtY(face.glabella, face.philtrum, 0, width, height), y: 0 };
  const mBottom = { x: lineXAtY(face.glabella, face.philtrum, height, width, height), y: height };
  const ext = (a: Pt, b: Pt) => {
    // estende a linha a..b 25% para cada lado
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return { x1: a.x - dx * 0.25, y1: a.y - dy * 0.25, x2: b.x + dx * 0.25, y2: b.y + dy * 0.25 };
  };
  const bip = ext(pr, pl);
  const com = ext(cr, cl);
  const curves = teeth.length ? frameCurves(teeth) : null;

  const move = (key: keyof FacePoints) => (dx: number, dy: number) => {
    if (!onChange) return;
    const p = face[key];
    const nx = Math.min(1, Math.max(0, p.x + dx / width));
    const ny = Math.min(1, Math.max(0, p.y + dy / height));
    onChange({ ...face, [key]: { x: nx, y: ny } });
  };

  return (
    <>
      <Svg width={width} height={height} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
        <Line {...bip} stroke={COLORS.horizontal} strokeWidth={1.5} strokeDasharray="6 4" />
        <Line {...com} stroke={COLORS.horizontal} strokeWidth={1.5} strokeDasharray="6 4" />
        <Line x1={mTop.x} y1={mTop.y} x2={mBottom.x} y2={mBottom.y} stroke={COLORS.midline} strokeWidth={1.5} />
        <Line x1={dentalMidlineX} y1={height * 0.55} x2={dentalMidlineX} y2={height} stroke={COLORS.dental} strokeWidth={1.5} strokeDasharray="3 3" />
        <Line x1={dr.x} y1={dr.y} x2={dl.x} y2={dl.y} stroke={COLORS.calib} strokeWidth={2} />
        {curves && (
          <>
            <Path d={smoothPath(curves.gingival)} stroke={COLORS.gingival} strokeWidth={1.5} fill="none" />
            <Path d={smoothPath(curves.papilla)} stroke={COLORS.papilla} strokeWidth={1} strokeDasharray="4 3" fill="none" />
            <Path d={smoothPath(curves.smile)} stroke={COLORS.smile} strokeWidth={2} fill="none" />
          </>
        )}
        <SvgText x={bip.x2 + 4} y={bip.y2 + 4} fill={COLORS.horizontal} fontSize={10}>
          bipupilar
        </SvgText>
        <SvgText x={com.x2 + 4} y={com.y2 + 4} fill={COLORS.horizontal} fontSize={10}>
          comissuras
        </SvgText>
        <SvgText x={mTop.x + 4} y={12} fill={COLORS.midline} fontSize={10}>
          linha média facial
        </SvgText>
      </Svg>
      {!readOnly &&
        onChange &&
        (Object.keys(face) as (keyof FacePoints)[]).map((key) => {
          const p = P(face[key]);
          const calib = key === 'centralsDistalR' || key === 'centralsDistalL';
          return (
            <Handle
              key={key}
              x={p.x}
              y={p.y}
              glyph={GLYPH[key]}
              size={calib ? 22 : 20}
              color={calib ? '#546E7A' : key === 'glabella' || key === 'philtrum' ? '#F9A825' : '#0288D1'}
              onMove={move(key)}
            />
          );
        })}
    </>
  );
}

export { FACE_POINT_LABELS };
