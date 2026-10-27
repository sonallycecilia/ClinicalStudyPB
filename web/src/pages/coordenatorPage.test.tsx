import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  CoordinatorCandidatesPage,
  CoordinatorDashboardPage,
  CoordinatorReportsPage,
  CoordinatorReschedulesPage,
  CoordinatorVisitsPage,
} from './coordenatorPage';

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

  it('cadastra candidato localmente e permite cancelar sem adicionar', () => {
    renderCoordinator(<CoordinatorCandidatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
    fireEvent.change(screen.getByPlaceholderText('Nome do candidato'), {
      target: { value: 'Candidato Local' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar candidato' }));
    expect(screen.getByText('Candidato Local')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
    fireEvent.change(screen.getByPlaceholderText('Nome do candidato'), {
      target: { value: 'Não cadastrado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('Não cadastrado')).toBeNull();
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
