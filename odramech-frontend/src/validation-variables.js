const Joi = require('joi');
const dotenv = require('dotenv');

// Carregando as variáveis do .env
dotenv.config();

const envSchema = Joi.object({
  hostBackend: Joi.string().required(),
  portBackend: Joi.number().required(),
}).unknown(true);

async function validateAndStart() {
  const { error } = envSchema.validate(process.env, { abortEarly: false, convert: true });

  if (error) {
    console.error('===================================================');
    console.error('| ❌ Erro na validação das variáveis de ambiente! |');
    console.error('===================================================');

    error.details.forEach(detail => {
      console.error(`- ${detail.message}`);
    });

    console.error('\nPor favor, verifique e preencha seu arquivo .env.');
    console.error('===================================================');
    process.exit(1);
  } else {

    console.log('Analisando variáveis de ambiente...')

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✅ Variáveis de ambiente validadas com sucesso.');

    console.log('🚀 Iniciando processo do Frontend 🚀...');

    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

validateAndStart();