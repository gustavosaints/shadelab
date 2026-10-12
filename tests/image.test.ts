import { describe, expect, it } from 'vitest';
import { base64ToBytes } from '@/lib/image/base64';
import { averagePixels, clampRect } from '@/lib/image/stats';

describe('base64ToBytes', () => {
  it('decodifica texto conhecido', () => {
    const bytes = base64ToBytes('U2hhZGVMYWI=');
    expect(Array.from(bytes)).toEqual([83, 104, 97, 100, 101, 76, 97, 98]);
  });
  it('aceita prefixo data: e quebras de linha', () => {
    const bytes = base64ToBytes('data:image/jpeg;base64,U2hh\nZGU=');
    expect(Array.from(bytes)).toEqual([83, 104, 97, 100, 101]);
  });
});

describe('averagePixels', () => {
  it('ignora reflexo especular e sombra', () => {
    const n = 100;
    const rgba = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
      let v: [number, number, number] = [200, 180, 150];
      if (i < 10) v = [255, 255, 255]; // reflexo
      if (i >= 90) v = [20, 15, 10]; // sombra
      rgba.set([...v, 255], i * 4);
    }
    const s = averagePixels(rgba, n);
    expect(s.rgb).toEqual({ r: 200, g: 180, b: 150 });
    expect(s.spread).toBeCloseTo(0, 5);
  });
});

describe('clampRect', () => {
  it('mantém o retângulo dentro da imagem', () => {
    expect(clampRect({ x: -10, y: 990, width: 50, height: 50 }, 1000, 1000)).toEqual({
      x: 0,
      y: 950,
      width: 50,
      height: 50,
    });
  });
});
