import { sanitizeHtml } from './html.util';

describe('sanitizeHtml', () => {
  it('remove scripts, eventos e URLs javascript:, mantendo o resto', () => {
    const out = sanitizeHtml('<h1 onclick="alert(1)">Oi {{estabelecimento.nome}}</h1><script>alert(2)</script><iframe src="x"></iframe><a href="javascript:alert(3)">x</a><img src="data:image/png;base64,AAA">');
    expect(out).toBe('<h1>Oi {{estabelecimento.nome}}</h1><a href="#">x</a><img src="data:image/png;base64,AAA">');
  });

  it('vazio vira null', () => {
    expect(sanitizeHtml('   ')).toBeNull();
    expect(sanitizeHtml(null)).toBeNull();
  });
});
