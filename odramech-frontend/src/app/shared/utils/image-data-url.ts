/**
 * Lê uma imagem escolhida pelo usuário, reduz para no máximo `max` px no maior lado e devolve
 * como data URL (o backend guarda assim). SVG passa direto (quando permitido).
 *
 * keepTransparency: true → PNG (logos com fundo transparente); false → JPEG com fundo branco (fotos).
 */
export async function imageToDataUrl(
  file: File,
  opts: { max: number; keepTransparency: boolean; maxBytes: number; allowSvg?: boolean },
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    r.readAsDataURL(file);
  });
  if (file.type === 'image/svg+xml') {
    if (!opts.allowSvg) throw new Error('Use uma imagem PNG, JPG ou WebP.');
    if (file.size > opts.maxBytes) throw new Error('Imagem muito grande.');
    return raw;
  }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Formato de imagem não suportado.'));
    i.src = raw;
  });
  const scale = Math.min(1, opts.max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d')!;
  if (!opts.keepTransparency) {
    // JPEG não tem transparência: sem isso o fundo transparente vira preto
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let out = opts.keepTransparency ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
  if (out.length * 0.75 > opts.maxBytes) out = canvas.toDataURL('image/webp', 0.8);
  if (out.length * 0.75 > opts.maxBytes) throw new Error('Imagem muito grande mesmo depois de reduzida. Tente outra.');
  return out;
}
