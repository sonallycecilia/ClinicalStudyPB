import { CalendarDays, Check, Tag, UserRound } from 'lucide-react';
import type { Participant } from './participantsApi';

export function formatIncludedAt(value: string): string {
  return value.slice(0, 10).split('-').reverse().join('/');
}

/**
 * Resumo reutilizável do participante. Exibe só o essencial (nome, situação, data de inclusão)
 * e, quando recebe onSelect, permite escolhê-lo nos fluxos de acompanhamento.
 */
export function ParticipantSummary({ participant, studyTitle, selected = false, onSelect }: {
  participant: Participant;
  studyTitle?: string;
  selected?: boolean;
  onSelect?: (participant: Participant) => void;
}) {
  return <article className={`participant-summary${selected ? ' participant-summary-selected' : ''}`} aria-label={`Resumo do participante ${participant.name}`}>
    <div className="participant-summary-identity">
      <span className="eligibility-candidate-icon"><UserRound size={18} aria-hidden="true" /></span>
      <strong>{participant.name}</strong>
    </div>
    <dl className="participant-summary-details">
      {studyTitle && <div><dt>Estudo</dt><dd>{studyTitle}</dd></div>}
      <div><dt><Tag size={13} aria-hidden="true" />Situação</dt><dd>{participant.status}</dd></div>
      <div><dt><CalendarDays size={13} aria-hidden="true" />Inclusão</dt><dd><time dateTime={participant.includedAt.slice(0, 10)}>{formatIncludedAt(participant.includedAt)}</time></dd></div>
    </dl>
    {onSelect && <button type="button" className={`button ${selected ? 'button-primary' : 'button-outline'} participant-summary-action`}
      aria-pressed={selected} aria-label={`${selected ? 'Participante selecionado' : 'Selecionar participante'}: ${participant.name}`}
      onClick={() => onSelect(participant)}>{selected && <Check size={14} aria-hidden="true" />}{selected ? 'Selecionado' : 'Selecionar'}</button>}
  </article>;
}
