// Imprime o HTML num iframe escondido (sandbox, sem scripts) e resolve quando a janela fecha.
// Não tem como saber se a pessoa imprimiu ou cancelou.
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
