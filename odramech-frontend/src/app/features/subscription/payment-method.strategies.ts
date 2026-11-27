import { PaymentMethod } from './subscription.models';

/**
 * STRATEGY de apresentação por forma de pagamento.
 * A tela pergunta à estratégia o que mostrar e se precisa de dados extras,
 * em vez de espalhar `if (method === 'CARD')` pelo template.
 */
export interface PaymentMethodUi {
  method: PaymentMethod;
  label: string;
  icon: string;
  hint: string;
  /** cartão: o token viria do SDK do provedor (no sandbox, digitado) */
  needsCardToken: boolean;
  /** confirmação assíncrona (Pix/Boleto) — mostra "aguardando pagamento" */
  async: boolean;
}

export const PAYMENT_UI: Record<PaymentMethod, PaymentMethodUi> = {
  PIX: { method: 'PIX', label: 'Pix', icon: 'fa-brands fa-pix', hint: 'Aprovação na hora após o pagamento.', needsCardToken: false, async: true },
  CARD: { method: 'CARD', label: 'Cartão de crédito', icon: 'fa-regular fa-credit-card', hint: 'Cobrança automática a cada renovação.', needsCardToken: true, async: false },
  BOLETO: { method: 'BOLETO', label: 'Boleto', icon: 'fa-solid fa-barcode', hint: 'Compensa em até 3 dias úteis.', needsCardToken: false, async: true },
};

export const PAYMENT_LIST = Object.values(PAYMENT_UI);
