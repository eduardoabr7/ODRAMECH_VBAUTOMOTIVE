/**
 * Imprime um documento HTML num iframe invisível e resolve quando a janela de impressão fecha.
 *
 * O iframe é `sandbox` sem `allow-scripts`: HTML personalizado pelo usuário nunca executa
 * JavaScript (defesa extra além da limpeza feita no backend).
 *
 * Observação: nenhum navegador informa se a pessoa clicou em "Imprimir"/"Salvar PDF" ou em
 * "Cancelar" — só que a janela de impressão foi fechada. Por isso o retorno é "a impressão
 * foi aberta e concluída (fechada)".
 */
export function printHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setTimeout(() => frame.remove(), 500);
      resolve();
    };

    frame.onload = async () => {
      const win = frame.contentWindow;
      if (!win) { frame.remove(); reject(new Error('Não foi possível preparar a impressão.')); return; }
      try {
        await waitImages(frame.contentDocument);
        win.addEventListener('afterprint', finish, { once: true });
        win.focus();
        win.print(); // bloqueia até a janela fechar na maioria dos navegadores
        // Safari/Firefox às vezes não disparam afterprint em iframes
        setTimeout(finish, 1000);
      } catch (err) {
        frame.remove();
        reject(err);
      }
    };

    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

function waitImages(doc: Document | null): Promise<unknown> {
  if (!doc) return Promise.resolve();
  const pending = Array.from(doc.images).filter(img => !img.complete);
  return Promise.race([
    Promise.all(pending.map(img => new Promise(r => { img.onload = img.onerror = r; }))),
    new Promise(r => setTimeout(r, 2500)),
  ]);
}
