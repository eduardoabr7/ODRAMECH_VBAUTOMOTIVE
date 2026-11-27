import { canvasToBlob } from './image-compressor';

export type CameraFacing = 'environment' | 'user';

/** Mensagem amigável para os erros do getUserMedia. */
export function cameraErrorMessage(error: unknown): string {
  const name = (error as DOMException)?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'O acesso à câmera foi negado. Libere a câmera para este site nas configurações do navegador e tente de novo.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Nenhuma câmera encontrada neste aparelho.';
    case 'NotReadableError':
      return 'A câmera está sendo usada por outro aplicativo.';
    default:
      return 'Não foi possível abrir a câmera.';
  }
}

/**
 * ADAPTER sobre MediaDevices: abre/fecha a câmera e tira a foto como File.
 * É o getUserMedia que dispara o pedido de permissão do navegador.
 */
export class CameraSession {
  private stream: MediaStream | null = null;

  /** getUserMedia só existe em contexto seguro (https ou localhost) */
  static supported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
  }

  /** o navegador já negou a câmera antes? (Permissions API; nem todo navegador tem) */
  static async isBlocked(): Promise<boolean> {
    try {
      const status = await navigator.permissions?.query({ name: 'camera' as PermissionName });
      return status?.state === 'denied';
    } catch {
      return false;
    }
  }

  get active(): boolean { return !!this.stream; }

  async start(facing: CameraFacing): Promise<MediaStream> {
    this.stop();
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    return this.stream;
  }

  async capture(video: HTMLVideoElement, quality = 0.9): Promise<File> {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (!blob) throw new Error('Falha ao capturar a foto.');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    return new File([blob], `foto-${stamp}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  }

  stop(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }
}
