import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';

/**
 * DECORATOR de parâmetro — entrega o payload do JWT já tipado:
 *
 *   list(@CurrentAuth() auth: AuthPayload) { ... }
 *
 * Substitui o `req.authContext as AuthPayload` espalhado pelos controllers.
 */
export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthPayload => {
  const req = ctx.switchToHttp().getRequest();
  if (!req.authContext) throw new UnauthorizedException('Sessão não identificada.');
  return req.authContext as AuthPayload;
});
