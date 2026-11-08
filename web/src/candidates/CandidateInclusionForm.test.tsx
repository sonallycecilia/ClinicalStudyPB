import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CandidateInclusionForm } from './CandidateInclusionForm';
import { candidatesApi, INCLUSION_UNAVAILABLE_MESSAGE, INVALID_INCLUSION_MESSAGE, type CandidateInclusion } from './candidatesApi';

const candidate = { id: 'candidate-1', name: 'Candidato de teste', studyId: 'study-1', studyTitle: 'Estudo de teste' };
const inclusion: CandidateInclusion = {
  participationId: 'participation-1', candidateId: candidate.id, studyId: candidate.studyId,
  includedAt: '2026-11-07', participationStatus: 'Ativo', participantsLinked: 3, participantLimit: 5,
};
const success = 'Participante incluído com sucesso!';
const confirm = () => screen.getByRole('button', { name: 'Confirmar inclusão' }) as HTMLButtonElement;

afterEach(cleanup);

describe('CandidateInclusionForm', () => {
  it('reutiliza identificação compacta sem textos explicativos; bloqueia sem integração e permite cancelar', () => {
    const onCancel = vi.fn();
    render(<CandidateInclusionForm candidate={candidate} onCancel={onCancel} />);
    expect(screen.getByText(candidate.name)).toBeTruthy();
    expect(screen.getByText(candidate.studyTitle)).toBeTruthy();
    const summary = screen.getByRole('region', { name: 'Resumo do candidato' });
    expect(within(summary).getByText(candidate.name)).toBeTruthy();
    expect(within(summary).getByText('Estudo de interesse')).toBeTruthy();
    expect(within(summary).getByText(candidate.studyTitle)).toBeTruthy();
    expect(within(summary).queryByText('Status atual')).toBeNull();
    expect(screen.queryByText(/A inclusão depende de elegibilidade aprovada/)).toBeNull();
    expect(screen.queryByText('Confirma a inclusão deste candidato como participante?')).toBeNull();
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
    const onBusyChange = vi.fn();
    render(<CandidateInclusionForm candidate={candidate} onCancel={onCancel} onInclude={onInclude} onBusyChange={onBusyChange} />);
    expect(onInclude).not.toHaveBeenCalled();
    fireEvent.click(confirm());
    fireEvent.click(confirm());
    fireEvent.submit(screen.getByRole('form'));
    expect(onInclude).toHaveBeenCalledExactlyOnceWith(candidate.studyId, candidate.id, expect.any(AbortSignal));
    expect(screen.getByRole('form').getAttribute('aria-busy')).toBe('true');
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
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
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('button', { name: 'Confirmar inclusão' })).toBeNull();
    fireEvent.submit(screen.getByRole('form'));
    expect(onInclude).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar aos detalhes' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it.each([
    [400, 'CANDIDATE_INELIGIBLE', 'O candidato não atende aos critérios de elegibilidade do estudo.'],
    [400, 'ELIGIBILITY_PENDING', 'A avaliação de elegibilidade do candidato ainda não foi concluída.'],
    [400, 'CONSENT_MISSING', 'O consentimento simulado do candidato ainda não foi registrado.'],
    [400, 'CONSENT_NOT_GRANTED', 'O candidato não possui consentimento válido para participar.'],
    [400, 'STUDY_FULL', 'O estudo não possui vagas disponíveis.'],
    [400, 'CANDIDATE_ALREADY_INCLUDED', 'Este candidato já foi incluído no estudo.'],
    [400, undefined, 'Não foi possível concluir a inclusão. Tente novamente.'],
    [400, 'UNKNOWN_CODE', 'Não foi possível concluir a inclusão. Tente novamente.'],
    [404, undefined, 'Estudo ou candidato não encontrado.'],
    [401, undefined, 'Sua sessão expirou ou não está autorizada.'],
    [403, undefined, 'Você não tem permissão para realizar esta inclusão.'],
    [500, undefined, 'Não foi possível concluir a inclusão. Tente novamente.'],
  ])('apresenta um único aviso por recusa (%s: %s) sem sucesso', async (status, code, expected) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ statusCode: status, code, message: 'Texto técnico alterado no servidor.', error: 'Error' }), { status }));
    const onInclude = (studyId: string, candidateId: string) => candidatesApi.include(request, studyId, candidateId);
    render(<CandidateInclusionForm candidate={candidate} onCancel={vi.fn()} onInclude={onInclude} />);
    fireEvent.click(confirm());
    const alert = await screen.findByRole('alert');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(within(alert).getByRole('heading', { name: 'Não foi possível incluir o participante' })).toBeTruthy();
    expect(alert.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(alert.querySelectorAll('p')).toHaveLength(1);
    expect(alert.querySelector('p')?.textContent).toContain(expected);
    expect(screen.queryByText('Texto técnico alterado no servidor.')).toBeNull();
    expect(screen.queryByText(/Consulte a avaliação de elegibilidade, o consentimento/)).toBeNull();
    expect(screen.getByText(candidate.name)).toBeTruthy();
    expect(screen.getByText(candidate.studyTitle)).toBeTruthy();
    expect(screen.queryByText(success)).toBeNull();
    expect(screen.queryByText('Ativo')).toBeNull();
    expect(screen.getByRole('form').getAttribute('aria-busy')).toBe('false');
    expect(confirm().disabled).toBe(false);
  });

  it('trata falha de comunicação e limpa o erro em uma nova tentativa confirmada', async () => {
    const request = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify(inclusion), { status: 201 }));
    const onInclude = (studyId: string, candidateId: string) => candidatesApi.include(request, studyId, candidateId);
    render(<CandidateInclusionForm candidate={candidate} onCancel={vi.fn()} onInclude={onInclude} />);
    fireEvent.click(confirm());
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível concluir a inclusão. Tente novamente.');
    expect(screen.queryByText(success)).toBeNull();
    fireEvent.click(confirm());
    expect(await screen.findByText(success)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([undefined, { ...inclusion, candidateId: 'outro' }, { ...inclusion, studyId: 'outro' }, { ...inclusion, participantsLinked: undefined }])('recusa resposta inválida da função injetada: %j', async (response) => {
    const onInclude = vi.fn().mockResolvedValue(response);
    render(<CandidateInclusionForm candidate={candidate} onCancel={vi.fn()} onInclude={onInclude} />);
    fireEvent.click(confirm());
    expect(within(await screen.findByRole('alert')).getByText(INVALID_INCLUSION_MESSAGE)).toBeTruthy();
    expect(screen.queryByText(success)).toBeNull();
    expect(screen.queryByText('Ativo')).toBeNull();
  });

  it('não exibe detalhes técnicos de uma falha inesperada na integração', async () => {
    render(<CandidateInclusionForm candidate={candidate} onCancel={vi.fn()} onInclude={vi.fn().mockRejectedValue(new Error('technical detail'))} />);
    fireEvent.click(confirm());
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível concluir a inclusão. Tente novamente.');
    expect(screen.queryByText(/technical detail/)).toBeNull();
    expect(screen.queryByText(success)).toBeNull();
  });
});
