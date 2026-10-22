import { describe, expect, it } from 'vitest';
import { dampen, isHorizontalSwipe, swipeAction } from '../src/lib/swipe';

describe('arrastar caso', () => {
  it('direita além de 30 % envia, esquerda exclui, pouco volta', () => {
    expect(swipeAction(130, 400)).toBe('send');
    expect(swipeAction(-130, 400)).toBe('delete');
    expect(swipeAction(80, 400)).toBeNull();
    expect(swipeAction(-80, 400)).toBeNull();
    expect(swipeAction(200, 0)).toBeNull();
  });
  it('só conta gesto claramente horizontal', () => {
    expect(isHorizontalSwipe(30, 5)).toBe(true);
    expect(isHorizontalSwipe(30, 28)).toBe(false); // diagonal: é rolagem
    expect(isHorizontalSwipe(8, 0)).toBe(false); // toque
  });
  it('resistência depois de 60 % da largura', () => {
    expect(dampen(100, 400)).toBe(100);
    expect(dampen(340, 400)).toBe(265);
    expect(dampen(-340, 400)).toBe(-265);
  });
});
