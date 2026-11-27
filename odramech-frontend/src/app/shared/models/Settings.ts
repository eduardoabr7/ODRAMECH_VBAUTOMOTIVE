export type QuoteTemplate = 'ODRAMECH' | 'PREMIUM' | 'CUSTOM';

export interface QuoteDocumentSettings {
  quoteTemplate: QuoteTemplate;
  /** modelo que vai de fato para a impressão (CUSTOM sem o recurso no plano volta para ODRAMECH) */
  effectiveTemplate: QuoteTemplate;
  quoteHeaderHtml: string | null;
  quoteBodyHtml: string | null;
  quoteFooterHtml: string | null;
  quoteValidityDays: number;
  markQuoteSentOnPrint: boolean;
  /** enviar ao cliente por e-mail ao salvar (e as atualizações) */
  autoEmailQuote: boolean;
}

export interface DocumentEstablishment {
  id: number;
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
  settings: QuoteDocumentSettings;
  establishment: DocumentEstablishment;
  branding: { displayName: string | null; logoUrl: string | null; accentColor: string | null };
  /** plano libera o editor HTML? */
  canCustomize: boolean;
  /** variáveis do modelo personalizado e modelo inicial do editor */
  templateVariables: { key: string; label: string }[];
  customStarter: { header: string; body: string; footer: string };
}

export interface QuoteDocumentPreview {
  quoteTemplate: QuoteTemplate;
  quoteHeaderHtml: string | null;
  quoteBodyHtml: string | null;
  quoteFooterHtml: string | null;
  quoteValidityDays: number;
}

export type QuoteDocumentUpdate = Partial<Omit<QuoteDocumentSettings, 'effectiveTemplate'>>;

export interface Branding {
  enterpriseName: string | null;
  publicKey: string | null;
  displayName: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  loginImageUrl: string | null;
  loginHeadline: string | null;
  loginSubtitle: string | null;
  /** plano libera imagem/textos do login? */
  canCustomizeLogin: boolean;
}

export type BrandingUpdate = Partial<Omit<Branding, 'enterpriseName' | 'publicKey' | 'canCustomizeLogin'>>;

export interface PublicBranding {
  displayName: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  loginImageUrl: string | null;
  loginHeadline: string | null;
  loginSubtitle: string | null;
}
