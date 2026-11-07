import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CandidateInclusionForm } from './CandidateInclusionForm';
import { candidatesApi, INCLUSION_UNAVAILABLE_MESSAGE, INVALID_INCLUSION_MESSAGE, type CandidateInclusion } from './candidatesApi';

const candidate = { id: 'candidate-1', name: 'Candidato de teste', studyId: 'study-1', studyTitle: 'Estudo de teste' };
const inclusion: CandidateInclusion = {
  participationId: 'participation-1', candidateId: candidate.id, studyId: candidate.studyId,
  includedAt: '2026-11-07', participationStatus: 'Ativo', participantsLinked: 3, participantLimit: 5,
};
const success = 'Candidato incluído como participante com sucesso';
const confirm = () => screen.getByRole('button', { name: 'Confirmar inclusão' }) as HTMLButtonElement;

afterEach(cleanup);

describe('CandidateInclusionForm', () => {
  it('exibe contexto e requisitos; bloqueia a confirmação sem integração e permite cancelar', () => {
    const onCancel = vi.fn();
    render(<CandidateInclusionForm candidate={candidate} onCancel={onCancel} />);
    expect(screen.getByText(candidate.name)).toBeTruthy();
    expect(screen.getByText(candidate.studyTitle)).toBeTruthy();
    expect(screen.getByText(/elegibilidade aprovada, consentimento simulado concedido e disponibilidade de vagas/)).toBeTruthy();
    expect(screen.getByText(INCLUSION_UNAVAILABLE_MESSAGE)).toBeTruthy();
    expect(confirm().disabled).toBe(true);
    expect(document.getElementById(confirm().getAttribute('aria-describedby')!)?.textContent).toBe(INCLUSION_UNAVAILABLE_MESSAGE);
    fireEvent.click(confirm());
    fireEvent.submit(screen.getByRole('form'));
    expect(screen.queryByText(success)).toBeNull();
    expect(screen.queryByText('Ativo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('aguarda a resposta persistida, bloqueia envio duplicado e mostra somente os dados retornados', async () => {
    let resolve!: (result: CandidateInclusion) => void;
    const onInclude = vi.fn(() => new Promise<CandidateInclusion>((done) => { resolve = done; }));
    const onCancel = vi.fn();
    render(<CandidateInclusionForm candidate={candidate} onCancel={onCancel} onInclude={onInclude} />);
    expect(onInclude).not.toHaveBeenCalled();
    fireEvent.click(confirm());
    fireEvent.click(confirm());
    fireEvent.submit(screen.getByRole('form'));
    expect(onInclude).toHaveBeenCalledExactlyOnceWith(candidate.studyId, candidate.id);
    expect(screen.getByRole('form').getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Incluindo participante…');
    expect(confirm().disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(success)).toBeNull();
    await act(async () => resolve(inclusion));
    expect(screen.getByText(success)).toBeTruthy();
    expect(screen.getByText('Ativo')).toBeTruthy();
    expect(screen.getByText('3 / 5')).toBeTruthy();
    expect(screen.getByText('07/11/2026').getAttribute('datetime')).toBe(inclusion.includedAt);
    expect(screen.getByRole('form').getAttribute('aria-busy')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Confirmar inclusão' })).toBeNull();
    fireEvent.submit(screen.getByRole('form'));
    expect(onInclude).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar aos detalhes' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it.each([
    [400, 'Candidato inelegível: avalie e aprove todos os critérios antes da inclusão.', 'Candidato inelegível: avalie e aprove todos os critérios antes da inclusão.'],
    [400, 'Candidato inelegível: todos os critérios ativos devem estar avaliados e atendidos.', 'Candidato inelegível: todos os critérios ativos devem estar avaliados e atendidos.'],
    [400, 'Consentimento ausente ou não concedido: registre o consentimento antes da inclusão.', 'Consentimento ausente ou não concedido: registre o consentimento antes da inclusão.'],
    [400, 'Limite de vagas atingido: não há vagas disponíveis neste estudo.', 'Limite de vagas atingido: não há vagas disponíveis neste estudo.'],
    [400, 'O candidato já foi incluído neste estudo.', 'O candidato já foi incluído neste estudo.'],
    [400, 'Não é possível incluir participantes em um estudo encerrado.', 'Não é possível incluir participantes em um estudo encerrado.'],
    [404, 'Candidato não encontrado neste estudo.', 'Candidato ou estudo não encontrado.'],
    [404, 'Estudo não encontrado.', 'Candidato ou estudo não encontrado.'],
    [401, 'Unauthorized', 'Sua sessão expirou ou não está autorizada.'],
    [403, 'Forbidden resource', 'Você não tem permissão para incluir participantes neste estudo.'],
    [500, 'Internal server error', 'Não foi possível confirmar a inclusão no servidor.'],
  ])('apresenta recusa real da API (%s: %s) sem sucesso', async (status, message, expected) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ statusCode: status, message, error: 'Error' }), { status }));
    const onInclude = (studyId: string, candidateId: string) => candidatesApi.include(request, studyId, candidateId);
    render(<CandidateInclusionForm candidate={candidate} onCancel={vi.fn()} onInclude={onInclude} />);
    fireEvent.click(confirm());
    expect((await screen.findByRole('alert')).textContent).toContain(expected);
    if (status === 400) {
      expect(screen.getByRole('alert').textContent).toContain('Consulte a avaliação de elegibilidade');
      expect(screen.getByRole('alert').textContent).toContain('consentimento simulado');
    }
    expect(screen.queryByText(success)).toBeNull();
    expect(screen.queryByText('Ativo')).toBeNull();
    expect(confirm().disabled).toBe(false);
  });

  it('trata falha de comunicação e limpa o erro em uma nova tentativa confirmada', async () => {
    const request = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify(inclusion), { status: 201 }));
    const onInclude = (studyId: string, candidateId: string) => candidatesApi.include(request, studyId, candidateId);
    render(<CandidateInclusionForm candidate={candidate} onCancel={vi.fn()} onInclude={onInclude} />);
    fireEvent.click(confirm());
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível comunicar com o servidor.');
    expect(screen.queryByText(success)).toBeNull();
    fireEvent.click(confirm());
    expect(await screen.findByText(success)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([undefined, { ...inclusion, candidateId: 'outro' }, { ...inclusion, studyId: 'outro' }, { ...inclusion, participantsLinked: undefined }])('recusa resposta inválida da função injetada: %j', async (response) => {
    const onInclude = vi.fn().mockResolvedValue(response);
    render(<CandidateInclusionForm candidate={candidate} onCancel={vi.fn()} onInclude={onInclude} />);
    fireEvent.click(confirm());
    expect((await screen.findByRole('alert')).textContent).toBe(INVALID_INCLUSION_MESSAGE);
    expect(screen.queryByText(success)).toBeNull();
    expect(screen.queryByText('Ativo')).toBeNull();
  });

  it('não exibe detalhes técnicos de uma falha inesperada na integração', async () => {
    render(<CandidateInclusionForm candidate={candidate} onCancel={vi.fn()} onInclude={vi.fn().mockRejectedValue(new Error('technical detail'))} />);
    fireEvent.click(confirm());
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível confirmar a inclusão.');
    expect(screen.queryByText(/technical detail/)).toBeNull();
    expect(screen.queryByText(success)).toBeNull();
  });
});
