import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Troca obrigatória da senha provisória no primeiro acesso. */
export class FirstPasswordDTO {
  @IsString()
  @MinLength(8, { message: 'A nova senha precisa ter pelo menos 8 caracteres.' })
  // bcrypt só considera os primeiros 72 bytes
  @MaxLength(72, { message: 'A nova senha pode ter no máximo 72 caracteres.' })
  @Matches(/[A-Za-z]/, { message: 'A nova senha precisa ter pelo menos uma letra.' })
  @Matches(/\d/, { message: 'A nova senha precisa ter pelo menos um número.' })
  newPassword: string;

  @IsString()
  @MaxLength(72)
  confirmPassword: string;
}
