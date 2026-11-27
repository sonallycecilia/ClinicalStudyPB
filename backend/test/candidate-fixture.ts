import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { UsersService } from '../src/users/users.service.js';

// Cada novo cadastro precisa de uma conta real distinta dentro do mesmo estudo.
export async function candidateAccountId(app: INestApplication): Promise<string> {
  const account = await app.get(UsersService).create({
    name: 'Participante RF08–RF11', email: `${randomUUID()}@candidate.test`,
    role: 'Participante', phone: '83999990000', password: 'Senha123!',
  });
  return account.id;
}
