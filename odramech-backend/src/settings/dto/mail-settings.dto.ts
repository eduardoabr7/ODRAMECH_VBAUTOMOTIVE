import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const HOSTNAME = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export class MailSettingsDTO {
  /** false = volta a usar o e-mail padrão do Odramech (a configuração fica guardada) */
  @IsBoolean()
  enabled: boolean;

  @IsString() @Matches(HOSTNAME, { message: 'Servidor SMTP inválido (ex.: smtp.seudominio.com.br).' })
  host: string;

  @IsInt() @Min(1) @Max(65535)
  port: number;

  /** true = SSL/TLS (465); false = STARTTLS (587/25) */
  @IsBoolean()
  secure: boolean;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(200)
  username?: string | null;

  /** ausente = mantém a senha salva; '' = remove */
  @IsOptional() @IsString() @MaxLength(500)
  password?: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(80)
  fromName?: string | null;

  @IsEmail({}, { message: 'E-mail do remetente inválido.' }) @MaxLength(200)
  fromEmail: string;
}

export class MailTestDTO extends MailSettingsDTO {
  /** para quem mandar o teste (padrão: e-mail de quem está testando) */
  @IsOptional() @IsEmail({}, { message: 'E-mail de destino inválido.' })
  to?: string;
}
