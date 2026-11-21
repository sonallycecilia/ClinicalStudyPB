import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ParticipantSummary } from './ParticipantSummary';
import { ParticipantList } from './ParticipantList';
import type { Participant } from './participantsApi';

afterEach(cleanup);
const ana: Participant = { participationId: 'p1', candidateId: 'c1', studyId: 's1', name: 'Ana Silva', status: 'Ativo', includedAt: '2026-11-08', withdrawnAt: null, withdrawalReason: null };
const bruno: Participant = { ...ana, participationId: 'p2', candidateId: 'c2', name: 'Bruno Lima', status: 'Concluído' };

describe('ParticipantSummary', () => {
  it('mostra apenas nome, situação, data de inclusão e estudo', () => {
    render(<ParticipantSummary participant={ana} studyTitle="Sono" />);
    const card = screen.getByRole('article', { name: 'Resumo do participante Ana Silva' });
    expect(card.textContent).toContain('Ana Silva');
    expect(card.textContent).toContain('Sono');
    expect(card.textContent).toContain('Ativo');
    expect(card.textContent).toContain('08/11/2026');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('informa a participação escolhida ao selecionar e marca o estado selecionado', () => {
    const onSelect = vi.fn();
    const view = render(<ParticipantSummary participant={ana} onSelect={onSelect} />);
    const button = screen.getByRole('button', { name: 'Selecionar participante: Ana Silva' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith(ana);
    view.rerender(<ParticipantSummary participant={ana} selected onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: 'Participante selecionado: Ana Silva' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('ParticipantList — estados', () => {
  const noop = () => undefined;
  it('aguarda a escolha do estudo', () => {
    render(<ParticipantList state={{ status: 'idle' }} onRetry={noop} />);
    expect(screen.getByRole('status').textContent).toMatch(/Selecione um estudo/);
  });
  it('indica carregamento', () => {
    render(<ParticipantList state={{ status: 'loading' }} onRetry={noop} />);
    expect(screen.getByRole('status').textContent).toBe('Consultando participantes…');
  });
  it('indica lista vazia', () => {
    render(<ParticipantList state={{ status: 'ready', participants: [] }} onRetry={noop} />);
    expect(screen.getByRole('status').textContent).toBe('Nenhum participante incluído neste estudo.');
  });
  it('mostra falha com nova tentativa', () => {
    const onRetry = vi.fn();
    render(<ParticipantList state={{ status: 'error', message: 'Falhou.' }} onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain('Falhou.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
  it('lista os participantes e destaca o selecionado', () => {
    render(<ParticipantList state={{ status: 'ready', participants: [ana, bruno] }} selectedId="p2" onSelect={() => undefined} onRetry={noop} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Participante selecionado: Bruno Lima' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Selecionar participante: Ana Silva' })).toBeTruthy();
  });
});
