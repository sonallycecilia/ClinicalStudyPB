import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { StudiesService, statusFor } from './studies.service.js';

const payload = {
  title: 'Teste de qualidade do sono',
  objective: 'Avaliar indicadores de sono em um estudo fictício.',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  participantLimit: 12,
  participantsLinked: 4,
};

describe('StudiesService', () => {
  let users: UsersService;
  let studies: StudiesService;
  beforeEach(() => {
    users = new UsersService();
    studies = new StudiesService(users);
  });

  it('retorna apenas estudos da pesquisadora autenticada', () => {
    expect(studies.listForResearcher('usr-researcher')).toHaveLength(3);
    expect(() => studies.listForResearcher('usr-admin')).toThrow(ForbiddenException);
  });

  it('cria, consulta e edita estudo com código gerado pela API', () => {
    const created = studies.create(payload, 'usr-researcher');
    expect(created.code).toBe('EST-004');
    expect(created.researcherId).toBe('usr-researcher');
    expect(created.researcher).toBe('Marina Costa');
    expect(studies.findById(created.id, 'usr-researcher').id).toBe(created.id);
    const updated = studies.update(created.id, { ...payload, title: 'Título atualizado' }, 'usr-researcher');
    expect(updated.title).toBe('Título atualizado');
  });

  it.each([
    [{ ...payload, endDate: '2026-01-01' }, 'data de término'],
    [{ ...payload, startDate: '2026-02-30' }, 'datas válidas'],
    [{ ...payload, participantLimit: 0 }, 'limite de participantes'],
    [{ ...payload, participantsLinked: 100 }, 'não podem ultrapassar'],
  ])('rejeita regras inválidas', (input, message) => {
    expect(() => studies.create(input, 'usr-researcher')).toThrow(BadRequestException);
    try { studies.create(input, 'usr-researcher'); } catch (error) {
      expect((error as Error).message).toContain(message);
    }
  });

  it('diferencia estudos anteriores, atuais e futuros pelas datas', () => {
    expect(statusFor('2020-01-10', '2020-04-10')).toBe('Encerrado');
    expect(statusFor('2099-01-10', '2099-04-10')).toBe('Planejado');
    expect(statusFor('2020-01-10', '2099-04-10')).toBe('Em andamento');
    const past = studies.create({
      ...payload, startDate: '2020-01-10', endDate: '2020-04-10',
    }, 'usr-researcher');
    expect(past.status).toBe('Encerrado');
    expect(studies.findById(past.id, 'usr-researcher').status).toBe('Encerrado');
  });

  it('retorna mensagens de minimo de caracteres especificas', () => {
    expect(() => studies.create({ ...payload, title: 'Es' }, 'usr-researcher'))
      .toThrow('O título deve ter pelo menos 3 caracteres.');
    expect(() => studies.create({ ...payload, objective: 'dd' }, 'usr-researcher'))
      .toThrow('O objetivo deve ter pelo menos 8 caracteres.');
  });

  it('nega acesso a estudo de outro pesquisador', () => {
    const other = users.create({
      name: 'Outro Pesquisador', email: 'outro@example.test',
      phone: '(83) 99999-9999', password: 'Senha123!', role: 'Pesquisador',
    });
    expect(studies.listForResearcher(other.id)).toHaveLength(0);
    expect(() => studies.findById('study-1', other.id)).toThrow(ForbiddenException);
    expect(() => studies.update('study-1', payload, other.id)).toThrow(ForbiddenException);
    expect(() => studies.findById('not-found', 'usr-researcher')).toThrow(NotFoundException);
  });
});
