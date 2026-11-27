import {
  ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, ViewChild,
} from '@angular/core';
import { CameraFacing, CameraSession, cameraErrorMessage } from './camera-session';
import { compressImage } from './image-compressor';
import { BodyPortalDirective } from '../directives/body-portal.directive';
import { MediaConsentStore, MediaKind } from './media-consent.store';

/**
 * Botões "Câmera", "Galeria" e "Arquivo" do composer, com:
 *  - pergunta de permissão na primeira vez (lembrada no aparelho);
 *  - câmera ao vivo (getUserMedia → pedido de permissão do navegador), com troca frontal/traseira;
 *  - sem contexto seguro (http na rede local), cai para a câmera nativa via <input capture>;
 *  - fotos grandes reduzidas antes de sair daqui.
 *
 * Os <input type=file> são clicados DENTRO do clique do usuário (inclusive no "Permitir"),
 * senão o navegador do celular bloqueia a abertura da galeria.
 */
@Component({
  selector: 'app-media-picker',
  standalone: true,
  imports: [BodyPortalDirective],
  template: `
    <div class="mp-buttons">
      <button type="button" class="btn-x btn-ghost sm" (click)="request('camera')" [disabled]="disabled" title="Tirar foto">
        <i class="fa-solid fa-camera"></i><span class="lbl">Câmera</span>
      </button>
      <button type="button" class="btn-x btn-ghost sm" (click)="request('gallery')" [disabled]="disabled" title="Escolher fotos da galeria">
        <i class="fa-regular fa-images"></i><span class="lbl">Galeria</span>
      </button>
      @if (allowDocuments) {
        <button type="button" class="btn-x btn-ghost sm" (click)="fileInput.click()" [disabled]="disabled" title="Anexar PDF ou vídeo">
          <i class="fa-solid fa-paperclip"></i><span class="lbl">Arquivo</span>
        </button>
      }
    </div>

    <input #galleryInput type="file" accept="image/*" multiple hidden (change)="onInput($event)">
    <input #nativeCamera type="file" accept="image/*" capture="environment" hidden (change)="onInput($event)">
    <input #fileInput type="file" multiple hidden [accept]="documentAccept" (change)="onInput($event)">

    @if (consent) {
      <div class="mp-overlay" appBodyPortal (click)="deny()">
        <div class="mp-dialog" role="dialog" aria-modal="true" [attr.aria-labelledby]="'mp-title'" (click)="$event.stopPropagation()">
          <span class="mp-icon"><i class="fa-solid" [class.fa-camera]="consent === 'camera'" [class.fa-images]="consent === 'gallery'"></i></span>
          <h4 id="mp-title">{{ consent === 'camera' ? 'Permitir acesso à câmera?' : 'Permitir acesso à galeria?' }}</h4>
          <p>
            @if (consent === 'camera') {
              O Odramech vai usar a câmera só para tirar as fotos que você anexar na OS. Em seguida o navegador também vai pedir a permissão.
            } @else {
              O Odramech vai abrir suas fotos para você escolher quais anexar na OS. Só as fotos escolhidas são enviadas.
            }
          </p>
          <div class="mp-actions">
            <button type="button" class="btn-x btn-outline sm" (click)="deny()">Agora não</button>
            <button type="button" class="btn-x btn-solid sm" (click)="allow()">Permitir</button>
          </div>
        </div>
      </div>
    }

    @if (cameraOpen) {
      <div class="mp-camera" appBodyPortal role="dialog" aria-modal="true" aria-label="Câmera">
        <video #video autoplay playsinline muted [class.mirror]="facing === 'user'"></video>
        @if (cameraError) {
          <div class="mp-cam-error">
            <i class="fa-solid fa-video-slash"></i>
            <p>{{ cameraError }}</p>
            <button type="button" class="btn-x btn-outline sm" (click)="nativeCamera.click()">Usar a câmera do aparelho</button>
          </div>
        }
        <div class="mp-cam-bar">
          <button type="button" class="mp-round ghost" (click)="closeCamera()" aria-label="Fechar câmera"><i class="fa-solid fa-xmark"></i></button>
          <button type="button" class="mp-shutter" (click)="snap()" [disabled]="!!cameraError || snapping" aria-label="Tirar foto"><span></span></button>
          <button type="button" class="mp-round ghost" (click)="flip()" [disabled]="!!cameraError" aria-label="Trocar câmera"><i class="fa-solid fa-camera-rotate"></i></button>
        </div>
        @if (shots) {
          <div class="mp-shots">{{ shots }} {{ shots === 1 ? 'foto adicionada' : 'fotos adicionadas' }} · <button type="button" (click)="closeCamera()">Concluir</button></div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }
    .mp-buttons { display: inline-flex; gap: 2px; flex-wrap: wrap; }
    @media (max-width: 420px) { .lbl { display: none; } }

    .mp-overlay { position: fixed; inset: 0; z-index: 1080; background: rgba(17,17,17,.45); display: grid; place-items: center; padding: 16px; animation: mp-fade .15s ease-out; }
    .mp-dialog { width: min(380px, 100%); background: var(--surface); border-radius: var(--r-lg); padding: 22px; box-shadow: 0 20px 60px rgba(0,0,0,.25); text-align: center;
      h4 { font-size: 16px; margin: 12px 0 6px; } p { font-size: 13px; color: var(--muted); line-height: 1.5; margin: 0; } }
    .mp-icon { width: 44px; height: 44px; border-radius: 12px; display: inline-grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-size: 18px; }
    .mp-actions { display: flex; gap: 8px; justify-content: center; margin-top: 18px; }

    .mp-camera { position: fixed; inset: 0; z-index: 1080; background: #000; display: flex; flex-direction: column; }
    video { flex: 1; width: 100%; min-height: 0; object-fit: contain; background: #000; &.mirror { transform: scaleX(-1); } }
    .mp-cam-bar { display: flex; align-items: center; justify-content: space-around; padding: 18px 16px calc(18px + env(safe-area-inset-bottom)); background: rgba(0,0,0,.6); }
    .mp-round { width: 46px; height: 46px; border-radius: 50%; border: 0; background: rgba(255,255,255,.14); color: #fff; font-size: 18px; cursor: pointer; &:disabled { opacity: .4; } }
    .mp-shutter { width: 70px; height: 70px; border-radius: 50%; border: 4px solid #fff; background: transparent; padding: 4px; cursor: pointer;
      span { display: block; width: 100%; height: 100%; border-radius: 50%; background: #fff; transition: transform .1s; }
      &:active span { transform: scale(.88); } &:disabled { opacity: .4; } }
    .mp-shots { position: absolute; top: calc(14px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); background: rgba(0,0,0,.7); color: #fff; font-size: 13px; padding: 6px 12px; border-radius: 999px;
      button { background: none; border: 0; color: #fff; font-weight: 600; text-decoration: underline; padding: 0; } }
    .mp-cam-error { position: absolute; inset: 0 0 110px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; color: #fff; text-align: center;
      i { font-size: 28px; opacity: .7; } p { max-width: 340px; font-size: 14px; line-height: 1.5; margin: 0; } .btn-x { color: #fff; background: transparent; border-color: rgba(255,255,255,.5); &:hover { background: rgba(255,255,255,.12); } } }
    @keyframes mp-fade { from { opacity: 0; } }
  `],
})
export class MediaPickerComponent implements OnDestroy {
  @Input() disabled = false;
  /** mostra o botão "Arquivo" (PDF/vídeo) */
  @Input() allowDocuments = true;
  @Input() documentAccept = 'image/*,application/pdf,video/mp4,video/quicktime,video/webm';
  /** arquivos já prontos para enviar (fotos reduzidas) */
  @Output() picked = new EventEmitter<File[]>();

  @ViewChild('galleryInput') private galleryInput!: ElementRef<HTMLInputElement>;
  @ViewChild('nativeCamera') private nativeCamera!: ElementRef<HTMLInputElement>;
  @ViewChild('video') private set videoRef(ref: ElementRef<HTMLVideoElement> | undefined) {
    this.video = ref?.nativeElement ?? null;
    if (this.video && this.stream) this.video.srcObject = this.stream;
  }

  consent: MediaKind | null = null;
  cameraOpen = false;
  cameraError: string | null = null;
  facing: CameraFacing = 'environment';
  snapping = false;
  shots = 0;

  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private readonly camera = new CameraSession();

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnDestroy(): void { this.camera.stop(); }

  request(kind: MediaKind): void {
    if (MediaConsentStore.has(kind)) this.open(kind);
    else this.consent = kind;
  }

  allow(): void {
    const kind = this.consent!;
    MediaConsentStore.grant(kind);
    this.consent = null;
    this.open(kind);
  }

  deny(): void { this.consent = null; }

  private open(kind: MediaKind): void {
    if (kind === 'gallery') this.galleryInput.nativeElement.click();
    else this.startCamera();
  }

  private startCamera(): void {
    // http fora do localhost não tem getUserMedia: usa a câmera nativa (ainda dentro do clique)
    if (!CameraSession.supported()) { this.nativeCamera.nativeElement.click(); return; }
    this.cameraOpen = true;
    this.shots = 0;
    void this.connect();
  }

  private async connect(): Promise<void> {
    this.cameraError = null;
    try {
      this.stream = await this.camera.start(this.facing);
      if (this.video) this.video.srcObject = this.stream;
    } catch (e) {
      this.stream = null;
      this.cameraError = cameraErrorMessage(e);
      // negou a câmera: na próxima vez pergunta de novo antes de tentar
      if ((e as DOMException)?.name === 'NotAllowedError') MediaConsentStore.revoke('camera');
    }
    this.cdr.markForCheck();
  }

  flip(): void {
    this.facing = this.facing === 'environment' ? 'user' : 'environment';
    void this.connect();
  }

  async snap(): Promise<void> {
    if (!this.video || this.snapping) return;
    this.snapping = true;
    try {
      this.picked.emit([await this.camera.capture(this.video)]);
      this.shots++;
    } finally {
      this.snapping = false;
      this.cdr.markForCheck();
    }
  }

  closeCamera(): void {
    this.camera.stop();
    this.stream = null;
    this.cameraOpen = false;
    this.cameraError = null;
  }

  async onInput(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (this.cameraOpen) this.closeCamera();
    if (!files.length) return;
    this.picked.emit(await Promise.all(files.map(f => compressImage(f))));
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.consent) this.deny();
    else if (this.cameraOpen) this.closeCamera();
  }
}
