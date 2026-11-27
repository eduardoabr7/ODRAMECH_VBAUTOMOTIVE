export type MediaKind = 'camera' | 'gallery';

const KEY = (kind: MediaKind) => `odramech.media-consent.${kind}`;

/**
 * Lembra que a pessoa já autorizou o site a usar a câmera/galeria neste aparelho,
 * para não perguntar toda vez. (A galeria não tem permissão própria no navegador:
 * a pergunta é nossa. A da câmera vem depois, do próprio navegador.)
 */
export const MediaConsentStore = {
  has(kind: MediaKind): boolean {
    try { return localStorage.getItem(KEY(kind)) === 'granted'; } catch { return false; }
  },
  grant(kind: MediaKind): void {
    try { localStorage.setItem(KEY(kind), 'granted'); } catch { /* modo privado: pergunta de novo da próxima vez */ }
  },
  revoke(kind: MediaKind): void {
    try { localStorage.removeItem(KEY(kind)); } catch { /* idem */ }
  },
};
