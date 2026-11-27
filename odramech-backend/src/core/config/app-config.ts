import * as dotenv from 'dotenv';
import * as Joi from 'joi';

export type SubscriptionEnforcement = 'off' | 'warn' | 'block';

export interface AppConfigValues {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpires: string;
  frontendOrigin: string;
  isProduction: boolean;
  uploadDir: string | null;
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
  JWT_EXPIRES: Joi.string().required(),
  FRONTEND_HOST: Joi.string().required(),
  FRONTEND_PORT: Joi.number().port().required(),
  NODE_ENV: Joi.string().default('development'),
  UPLOAD_DIR: Joi.string().allow('').optional(),
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
      jwtExpires: value.JWT_EXPIRES,
      frontendOrigin: `http://${value.FRONTEND_HOST}:${value.FRONTEND_PORT}`,
      isProduction: value.NODE_ENV === 'production',
      uploadDir: value.UPLOAD_DIR || null,
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
