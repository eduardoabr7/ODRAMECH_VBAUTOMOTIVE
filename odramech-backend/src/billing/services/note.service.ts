import { Injectable } from '@nestjs/common';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { NoteRepository } from '../repositories/billing.repositories';

/** Bloco de notas pessoal (por usuário + estabelecimento). */
@Injectable()
export class NoteService {
  constructor(private readonly notes: NoteRepository) {}

  async get(auth: AuthPayload) {
    return (await this.notes.get(auth.sub, auth.establishmentId)) ?? { content: '', updatedAt: null };
  }

  save(auth: AuthPayload, content: string) {
    return this.notes.save(auth.sub, auth.establishmentId, content);
  }
}
