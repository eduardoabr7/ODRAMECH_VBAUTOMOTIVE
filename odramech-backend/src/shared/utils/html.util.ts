export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const BLOCKED_TAGS = ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'link', 'meta', 'base', 'form', 'input', 'button', 'textarea', 'select', 'noscript', 'template'];

/**
 * Limpa HTML escrito pelo usuário (editor de documento do orçamento).
 * Remove tags executáveis/embutidas, atributos de evento (onclick…) e URLs javascript:/vbscript:.
 * O frontend ainda renderiza o documento num iframe sandbox sem scripts (defesa em profundidade).
 */
export function sanitizeHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  let s = String(html);
  for (const tag of BLOCKED_TAGS) {
    s = s.replace(new RegExp(String.raw`<${tag}\b[^>]*>[\s\S]*?<\/${tag}\s*>`, 'gi'), '');
    s = s.replace(new RegExp(String.raw`<\/?${tag}\b[^>]*>`, 'gi'), '');
  }
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/(href|src|xlink:href|action|formaction)\s*=\s*(["']?)\s*(javascript|vbscript|data(?!:image\/))\s*:[^"'\s>]*\2/gi, '$1="#"');
  s = s.replace(/expression\s*\(/gi, '');
  return s.trim() || null;
}
