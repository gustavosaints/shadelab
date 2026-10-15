/** Troca simples entre a tela de câmera guiada e o Smile Design (sem passar a foto pela URL). */
export type PendingPhoto = { uri: string; width: number; height: number; mirrored: boolean };

let pending: PendingPhoto | null = null;

export function setPendingPhoto(p: PendingPhoto | null) {
  pending = p;
}

/** Devolve e limpa a foto pendente. */
export function takePendingPhoto(): PendingPhoto | null {
  const p = pending;
  pending = null;
  return p;
}
