import * as dotenv from 'dotenv';
import * as Joi from 'joi';

export type SubscriptionEnforcement = 'off' | 'warn' | 'block';

export interface AppConfigValues {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  /** chave para criptografar segredos guardados no banco (ex.: senha SMTP das empresas) */
  secretsKey: string;
  jwtExpires: string;
  /** duração da sessão (login) em horas */
  sessionHours: number;
  frontendOrigin: string;
  isProduction: boolean;
  uploadDir: string | null;
  /** endereço do frontend usado nos links dos e-mails (ex.: https://app.suaoficina.com.br) */
  publicAppUrl: string;
  mail: {
    /** null = SMTP não configurado: e-mails são gerados e salvos em ./outbox (desenvolvimento) */
    host: string | null;
    port: number;
    secure: boolean;
    user: string | null;
    pass: string | null;
    from: string;
    outboxDir: string;
  };
  /** Chrome/Edge usado para gerar o PDF (vazio = detecta o instalado) */
  chromePath: string | null;
  /** minutos de espera antes de enviar o e-mail de atualização (junta edições seguidas) */
  quoteUpdateEmailDelayMinutes: number;
  subscriptions: {
    url: string;
    apiKey: string;
    enforcement: SubscriptionEnforcement;
    cacheTtlSeconds: number;
  };
}

const schema = Joi.object({
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(8).required(),
  SECRETS_KEY: Joi.string().min(16).allow('').optional(),
  JWT_EXPIRES: Joi.string().required(),
  SESSION_HOURS: Joi.number().min(0.25).max(24).default(4),
  FRONTEND_HOST: Joi.string().required(),
  FRONTEND_PORT: Joi.number().port().required(),
  // vazio no .env conta como desenvolvimento
  NODE_ENV: Joi.string().allow('').empty('').default('development'),
  UPLOAD_DIR: Joi.string().allow('').optional(),
  PUBLIC_APP_URL: Joi.string().uri().allow('').optional(),
  SMTP_HOST: Joi.string().allow('').optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  MAIL_FROM: Joi.string().allow('').optional(),
  MAIL_OUTBOX_DIR: Joi.string().allow('').optional(),
  CHROME_PATH: Joi.string().allow('').optional(),
  QUOTE_UPDATE_EMAIL_DELAY_MINUTES: Joi.number().min(0).default(10),
  SUBSCRIPTIONS_URL: Joi.string().uri().default('http://localhost:3010'),
  SUBSCRIPTIONS_API_KEY: Joi.string().default('dev-odramech-subscriptions-key'),
  SUBSCRIPTION_ENFORCEMENT: Joi.string().valid('off', 'warn', 'block').default('warn'),
  SUBSCRIPTION_CACHE_TTL: Joi.number().min(0).default(60),
}).unknown(true);

/**
 * SINGLETON — configuração global, carregada e validada UMA vez.
 *
 * Antes, cada arquivo lia `process.env` no momento do import (o JWT_SECRET só existia
 * porque o @prisma/client carregava o .env antes "por acaso"). Agora o .env é lido aqui,
 * validado com Joi, e todo o sistema consome valores tipados.
 */
export class AppConfig {
  private static instance: AppConfig | null = null;
  readonly values: Readonly<AppConfigValues>;

  private constructor() {
    dotenv.config();
    const { error, value } = schema.validate(process.env, { abortEarly: false, convert: true });
    if (error) {
      const details = error.details.map(d => `  - ${d.message}`).join('\n');
      throw new Error(`Variáveis de ambiente inválidas (odramech-backend/.env):\n${details}`);
    }

    this.values = Object.freeze({
      port: value.PORT,
      databaseUrl: value.DATABASE_URL,
      jwtSecret: value.JWT_SECRET,
      // sem SECRETS_KEY, deriva do JWT_SECRET (trocar o JWT_SECRET depois exige salvar as senhas SMTP de novo)
      secretsKey: value.SECRETS_KEY || `jwt:${value.JWT_SECRET}`,
      jwtExpires: value.JWT_EXPIRES,
      sessionHours: value.SESSION_HOURS,
      frontendOrigin: `http://${value.FRONTEND_HOST}:${value.FRONTEND_PORT}`,
      isProduction: value.NODE_ENV === 'production',
      uploadDir: value.UPLOAD_DIR || null,
      publicAppUrl: (value.PUBLIC_APP_URL || `http://${value.FRONTEND_HOST}:${value.FRONTEND_PORT}`).replace(/\/+$/, ''),
      mail: Object.freeze({
        host: value.SMTP_HOST || null,
        port: value.SMTP_PORT,
        secure: value.SMTP_SECURE,
        user: value.SMTP_USER || null,
        pass: value.SMTP_PASS || null,
        from: value.MAIL_FROM || 'Odramech <no-reply@odramech.com.br>',
        outboxDir: value.MAIL_OUTBOX_DIR || 'outbox',
      }),
      chromePath: value.CHROME_PATH || null,
      quoteUpdateEmailDelayMinutes: value.QUOTE_UPDATE_EMAIL_DELAY_MINUTES,
      subscriptions: Object.freeze({
        url: value.SUBSCRIPTIONS_URL.replace(/\/+$/, ''),
        apiKey: value.SUBSCRIPTIONS_API_KEY,
        enforcement: value.SUBSCRIPTION_ENFORCEMENT,
        cacheTtlSeconds: value.SUBSCRIPTION_CACHE_TTL,
      }),
    });
  }

  static get(): AppConfig {
    if (!AppConfig.instance) AppConfig.instance = new AppConfig();
    return AppConfig.instance;
  }

  /** só para testes */
  static reset(): void {
    AppConfig.instance = null;
  }
}
