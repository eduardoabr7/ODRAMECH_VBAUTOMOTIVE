import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { existsSync } from 'node:fs';
import type { Browser } from 'puppeteer-core';
import { AppConfig } from 'src/core/config/app-config';

/** Onde procurar um Chrome/Edge/Chromium já instalado quando CHROME_PATH não é informado. */
const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

/**
 * HTML → PDF com um navegador sem janela (puppeteer-core).
 * Usa o mesmo HTML da impressão, então o PDF do e-mail é idêntico ao que sai na impressora.
 * O navegador é aberto na primeira geração e reaproveitado.
 */
@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: Promise<Browser> | null = null;

  constructor(private readonly config: AppConfig) {}

  private executable(): string {
    const configured = this.config.values.chromePath;
    const path = configured ?? CANDIDATES.find(p => existsSync(p));
    if (!path || !existsSync(path)) {
      throw new ServiceUnavailableException('Não há Chrome/Edge para gerar o PDF. Instale um ou informe CHROME_PATH no .env do backend.');
    }
    return path;
  }

  private async open(): Promise<Browser> {
    if (!this.browser) {
      const { launch } = await import('puppeteer-core');
      this.browser = launch({
        executablePath: this.executable(),
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      }).then(b => {
        b.on('disconnected', () => { this.browser = null; });
        return b;
      });
      this.browser.catch(() => { this.browser = null; });
    }
    return this.browser;
  }

  async fromHtml(html: string): Promise<Buffer> {
    const browser = await this.open();
    const page = await browser.newPage();
    try {
      // o documento não precisa de JavaScript (e o HTML personalizado nunca deve executar nada)
      await page.setJavaScriptEnabled(false);
      await page.setContent(html, { waitUntil: 'load', timeout: 20_000 });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async onModuleDestroy() {
    const b = await this.browser?.catch(() => null);
    await b?.close().catch(() => undefined);
    if (b) this.logger.log('Navegador do PDF encerrado.');
  }
}
