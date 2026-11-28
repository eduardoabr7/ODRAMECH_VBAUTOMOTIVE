import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

interface FlatError {
  property: string;
  value: unknown;
  constraints: Record<string, string>;
}

/** nunca devolver na resposta o que foi digitado em campos sensíveis (senha, token…) */
const SENSITIVE = /pass(word)?|senha|token|secret|cvv|card/i;

function flatten(errors: ValidationError[], parent = ''): FlatError[] {
  return errors.flatMap(error => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const value = SENSITIVE.test(error.property) ? '[oculto]' : error.value;
    const own = error.constraints ? [{ property: path, value, constraints: error.constraints }] : [];
    return [...own, ...flatten(error.children ?? [], path)];
  });
}

/**
 * FACTORY — monta o ValidationPipe global com a política do projeto:
 * remove campos não declarados, rejeita campos extras e devolve TODOS os erros (aninhados inclusive).
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: errors => new BadRequestException({
      statusCode: 400,
      message: 'Validation failed',
      errors: flatten(errors),
    }),
  });
}
