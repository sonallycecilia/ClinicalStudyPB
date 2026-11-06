import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
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
  mockRequest.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => studyOptions } as Response);
});

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
  it('filtra candidatos e altera a situação pelo diálogo de detalhes', () => {
    renderCoordinator(<CoordinatorCandidatesPage />);
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), {
      target: { value: 'Lucas Martins' },
    });
    expect(screen.getByText('Lucas Martins')).toBeTruthy();
    expect(screen.queryByText('Mariana Alves')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('dialog', { name: 'Detalhes do candidato' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tornar ativo' }));
    const candidateRow = screen.getByRole('row', { name: /Lucas Martins/ });
    expect(within(candidateRow).getByText('Participante ativo')).toBeTruthy();
  });

  it('abre o formulário compartilhado em um modal e consulta os estudos somente ao abrir', async () => {
    renderCoordinator(<CoordinatorCandidatesPage />);
    expect(mockRequest).not.toHaveBeenCalled();
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
    expect(mockRequest).toHaveBeenCalledOnce();
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

  it('cancela sem adicionar candidato e preserva os filtros da listagem', () => {
    renderCoordinator(<CoordinatorCandidatesPage />);
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), { target: { value: 'Lucas Martins' } });
    const trigger = screen.getByRole('button', { name: 'Novo candidato' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Pessoa não salva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Pessoa não salva')).toBeNull();
    expect((screen.getByPlaceholderText('Buscar por nome...') as HTMLInputElement).value).toBe('Lucas Martins');
    expect(screen.getByText('Lucas Martins')).toBeTruthy();
    expect(document.activeElement).toBe(trigger);
    expect((mockRequest.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
    fireEvent.click(trigger);
    expect((screen.getByLabelText(/Nome completo/) as HTMLInputElement).value).toBe('');
    expect(mockRequest).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('mantém Tab dentro do modal e fecha com Escape, devolvendo o foco', () => {
    renderCoordinator(<CoordinatorCandidatesPage />);
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

  it.each(['botão', 'fundo'])('fecha o modal pelo %s sem salvar', (method) => {
    renderCoordinator(<CoordinatorCandidatesPage />);
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

    fireEvent.click(screen.getByRole('button', { name: 'Exportar relatório' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
