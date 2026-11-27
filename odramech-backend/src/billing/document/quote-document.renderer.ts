// HTML do documento de orçamento. É o mesmo usado na impressão, na prévia das configurações
// e no PDF do e-mail. Modelos: ODRAMECH (padrão), PREMIUM e CUSTOM (HTML com variáveis {{...}}).

export type QuoteTemplate = 'ODRAMECH' | 'PREMIUM' | 'CUSTOM';
type ItemKind = 'PECA' | 'SERVICO';
const ITEM_KIND_LABEL: Record<ItemKind, string> = { PECA: 'Peça', SERVICO: 'Serviço' };

/** Orçamento no formato que o documento precisa (o mesmo que a API devolve). */
export interface DocQuote {
  numberQuote: number;
  createdAt: string | Date;
  validUntil: string | Date | null;
  notes: string | null;
  client: { name: string; email?: string | null; principalPhone?: string | null };
  vehicle: { plate: string; name: string; make: string };
  items: { kind: ItemKind; description: string; quantity: number; unitPrice: number; discount: number; total: number }[];
  total: number;
}

export interface DocumentEstablishment {
  name: string;
  enterpriseName: string;
  cnpj: string;
  phone: string;
  email: string | null;
  logoUrl: string | null;
  address: {
    street: string; number: string; complement: string | null; neighborhood: string;
    city: string; district: string; zipCode: string; country: string;
  } | null;
}

export interface QuoteDocument {
  settings: {
    effectiveTemplate: QuoteTemplate;
    quoteHeaderHtml: string | null;
    quoteBodyHtml: string | null;
    quoteFooterHtml: string | null;
  };
  establishment: DocumentEstablishment;
  branding: { displayName: string | null; logoUrl: string | null; accentColor: string | null };
}

export const DEFAULT_ACCENT = '#e4531c';

/** Variáveis aceitas nos modelos personalizados (mostradas no editor). */
export const TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: 'logo', label: 'Logo' },
  { key: 'estabelecimento.nome', label: 'Nome do estabelecimento' },
  { key: 'estabelecimento.cnpj', label: 'CNPJ' },
  { key: 'estabelecimento.telefone', label: 'Telefone' },
  { key: 'estabelecimento.email', label: 'E-mail' },
  { key: 'estabelecimento.endereco', label: 'Endereço' },
  { key: 'empresa.nome', label: 'Nome da empresa' },
  { key: 'orcamento.numero', label: 'Nº do orçamento' },
  { key: 'orcamento.data', label: 'Data do orçamento' },
  { key: 'orcamento.validade', label: 'Válido até' },
  { key: 'orcamento.total', label: 'Total' },
  { key: 'cliente.nome', label: 'Cliente' },
  { key: 'cliente.telefone', label: 'Telefone do cliente' },
  { key: 'cliente.email', label: 'E-mail do cliente' },
  { key: 'veiculo.descricao', label: 'Veículo' },
  { key: 'veiculo.placa', label: 'Placa' },
  { key: 'itens', label: 'Tabela de peças e serviços' },
  { key: 'observacoes', label: 'Observações' },
  { key: 'data.hoje', label: 'Data de hoje' },
];

/** Modelo personalizado inicial (ponto de partida do editor). */
export const CUSTOM_STARTER = {
  header: `<table style="width:100%"><tr>
<td style="width:90px">{{logo}}</td>
<td><h2 style="margin:0">{{estabelecimento.nome}}</h2><p style="margin:2px 0;color:#666">CNPJ {{estabelecimento.cnpj}} · {{estabelecimento.telefone}}<br>{{estabelecimento.endereco}}</p></td>
<td style="text-align:right"><h3 style="margin:0">Orçamento nº {{orcamento.numero}}</h3><p style="margin:2px 0;color:#666">{{orcamento.data}}</p></td>
</tr></table><hr>`,
  body: `<p><b>Cliente:</b> {{cliente.nome}} · {{cliente.telefone}}<br><b>Veículo:</b> {{veiculo.descricao}} · {{veiculo.placa}}</p>
{{itens}}
{{observacoes}}`,
  footer: `<hr><p style="text-align:center;color:#666;font-size:12px">Orçamento válido até {{orcamento.validade}} · {{estabelecimento.nome}}</p>`,
};

const money = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qty = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const date = (v: string | Date | null | undefined) => (v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');

export function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function phone(v?: string | null): string {
  if (!v) return '';
  const d = v.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}

function cnpj(v?: string | null): string {
  const d = (v ?? '').replace(/\D/g, '');
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : (v ?? '');
}

function plate(v?: string | null): string {
  const raw = (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{3}\d{4}$/.test(raw) ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
}

function address(e: DocumentEstablishment): string {
  const a = e.address;
  if (!a) return '';
  const line1 = [a.street, a.number].filter(Boolean).join(', ') + (a.complement ? ` – ${a.complement}` : '');
  return [line1, a.neighborhood, [a.city, a.district].filter(Boolean).join('/'), a.zipCode].filter(Boolean).join(' · ');
}

/** Valores (já escapados) de cada variável. */
function variables(quote: DocQuote, doc: QuoteDocument): Record<string, string> {
  const e = doc.establishment;
  const logo = doc.branding.logoUrl || e.logoUrl;
  return {
    'logo': logo ? `<img src="${escapeHtml(logo)}" alt="" style="max-height:64px;max-width:160px;object-fit:contain">` : '',
    'estabelecimento.nome': escapeHtml(e.name),
    'estabelecimento.cnpj': escapeHtml(cnpj(e.cnpj)),
    'estabelecimento.telefone': escapeHtml(phone(e.phone)),
    'estabelecimento.email': escapeHtml(e.email ?? ''),
    'estabelecimento.endereco': escapeHtml(address(e)),
    'empresa.nome': escapeHtml(doc.branding.displayName || e.enterpriseName),
    'orcamento.numero': escapeHtml(quote.numberQuote),
    'orcamento.data': escapeHtml(date(quote.createdAt)),
    'orcamento.validade': escapeHtml(date(quote.validUntil)),
    'orcamento.total': escapeHtml(money(quote.total)),
    'cliente.nome': escapeHtml(quote.client.name),
    'cliente.telefone': escapeHtml(phone(quote.client.principalPhone)),
    'cliente.email': escapeHtml(quote.client.email ?? ''),
    'veiculo.descricao': escapeHtml(`${quote.vehicle.make} ${quote.vehicle.name}`.trim()),
    'veiculo.placa': escapeHtml(plate(quote.vehicle.plate)),
    'itens': itemsTable(quote),
    'observacoes': quote.notes ? `<div class="notes"><b>Observações</b><p>${escapeHtml(quote.notes)}</p></div>` : '',
    'data.hoje': escapeHtml(date(new Date())),
  };
}

function fill(html: string | null | undefined, vars: Record<string, string>): string {
  return (html ?? '').replace(/\{\{\s*([a-z.]+)\s*\}\}/gi, (m, key: string) => vars[key.toLowerCase()] ?? m);
}

function itemsTable(quote: DocQuote): string {
  const rows = quote.items.map(i => `
    <tr>
      <td><span class="kind kind-${i.kind}">${ITEM_KIND_LABEL[i.kind]}</span>${escapeHtml(i.description)}</td>
      <td class="num">${qty(i.quantity)}</td>
      <td class="num">${money(i.unitPrice)}</td>
      <td class="num">${i.discount ? '−' + money(i.discount) : '—'}</td>
      <td class="num strong">${money(i.total)}</td>
    </tr>`).join('');
  const parts = quote.items.filter(i => i.kind === 'PECA').reduce((a, i) => a + i.total, 0);
  const labor = quote.items.filter(i => i.kind === 'SERVICO').reduce((a, i) => a + i.total, 0);
  return `
  <table class="items">
    <thead><tr><th>Descrição</th><th class="num">Qtd.</th><th class="num">Unitário</th><th class="num">Desconto</th><th class="num">Total</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" class="empty">Nenhum item.</td></tr>'}</tbody>
  </table>
  <table class="totals">
    <tr><td>Peças</td><td class="num">${money(parts)}</td></tr>
    <tr><td>Mão de obra</td><td class="num">${money(labor)}</td></tr>
    <tr class="grand"><td>Total</td><td class="num">${money(quote.total)}</td></tr>
  </table>`;
}

// estilos
function baseCss(accent: string): string {
  return `
  @page { size: A4; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Geist', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1b1b1b; font-size: 12.5px; line-height: 1.45;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { max-width: 182mm; margin: 0 auto; }
  img { max-width: 100%; }
  table { border-collapse: collapse; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .strong { font-weight: 600; }
  table.items { width: 100%; margin-top: 14px; }
  table.items th { font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: #6d6b65; text-align: left; padding: 8px 8px; border-bottom: 1.5px solid #1b1b1b; }
  table.items th.num { text-align: right; }
  table.items td { padding: 8px 8px; border-bottom: 1px solid #e6e3dc; vertical-align: top; }
  table.items tr { page-break-inside: avoid; }
  td.empty { color: #8a877f; text-align: center; padding: 18px; }
  .kind { display: inline-block; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; padding: 1px 6px; margin-right: 8px; border-radius: 4px; background: #f1efe9; color: #5d5b55; }
  .kind-SERVICO { background: ${accent}1a; color: ${accent}; }
  table.totals { margin: 12px 0 0 auto; min-width: 240px; }
  table.totals td { padding: 4px 8px; color: #55534d; }
  table.totals tr.grand td { padding-top: 9px; border-top: 1.5px solid #1b1b1b; font-size: 16px; font-weight: 700; color: #111; }
  .notes { margin-top: 18px; padding: 10px 12px; border-left: 3px solid ${accent}; background: #faf9f6; page-break-inside: avoid; }
  .notes p { margin: 4px 0 0; white-space: pre-wrap; }
  .muted { color: #77756f; }
  `;
}

function shell(title: string, css: string, body: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div class="sheet">${body}</div></body></html>`;
}

// modelo Odramech (padrão)
function odramechTemplate(quote: DocQuote, doc: QuoteDocument, v: Record<string, string>, accent: string): string {
  const css = baseCss(accent) + `
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 14px; border-bottom: 3px solid ${accent}; }
  .brand { display: flex; gap: 12px; align-items: center; }
  .brand h1 { font-size: 19px; margin: 0; letter-spacing: -.02em; }
  .brand p { margin: 2px 0 0; color: #6d6b65; font-size: 11.5px; }
  .doc-id { text-align: right; }
  .doc-id .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .12em; color: ${accent}; font-weight: 700; }
  .doc-id .no { font-size: 22px; font-weight: 700; letter-spacing: -.02em; }
  .doc-id p { margin: 0; color: #6d6b65; font-size: 11.5px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
  .box { border: 1px solid #e6e3dc; border-radius: 8px; padding: 10px 12px; }
  .box .t { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #8a877f; margin-bottom: 3px; }
  .box b { font-size: 13.5px; }
  .foot { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e6e3dc; display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: #77756f; }
  `;
  const body = `
  <header class="head">
    <div class="brand">${v['logo']}<div><h1>${v['estabelecimento.nome']}</h1>
      <p>${[v['estabelecimento.cnpj'] && 'CNPJ ' + v['estabelecimento.cnpj'], v['estabelecimento.telefone'], v['estabelecimento.email']].filter(Boolean).join(' · ')}</p>
      <p>${v['estabelecimento.endereco']}</p></div></div>
    <div class="doc-id"><div class="label">Orçamento</div><div class="no">nº ${v['orcamento.numero']}</div><p>Emitido em ${v['orcamento.data']}</p></div>
  </header>
  <section class="parties">
    <div class="box"><div class="t">Cliente</div><b>${v['cliente.nome']}</b><div class="muted">${[v['cliente.telefone'], v['cliente.email']].filter(Boolean).join(' · ')}</div></div>
    <div class="box"><div class="t">Veículo</div><b>${v['veiculo.descricao']}</b><div class="muted">Placa ${v['veiculo.placa']}</div></div>
  </section>
  ${v['itens']}
  ${v['observacoes']}
  <footer class="foot"><span>Válido até <b>${v['orcamento.validade']}</b></span><span>Gerado por ${v['estabelecimento.nome']}</span></footer>`;
  return shell(`Orçamento ${quote.numberQuote} · ${doc.establishment.name}`, css, body);
}

// modelo Premium
function premiumTemplate(quote: DocQuote, doc: QuoteDocument, v: Record<string, string>, accent: string): string {
  const css = baseCss(accent) + `
  .band { background: #141414; color: #fff; border-radius: 12px; padding: 20px 22px; display: flex; justify-content: space-between; align-items: center; gap: 16px; position: relative; overflow: hidden; }
  .band::after { content: ''; position: absolute; right: -60px; top: -80px; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle, ${accent}55, transparent 65%); }
  .band .brand { display: flex; gap: 14px; align-items: center; position: relative; z-index: 1; }
  .band .brand img { background: #fff; border-radius: 8px; padding: 4px; }
  .band h1 { font-family: Georgia, 'Times New Roman', serif; font-weight: 400; font-size: 24px; margin: 0; letter-spacing: -.01em; }
  .band p { margin: 3px 0 0; color: #b9b7b0; font-size: 11px; }
  .band .doc-id { text-align: right; position: relative; z-index: 1; }
  .band .label { font-size: 10px; text-transform: uppercase; letter-spacing: .2em; color: ${accent}; }
  .band .no { font-family: Georgia, serif; font-size: 28px; line-height: 1.1; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin: 16px 0 6px; border: 1px solid #e6e3dc; border-radius: 10px; overflow: hidden; }
  .meta div { padding: 10px 12px; border-right: 1px solid #e6e3dc; }
  .meta div:last-child { border-right: 0; }
  .meta .t { font-size: 9.5px; text-transform: uppercase; letter-spacing: .12em; color: #8a877f; }
  .meta b { display: block; font-size: 12.5px; margin-top: 2px; }
  table.items th { border-bottom-color: ${accent}; }
  table.totals tr.grand td { color: ${accent}; border-top-color: ${accent}; font-family: Georgia, serif; font-size: 19px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 46px; page-break-inside: avoid; }
  .sign div { border-top: 1px solid #1b1b1b; padding-top: 6px; text-align: center; font-size: 11px; color: #55534d; }
  .foot { margin-top: 22px; text-align: center; font-size: 10.5px; color: #8a877f; letter-spacing: .02em; }
  .foot .dot { color: ${accent}; margin: 0 6px; }
  `;
  const body = `
  <header class="band">
    <div class="brand">${v['logo']}<div><h1>${v['estabelecimento.nome']}</h1>
      <p>${[v['estabelecimento.cnpj'] && 'CNPJ ' + v['estabelecimento.cnpj'], v['estabelecimento.telefone'], v['estabelecimento.email']].filter(Boolean).join(' · ')}</p>
      <p>${v['estabelecimento.endereco']}</p></div></div>
    <div class="doc-id"><div class="label">Orçamento</div><div class="no">nº ${v['orcamento.numero']}</div></div>
  </header>
  <section class="meta">
    <div><span class="t">Cliente</span><b>${v['cliente.nome']}</b><span class="muted">${v['cliente.telefone']}</span></div>
    <div><span class="t">Veículo</span><b>${v['veiculo.descricao']}</b><span class="muted">${v['veiculo.placa']}</span></div>
    <div><span class="t">Emissão</span><b>${v['orcamento.data']}</b></div>
    <div><span class="t">Válido até</span><b>${v['orcamento.validade']}</b></div>
  </section>
  ${v['itens']}
  ${v['observacoes']}
  <section class="sign"><div>${v['cliente.nome']}<br>Aprovação do cliente</div><div>${v['estabelecimento.nome']}<br>Responsável</div></section>
  <footer class="foot">Gerado por ${v['estabelecimento.nome']}<span class="dot">●</span>Orçamento válido até ${v['orcamento.validade']}</footer>`;
  return shell(`Orçamento ${quote.numberQuote} · ${doc.establishment.name}`, css, body);
}

// modelo personalizado
function customTemplate(quote: DocQuote, doc: QuoteDocument, v: Record<string, string>, accent: string): string {
  const s = doc.settings;
  const body = s.quoteBodyHtml?.trim() ? s.quoteBodyHtml : CUSTOM_STARTER.body;
  const css = baseCss(accent) + `.custom-header, .custom-footer { page-break-inside: avoid; } .custom-body { margin: 10px 0; } p { margin: 0 0 6px; }`;
  const html = `
  <header class="custom-header">${fill(s.quoteHeaderHtml, v)}</header>
  <main class="custom-body">${fill(body, v)}</main>
  <footer class="custom-footer">${fill(s.quoteFooterHtml, v)}</footer>`;
  return shell(`Orçamento ${quote.numberQuote} · ${doc.establishment.name}`, css, html);
}

export function renderQuoteDocument(quote: DocQuote, doc: QuoteDocument, template: QuoteTemplate = doc.settings.effectiveTemplate): string {
  const accent = /^#[0-9a-f]{6}$/i.test(doc.branding.accentColor ?? '') ? doc.branding.accentColor! : DEFAULT_ACCENT;
  const v = variables(quote, doc);
  switch (template) {
    case 'PREMIUM': return premiumTemplate(quote, doc, v, accent);
    case 'CUSTOM': return customTemplate(quote, doc, v, accent);
    default: return odramechTemplate(quote, doc, v, accent);
  }
}

/** Orçamento de exemplo para a pré-visualização nas configurações. */
export function sampleQuote(validityDays: number): DocQuote {
  const now = new Date();
  const valid = new Date(now);
  valid.setDate(valid.getDate() + validityDays);
  const items = [
    { kind: 'SERVICO' as const, description: 'Troca de pastilhas de freio dianteiras', quantity: 1, unitPrice: 180, discount: 0, total: 180 },
    { kind: 'PECA' as const, description: 'Jogo de pastilhas de freio (dianteiro)', quantity: 1, unitPrice: 249.9, discount: 20, total: 229.9 },
    { kind: 'PECA' as const, description: 'Fluido de freio DOT 4 – 500 ml', quantity: 2, unitPrice: 39.5, discount: 0, total: 79 },
  ];
  return {
    numberQuote: 128, createdAt: now, validUntil: valid,
    notes: 'Prazo de execução: 1 dia útil. Garantia de 90 dias para peças e serviços.',
    client: { name: 'Maria Silva', principalPhone: '51999990000', email: 'maria@email.com' },
    vehicle: { plate: 'RXT4F21', name: 'Polo TSI', make: 'Volkswagen' },
    items, total: items.reduce((a, i) => a + i.total, 0),
  };
}
