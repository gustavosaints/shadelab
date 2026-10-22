import { describe, expect, it } from 'vitest';
import { faceGuide } from '@/lib/face/landmarks';
import { coverScale, cropFromView, estimateAreaH, smileFrameAspect, smilePhotoHeight } from '@/lib/smile/frameAspect';

describe('moldura da foto do Smile Design', () => {
  it('o quadro ocupa metade da área e a proporção vem dele', () => {
    const areaH = estimateAreaH(844, 47); // iPhone ~ 390×844
    expect(smilePhotoHeight(areaH)).toBeCloseTo(areaH / 2 - 16);
    expect(smileFrameAspect(390, areaH)).toBeCloseTo(358 / (areaH / 2 - 16));
  });

  it('a câmera desenha a moldura na proporção pedida', () => {
    const g = faceGuide(390, 844, 1.0);
    expect(g.frame.w / g.frame.h).toBeCloseTo(1.0);
    expect(g.frame.w).toBeCloseTo(390);
    expect(faceGuide(390, 844).frame.w / faceGuide(390, 844).frame.h).toBeCloseTo(0.75);
  });

  it('corte da galeria: cobre a moldura e devolve o recorte certo', () => {
    const s = coverScale(3000, 4000, 300, 300);
    expect(s).toBeCloseTo(0.1); // largura manda
    const center = cropFromView(3000, 4000, 300, 300, s, 0, 0);
    expect(center).toEqual({ x: 0, y: 500, w: 3000, h: 3000 });
    const up = cropFromView(3000, 4000, 300, 300, s, 0, 50); // arrastou a foto para baixo: mostra mais de cima
    expect(up.y).toBe(0);
    const zoom = cropFromView(3000, 4000, 300, 300, s * 2, 0, 0);
    expect(zoom).toEqual({ x: 750, y: 1250, w: 1500, h: 1500 });
  });
});
