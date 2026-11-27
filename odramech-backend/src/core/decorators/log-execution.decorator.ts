import { Logger } from '@nestjs/common';

/**
 * DECORATOR — adiciona log de duração/erro a um método sem alterar o corpo dele.
 *
 *   @LogExecution()
 *   async stats(...) { ... }
 *
 * Use em operações caras ou críticas (relatórios, integrações externas).
 */
export function LogExecution(label?: string, slowMs = 300): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value as (...args: any[]) => any;
    const name = label ?? `${target.constructor.name}.${String(propertyKey)}`;
    const logger = new Logger('Perf');

    descriptor.value = async function (...args: any[]) {
      const started = Date.now();
      try {
        return await original.apply(this, args);
      } catch (err) {
        logger.warn(`${name} falhou após ${Date.now() - started}ms: ${(err as Error).message}`);
        throw err;
      } finally {
        const elapsed = Date.now() - started;
        if (elapsed >= slowMs) logger.warn(`${name} lento: ${elapsed}ms`);
      }
    };
    return descriptor;
  };
}
