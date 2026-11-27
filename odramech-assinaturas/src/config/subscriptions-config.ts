import * as dotenv from 'dotenv';
import * as Joi from 'joi';

export interface SubscriptionsConfigValues {
  port: number;
  databaseUrl: string;
  apiKey: string;
  mainBackendWebhookUrl: string | null;
  paymentProvider: 'sandbox';
  trialDays: number;
  graceDays: number;
  renewalLeadDays: number;
  schedulerIntervalSeconds: number;
}

const schema = Joi.object({
  PORT: Joi.number().port().default(3010),
  DATABASE_URL: Joi.string().uri().required(),
  API_KEY: Joi.string().min(12).required(),
  MAIN_BACKEND_WEBHOOK_URL: Joi.string().uri().allow('').optional(),
  PAYMENT_PROVIDER: Joi.string().valid('sandbox').default('sandbox'),
  TRIAL_DAYS: Joi.number().integer().min(0).default(14),
  GRACE_DAYS: Joi.number().integer().min(0).default(7),
  RENEWAL_LEAD_DAYS: Joi.number().integer().min(0).default(5),
  SCHEDULER_INTERVAL_SECONDS: Joi.number().integer().min(5).default(60),
}).unknown(true);

/** SINGLETON — configuração do serviço, carregada e validada uma única vez. */
export class SubscriptionsConfig {
  private static instance: SubscriptionsConfig | null = null;
  readonly values: Readonly<SubscriptionsConfigValues>;

  private constructor(env: NodeJS.ProcessEnv) {
    const { error, value } = schema.validate(env, { abortEarly: false, convert: true });
    if (error) throw new Error(`.env inválido (odramech-assinaturas):\n${error.details.map(d => `  - ${d.message}`).join('\n')}`);

    this.values = Object.freeze({
      port: value.PORT,
      databaseUrl: value.DATABASE_URL,
      apiKey: value.API_KEY,
      mainBackendWebhookUrl: value.MAIN_BACKEND_WEBHOOK_URL || null,
      paymentProvider: value.PAYMENT_PROVIDER,
      trialDays: value.TRIAL_DAYS,
      graceDays: value.GRACE_DAYS,
      renewalLeadDays: value.RENEWAL_LEAD_DAYS,
      schedulerIntervalSeconds: value.SCHEDULER_INTERVAL_SECONDS,
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
