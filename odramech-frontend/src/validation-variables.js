// Valida o .env do frontend e gera src/environments/environment.ts a partir dele.
// Roda automaticamente antes de `npm start` / `npm run build`.
const Joi = require('joi');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const envSchema = Joi.object({
  HOST_BACKEND: Joi.string().hostname().required(),
  PORT_BACKEND: Joi.number().port().required(),
}).unknown(true);

const { error, value } = envSchema.validate(process.env, { abortEarly: false, convert: true });

if (error) {
  console.error('===================================================');
  console.error('| ❌ Erro na validação das variáveis de ambiente! |');
  console.error('===================================================');
  error.details.forEach(detail => console.error(`- ${detail.message}`));
  console.error('\nVerifique o arquivo odramech-frontend/.env (veja .env.example).');
  console.error('===================================================');
  process.exit(1);
}

// aceita também a grafia "nomeEstabelecimeno"
const nome = value.nomeEstabelecimento || value.nomeEstabelecimeno || 'Odramech';

const content = `// ARQUIVO GERADO por src/validation-variables.js a partir do .env — não edite à mão.
export const env = {
    production: false,
    nomeEstabelecimento: ${JSON.stringify(nome)},
    hostBackend: ${JSON.stringify(value.HOST_BACKEND)},
    portBackend: ${Number(value.PORT_BACKEND)}
}
`;

const target = path.join(__dirname, 'environments', 'environment.ts');
if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
  fs.writeFileSync(target, content);
}

console.log(`✅ .env validado — backend em http://${value.HOST_BACKEND}:${value.PORT_BACKEND}`);
