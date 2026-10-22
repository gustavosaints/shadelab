/** Arrastar uma linha da lista de casos: para a direita envia, para a esquerda exclui (passando de 30 % da largura). */
export type SwipeAction = 'send' | 'delete' | null;

export const SWIPE_THRESHOLD = 0.3;

export function swipeAction(dx: number, width: number): SwipeAction {
  if (width <= 0) return null;
  if (dx >= width * SWIPE_THRESHOLD) return 'send';
  if (dx <= -width * SWIPE_THRESHOLD) return 'delete';
  return null;
}

/** O gesto só vira arrasto de linha quando é claramente horizontal (senão é a rolagem da lista). */
export function isHorizontalSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4;
}

/** Depois de 60 % da largura o arrasto fica "pesado" (resistência), para não sumir da tela. */
export function dampen(dx: number, width: number): number {
  const limit = width * 0.6;
  if (Math.abs(dx) <= limit) return dx;
  const extra = Math.abs(dx) - limit;
  return Math.sign(dx) * (limit + extra * 0.25);
}
