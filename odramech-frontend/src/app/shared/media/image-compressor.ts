/**
 * Reduz fotos grandes (celular tira 12 MP+) antes do upload: menos dados no 4G e
 * nada de estourar o limite de 10 MB do backend. GIF e SVG passam direto (perderiam animação/vetor).
 */
export interface CompressOptions {
  /** maior lado, em px */
  maxSide: number;
  /** qualidade JPEG/WebP (0–1) */
  quality: number;
  /** abaixo disso não mexe */
  skipBelowBytes: number;
}

const DEFAULTS: CompressOptions = { maxSide: 2560, quality: 0.85, skipBelowBytes: 1.5 * 1024 * 1024 };
const COMPRESSIBLE = /^image\/(jpe?g|png|webp)$/;

export async function compressImage(file: File, options: Partial<CompressOptions> = {}): Promise<File> {
  const opt = { ...DEFAULTS, ...options };
  if (!COMPRESSIBLE.test(file.type) || file.size < opt.skipBelowBytes) return file;

  try {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, opt.maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if ('close' in bitmap) (bitmap as ImageBitmap).close();

    const blob = await canvasToBlob(canvas, 'image/jpeg', opt.quality);
    // se não ganhou nada (PNG pequeno com transparência etc.), mantém o original
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // imageOrientation respeita a rotação EXIF da câmera do celular
  if ('createImageBitmap' in window) return createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
