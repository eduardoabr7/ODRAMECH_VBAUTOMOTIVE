import * as dotenv from 'dotenv';
import * as Joi from 'joi';

export interface SubscriptionsConfigValues {
  port: number;
  databaseUrl: string;
  apiKey: string;
  mainBackendWebhookUrl: string | null;
  /** base do backend da oficina (lista de empresas para o painel); derivada do webhook quando vazia */
  mainBackendUrl: string | null;
  paymentProvider: 'sandbox';
  trialDays: number;
  graceDays: number;
  renewalLeadDays: number;
  schedulerIntervalSeconds: number;
  /** plano do teste grátis (e de quem ainda não escolheu) */
  defaultPlanCode: string;
  isProduction: boolean;
  /**
   * Cobranças podem ser processadas? Falso com o provedor sandbox em produção:
   * sem provedor real, ninguém consegue "pagar" (e liberar plano) de mentira.
   */
  paymentsEnabled: boolean;
  /** "simular pagamento" só existe no provedor sandbox e fora de produção */
  allowSimulatedPayments: boolean;
  /** segredo HMAC do webhook do sandbox */
  sandboxWebhookSecret: string;
  /** duração da sessão do painel administrativo */
  adminSessionHours: number;
}

const DEV_DEFAULTS = ['dev-odramech-subscriptions-key', 'sandbox-dev-webhook-secret'];

const schema = Joi.object({
  PORT: Joi.number().port().default(3010),
  DATABASE_URL: Joi.string().uri().required(),
  API_KEY: Joi.string().min(12).required(),
  MAIN_BACKEND_WEBHOOK_URL: Joi.string().uri().allow('').optional(),
  MAIN_BACKEND_URL: Joi.string().uri().allow('').optional(),
  PAYMENT_PROVIDER: Joi.string().valid('sandbox').default('sandbox'),
  TRIAL_DAYS: Joi.number().integer().min(0).default(7),
  GRACE_DAYS: Joi.number().integer().min(0).default(7),
  RENEWAL_LEAD_DAYS: Joi.number().integer().min(0).default(5),
  SCHEDULER_INTERVAL_SECONDS: Joi.number().integer().min(5).default(60),
  DEFAULT_PLAN_CODE: Joi.string().default('INTERMEDIARIO'),
  SANDBOX_WEBHOOK_SECRET: Joi.string().min(16).default('sandbox-dev-webhook-secret'),
  ADMIN_SESSION_HOURS: Joi.number().min(1).max(24).default(8),
  // vazio no .env conta como desenvolvimento
  NODE_ENV: Joi.string().allow('').empty('').default('development'),
}).unknown(true);

function originOf(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).origin; } catch { return null; }
}

/** SINGLETON — configuração do serviço, carregada e validada uma única vez. */
export class SubscriptionsConfig {
  private static instance: SubscriptionsConfig | null = null;
  readonly values: Readonly<SubscriptionsConfigValues>;

  private constructor(env: NodeJS.ProcessEnv) {
    const { error, value } = schema.validate(env, { abortEarly: false, convert: true });
    if (error) throw new Error(`.env inválido (odramech-assinaturas):\n${error.details.map(d => `  - ${d.message}`).join('\n')}`);

    const isProduction = value.NODE_ENV === 'production';
    if (isProduction) {
      const weak = [value.API_KEY, value.SANDBOX_WEBHOOK_SECRET].filter(v => DEV_DEFAULTS.includes(v) || String(v).length < 32);
      if (weak.length) throw new Error('.env inválido (odramech-assinaturas): em produção API_KEY e SANDBOX_WEBHOOK_SECRET precisam ser novos, aleatórios e com 32+ caracteres.');
    }

    const webhook = value.MAIN_BACKEND_WEBHOOK_URL || null;
    this.values = Object.freeze({
      port: value.PORT,
      databaseUrl: value.DATABASE_URL,
      apiKey: value.API_KEY,
      mainBackendWebhookUrl: webhook,
      mainBackendUrl: value.MAIN_BACKEND_URL || originOf(webhook),
      paymentProvider: value.PAYMENT_PROVIDER,
      trialDays: value.TRIAL_DAYS,
      graceDays: value.GRACE_DAYS,
      renewalLeadDays: value.RENEWAL_LEAD_DAYS,
      schedulerIntervalSeconds: value.SCHEDULER_INTERVAL_SECONDS,
      defaultPlanCode: value.DEFAULT_PLAN_CODE,
      isProduction,
      paymentsEnabled: !(value.PAYMENT_PROVIDER === 'sandbox' && isProduction),
      allowSimulatedPayments: value.PAYMENT_PROVIDER === 'sandbox' && !isProduction,
      sandboxWebhookSecret: value.SANDBOX_WEBHOOK_SECRET,
      adminSessionHours: value.ADMIN_SESSION_HOURS,
    });
  }

  static get(): SubscriptionsConfig {
    if (!SubscriptionsConfig.instance) {
      dotenv.config();
      SubscriptionsConfig.instance = new SubscriptionsConfig(process.env);
    }
    return SubscriptionsConfig.instance;
  }

  /** testes: injeta valores sem depender de .env */
  static forTesting(overrides: Partial<NodeJS.ProcessEnv> = {}): SubscriptionsConfig {
    SubscriptionsConfig.instance = new SubscriptionsConfig({
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      API_KEY: 'test-api-key-123',
      ...overrides,
    });
    return SubscriptionsConfig.instance;
  }
}
