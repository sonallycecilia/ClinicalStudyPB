import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { candidatesApi, type Candidate } from '../candidates/candidatesApi';
import {
  CoordinatorCandidatesPage,
  CoordinatorDashboardPage,
  CoordinatorReportsPage,
  CoordinatorReschedulesPage,
  CoordinatorVisitsPage,
} from './coordenatorPage';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ request: mockRequest }) }));

const studyOptions = [{ id: 'study-1', title: 'Estudo em recrutamento' }];
beforeEach(() => {
  vi.restoreAllMocks();
  mockRequest.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => studyOptions } as Response);
});

const candidateRows: Candidate[] = [
  { id: 'candidate-1', name: 'Lucas Martins', studyId: 'study-1', studyTitle: 'Estudo em recrutamento', enrollmentDate: '2026-10-16', status: 'Consentimento pendente' },
  { id: 'candidate-2', name: 'Mariana Alves', studyId: 'study-1', studyTitle: 'Estudo em recrutamento', enrollmentDate: '2026-10-20', status: 'Pendente de avaliação' },
  { id: 'candidate-3', name: 'Lucas Santos', studyId: 'study-2', studyTitle: 'Estudo em recrutamento', enrollmentDate: '2026-10-19', status: 'Consentimento pendente' },
  { id: 'candidate-4', name: 'Lucas Lima', studyId: 'study-1', studyTitle: 'Estudo em recrutamento', enrollmentDate: '2026-10-18', status: 'Pendente de avaliação' },
];

async function selectStudy(id = 'study-1') {
  const select = screen.getByRole('combobox', { name: 'Filtrar por estudo' }) as HTMLSelectElement;
  await waitFor(() => expect(Array.from(select.options).some((option) => option.value === id)).toBe(true));
  await act(async () => { fireEvent.change(select, { target: { value: id } }); });
}

function renderCoordinator(element: ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

afterEach(() => cleanup());

describe('CoordinatorDashboardPage', () => {
  it('pesquisa e filtra visitas, mostrando estado vazio sem resultados', () => {
    renderCoordinator(<CoordinatorDashboardPage />);
    expect(screen.getByRole('heading', { name: 'Coordenar Estudos Clínicos' })).toBeTruthy();
    const visitsPanel = screen.getByRole('heading', { name: 'Próximas visitas' }).closest('section') as HTMLElement;
    expect(within(visitsPanel).getAllByText('Bianca Oliveira')).toHaveLength(2);

    fireEvent.change(screen.getByPlaceholderText('Buscar participante...'), {
      target: { value: 'nome inexistente' },
    });
    expect(screen.getByText('Nenhuma visita encontrada para os filtros selecionados.')).toBeTruthy();
  });

  it('cria registro de visita e atualiza o status de uma visita existente', () => {
    renderCoordinator(<CoordinatorDashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo registro' }));
    fireEvent.change(screen.getByPlaceholderText('Nome do participante'), {
      target: { value: '  Pessoa Nova  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar visita' }));
    expect(screen.getByText('Pessoa Nova')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();

    const visitsPanel = screen.getByRole('heading', { name: 'Próximas visitas' }).closest('section') as HTMLElement;
    const row = within(visitsPanel).getAllByRole('row').find((item) =>
      item.textContent?.includes('Bianca Oliveira') && item.textContent.includes('24/10/2026 · 09:00'),
    )!;
    fireEvent.click(within(row).getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reagendar' }));
    expect(within(row).getByText('Reagendamento')).toBeTruthy();
  });
});

describe('CoordinatorCandidatesPage', () => {
  it('consulta por ID, exibe apenas candidatos do estudo e abre detalhes sem ações de alteração de status', async () => {
    const query = vi.spyOn(candidatesApi, 'listByStudy').mockResolvedValue(candidateRows);
    renderCoordinator(<CoordinatorCandidatesPage />);
    expect(query).not.toHaveBeenCalled();
    expect(screen.queryByText('Mariana Alves')).toBeNull();
    await selectStudy();
    await screen.findByText('Lucas Martins');
    expect(screen.getByText('Mariana Alves')).toBeTruthy();
    expect(screen.queryByText('Lucas Santos')).toBeNull();
    expect(query).toHaveBeenCalledWith(mockRequest, 'study-1', expect.any(AbortSignal));
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), {
      target: { value: 'Lucas Martins' },
    });
    expect(screen.getByText('Lucas Martins')).toBeTruthy();
    expect(screen.queryByText('Mariana Alves')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Detalhes do candidato' });
    expect(within(dialog).getByText('16/10/2026')).toBeTruthy();
    expect(within(dialog).getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Tornar ativo' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    const candidateRow = screen.getByRole('row', { name: /Lucas Martins/ });
    expect(within(candidateRow).getByText('Consentimento pendente')).toBeTruthy();
  });

  it('combina estudo, nome e status, distinguindo estudos com o mesmo título', async () => {
    mockRequest.mockResolvedValue({ ok: true, json: async () => [...studyOptions, { id: 'study-2', title: studyOptions[0].title }] } as Response);
    const query = vi.spyOn(candidatesApi, 'listByStudy').mockResolvedValue(candidateRows);
    renderCoordinator(<CoordinatorCandidatesPage />);
    await selectStudy();
    await screen.findByText('Mariana Alves');
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), { target: { value: ' LUCAS ' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por status' }), { target: { value: 'Consentimento pendente' } });
    expect(screen.getByText('Lucas Martins')).toBeTruthy();
    expect(screen.queryByText('Mariana Alves')).toBeNull();
    expect(screen.queryByText('Lucas Lima')).toBeNull();
    expect(screen.queryByText('Lucas Santos')).toBeNull();
    await selectStudy('study-2');
    await screen.findByText('Lucas Santos');
    expect(screen.queryByText('Lucas Martins')).toBeNull();
    expect(query).toHaveBeenLastCalledWith(mockRequest, 'study-2', expect.any(AbortSignal));
    expect(query).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('option', { name: 'Estudo em recrutamento (study-2)' })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), { target: { value: 'inexistente' } });
    expect(screen.getByText('Nenhum candidato encontrado para os filtros selecionados.')).toBeTruthy();
    expect(screen.queryByText('O estudo selecionado não possui candidatos cadastrados.')).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por estudo' }), { target: { value: '' } });
    expect(screen.queryByText('Lucas Santos')).toBeNull();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('exibe lista vazia somente após uma consulta bem-sucedida sem candidatos', async () => {
    vi.spyOn(candidatesApi, 'listByStudy').mockResolvedValue([]);
    renderCoordinator(<CoordinatorCandidatesPage />);
    expect(screen.queryByText('O estudo selecionado não possui candidatos cadastrados.')).toBeNull();
    await selectStudy();
    await screen.findByText('O estudo selecionado não possui candidatos cadastrados.');
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('mostra carregamento e apresenta o resultado ao concluir a consulta', async () => {
    let resolve!: (rows: readonly Candidate[]) => void;
    vi.spyOn(candidatesApi, 'listByStudy').mockReturnValue(new Promise((done) => { resolve = done; }));
    renderCoordinator(<CoordinatorCandidatesPage />);
    await selectStudy();
    expect(screen.getByText('Consultando candidatos…')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Candidatos do estudo' }).getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByText('O estudo selecionado não possui candidatos cadastrados.')).toBeNull();
    await act(async () => resolve(candidateRows));
    expect(screen.getByText('Lucas Martins')).toBeTruthy();
    expect(screen.queryByText('Consultando candidatos…')).toBeNull();
  });

  it('mostra erro sem lista vazia e permite tentar novamente no mesmo estudo', async () => {
    const query = vi.spyOn(candidatesApi, 'listByStudy')
      .mockRejectedValueOnce(new Error('Falha de conexão'))
      .mockResolvedValueOnce(candidateRows);
    renderCoordinator(<CoordinatorCandidatesPage />);
    await selectStudy();
    await screen.findByText('Não foi possível consultar os candidatos deste estudo. Tente novamente.');
    expect(screen.queryByText('O estudo selecionado não possui candidatos cadastrados.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('Lucas Martins');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenLastCalledWith(mockRequest, 'study-1', expect.any(AbortSignal));
  });

  it('informa a API indisponível sem dados fictícios, contagens ou mensagem de lista vazia', async () => {
    renderCoordinator(<CoordinatorCandidatesPage />);
    await selectStudy();
    await screen.findByText('A consulta de candidatos por estudo ainda não está disponível. Não é possível verificar os candidatos cadastrados.');
    expect(screen.queryByText('O estudo selecionado não possui candidatos cadastrados.')).toBeNull();
    expect(screen.queryByText('Mariana Alves')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Indicadores' })).toBeNull();
    expect(mockRequest).toHaveBeenCalledOnce();
    expect(mockRequest).toHaveBeenCalledWith('/studies/disponiveis-recrutamento', { signal: expect.any(AbortSignal) });
    expect(screen.getByText(/A seleção exibe apenas estudos em recrutamento/)).toBeTruthy();
  });

  it.each(['sucesso', 'erro'])('ignora %s tardio da consulta anterior ao trocar estudo', async (outcome) => {
    mockRequest.mockResolvedValue({ ok: true, json: async () => [...studyOptions, { id: 'study-2', title: 'Outro estudo' }] } as Response);
    let resolve!: (rows: readonly Candidate[]) => void;
    let reject!: (error: Error) => void;
    const query = vi.spyOn(candidatesApi, 'listByStudy')
      .mockReturnValueOnce(new Promise((done, fail) => { resolve = done; reject = fail; }))
      .mockResolvedValueOnce(candidateRows);
    renderCoordinator(<CoordinatorCandidatesPage />);
    await selectStudy();
    const signal = query.mock.calls[0][2]!;
    await selectStudy('study-2');
    await screen.findByText('Lucas Santos');
    expect(signal.aborted).toBe(true);
    await act(async () => {
      if (outcome === 'sucesso') resolve(candidateRows);
      else reject(new Error('Resposta antiga'));
    });
    expect(screen.getByText('Lucas Santos')).toBeTruthy();
    expect(screen.queryByText('Lucas Martins')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('permite recarregar os estudos após falha sem consultar candidatos', async () => {
    const query = vi.spyOn(candidatesApi, 'listByStudy');
    mockRequest.mockRejectedValueOnce(new Error('Falha'));
    renderCoordinator(<CoordinatorCandidatesPage />);
    await screen.findByText('Não foi possível carregar os estudos.');
    expect((screen.getByRole('combobox', { name: 'Filtrar por estudo' }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar estudos' }));
    await screen.findByRole('option', { name: 'Estudo em recrutamento' });
    expect(query).not.toHaveBeenCalled();
  });

  it('não confunde ausência de estudos em recrutamento com ausência de candidatos', async () => {
    mockRequest.mockResolvedValue({ ok: true, json: async () => [] } as Response);
    renderCoordinator(<CoordinatorCandidatesPage />);
    await screen.findByText('Nenhum estudo em recrutamento disponível para seleção. Não foi possível consultar candidatos.');
    expect(screen.queryByText('O estudo selecionado não possui candidatos cadastrados.')).toBeNull();
  });

  it('abre o formulário compartilhado e consulta os estudos do cadastro somente ao abrir o modal', async () => {
    renderCoordinator(<CoordinatorCandidatesPage />);
    await screen.findByRole('option', { name: 'Estudo em recrutamento' });
    expect(mockRequest).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
    const dialog = screen.getByRole('dialog', { name: 'Cadastrar candidato' });
    expect(within(dialog).getByRole('form', { name: 'Cadastro de candidato' })).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Fechar' }));
    await within(dialog).findByRole('option', { name: 'Estudo em recrutamento' });
    const study = within(dialog).getByLabelText(/^Estudo/) as HTMLSelectElement;
    fireEvent.change(study, { target: { value: 'study-1' } });
    expect(study.value).toBe('study-1');
    expect(study.required).toBe(true);
    expect((within(dialog).getByRole('button', { name: 'Cadastrar candidato' }) as HTMLButtonElement).disabled).toBe(true);
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest).toHaveBeenCalledWith('/studies/disponiveis-recrutamento', { signal: expect.any(AbortSignal) });
  });

  it('preserva as validações de nome e e-mail dentro do modal', async () => {
    renderCoordinator(<CoordinatorCandidatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
    const dialog = screen.getByRole('dialog', { name: 'Cadastrar candidato' });
    await within(dialog).findByRole('option', { name: 'Estudo em recrutamento' });
    const name = within(dialog).getByLabelText(/Nome completo/) as HTMLInputElement;
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.blur(name);
    expect(within(dialog).getByText('Informe o nome completo do candidato.')).toBeTruthy();
    const email = within(dialog).getByLabelText('E-mail (opcional)') as HTMLInputElement;
    fireEvent.change(email, { target: { value: 'invalido' } });
    fireEvent.blur(email);
    expect(within(dialog).getByText('Informe um e-mail válido com até 254 caracteres.')).toBeTruthy();
    expect(name.value).toBe('   ');
    expect(email.value).toBe('invalido');
  });

  it('abre e reabre o modal sem erros em campos intocados no modo de desenvolvimento', async () => {
    mockRequest.mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response);
    render(<StrictMode><MemoryRouter><CoordinatorCandidatesPage /></MemoryRouter></StrictMode>);
    const trigger = screen.getByRole('button', { name: 'Novo candidato' });
    trigger.focus();
    for (let attempt = 0; attempt < 2; attempt++) {
      fireEvent.click(trigger);
      const dialog = screen.getByRole('dialog', { name: 'Cadastrar candidato' });
      expect(within(dialog).queryByRole('alert')).toBeNull();
      await within(dialog).findByText('Nenhum estudo disponível para associação.');
      expect(within(dialog).queryByRole('alert')).toBeNull();
      expect(within(dialog).getByLabelText(/Nome completo/).getAttribute('aria-invalid')).toBe('false');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
      expect(document.activeElement).toBe(trigger);
    }
  });

  it('cancela sem adicionar candidato e preserva os filtros da listagem', async () => {
    vi.spyOn(candidatesApi, 'listByStudy').mockResolvedValue(candidateRows);
    renderCoordinator(<CoordinatorCandidatesPage />);
    await selectStudy();
    await screen.findByText('Lucas Martins');
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), { target: { value: 'Lucas Martins' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por status' }), { target: { value: 'Consentimento pendente' } });
    const trigger = screen.getByRole('button', { name: 'Novo candidato' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Pessoa não salva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Pessoa não salva')).toBeNull();
    expect((screen.getByPlaceholderText('Buscar por nome...') as HTMLInputElement).value).toBe('Lucas Martins');
    expect((screen.getByRole('combobox', { name: 'Filtrar por estudo' }) as HTMLSelectElement).value).toBe('study-1');
    expect((screen.getByRole('combobox', { name: 'Filtrar por status' }) as HTMLSelectElement).value).toBe('Consentimento pendente');
    expect(screen.getByText('Lucas Martins')).toBeTruthy();
    expect(document.activeElement).toBe(trigger);
    expect((mockRequest.mock.calls[1][1] as RequestInit).signal?.aborted).toBe(true);
    fireEvent.click(trigger);
    expect((screen.getByLabelText(/Nome completo/) as HTMLInputElement).value).toBe('');
    expect(mockRequest).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('mantém Tab dentro do modal e fecha com Escape, devolvendo o foco', async () => {
    renderCoordinator(<CoordinatorCandidatesPage />);
    await screen.findByRole('option', { name: 'Estudo em recrutamento' });
    const trigger = screen.getByRole('button', { name: 'Novo candidato' });
    trigger.focus();
    fireEvent.click(trigger);
    const close = screen.getByRole('button', { name: 'Fechar' });
    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    act(() => cancel.focus());
    fireEvent.keyDown(cancel, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it.each(['botão', 'fundo'])('fecha o modal pelo %s sem salvar', async (method) => {
    renderCoordinator(<CoordinatorCandidatesPage />);
    await screen.findByRole('option', { name: 'Estudo em recrutamento' });
    fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
    const dialog = screen.getByRole('dialog', { name: 'Cadastrar candidato' });
    if (method === 'botão') fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    else fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(['vazio', 'erro'])('reutiliza o estado de consulta de estudos no modal: %s', async (state) => {
    if (state === 'vazio') mockRequest.mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response);
    else mockRequest.mockRejectedValue(new Error('Falha de conexão'));
    renderCoordinator(<CoordinatorCandidatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
    await screen.findByText(state === 'vazio'
      ? 'Nenhum estudo disponível para associação.'
      : 'Não foi possível carregar os estudos. Tente novamente mais tarde.');
    expect((screen.getByLabelText(/^Estudo/) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cadastrar candidato' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('CoordinatorVisitsPage', () => {
  it('agenda visita local e permite atualizar seu status', () => {
    renderCoordinator(<CoordinatorVisitsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Agendar visita' }));
    const dialog = screen.getByRole('dialog', { name: 'Agendar visita' });
    fireEvent.change(screen.getByPlaceholderText('Nome do participante'), {
      target: { value: 'Participante Agendado' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Agendar visita' }));
    expect(screen.getByText('Participante Agendado')).toBeTruthy();

    const row = screen.getByRole('row', { name: /Participante Agendado/ });
    fireEvent.click(within(row).getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(within(row).getByText('Concluída')).toBeTruthy();
  });
});

describe('CoordinatorReschedulesPage', () => {
  it('filtra solicitações e aprova uma após abrir análise', () => {
    renderCoordinator(<CoordinatorReschedulesPage />);
    fireEvent.change(screen.getByPlaceholderText('Buscar participante...'), {
      target: { value: 'Bianca Oliveira' },
    });
    expect(screen.getByText('Bianca Oliveira')).toBeTruthy();
    expect(screen.queryByText('João Pedro')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Analisar' }));
    expect(screen.getByRole('dialog', { name: 'Analisar reagendamento' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar solicitação' }));
    const approvedRow = screen.getByRole('row', { name: /Bianca Oliveira/ });
    expect(within(approvedRow).getByText('Aprovada')).toBeTruthy();
  });

  it('registra solicitação de reagendamento em estado pendente', () => {
    renderCoordinator(<CoordinatorReschedulesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar solicitação' }));
    const dialog = screen.getByRole('dialog', { name: 'Registrar solicitação' });
    fireEvent.change(screen.getByPlaceholderText('Nome do participante'), {
      target: { value: 'Nova Solicitação' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar solicitação' }));

    const newRow = screen.getByRole('row', { name: /Nova Solicitação/ });
    expect(within(newRow).getByText('Pendente')).toBeTruthy();
  });
});

describe('CoordinatorReportsPage', () => {
  it('apresenta os relatórios disponíveis e dispara a exportação CSV', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderCoordinator(<CoordinatorReportsPage />);

    expect(screen.getByRole('heading', { name: 'Relatórios' })).toBeTruthy();
    expect(screen.getByText('Resumo dos estudos')).toBeTruthy();
    expect(screen.getByText('Histórico de visitas')).toBeTruthy();
    expect(screen.getByText('Participantes e elegibilidade')).toBeTruthy();
    const candidateReport = screen.getByText('Participantes e elegibilidade').closest('.coord-report-row') as HTMLElement;
    expect((within(candidateReport).getByRole('button', { name: 'Gerar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(candidateReport).getByText('Relatório indisponível enquanto a consulta de candidatos não estiver integrada.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Exportar relatório' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
