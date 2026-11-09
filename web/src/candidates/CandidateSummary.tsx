import type { ReactNode } from 'react';
import { CalendarDays, FlaskConical, Tag, UserRound } from 'lucide-react';
import type { Candidate } from './candidatesApi';

export function CandidateSummary({ candidate, status, statusLabel = 'Status atual', enrollmentDate }: {
  candidate: Pick<Candidate, 'name' | 'studyTitle'>;
  status?: ReactNode;
  statusLabel?: string;
  enrollmentDate?: string;
}) {
  return <section className="eligibility-candidate-summary" aria-label="Resumo do candidato">
    <div className="eligibility-candidate-identity">
      <span className="eligibility-candidate-icon"><UserRound size={21} aria-hidden="true" /></span>
      <strong>{candidate.name}</strong>
    </div>
    <dl className="eligibility-candidate-details">
      <div><dt><FlaskConical size={14} aria-hidden="true" />Estudo de interesse</dt><dd>{candidate.studyTitle}</dd></div>
      {enrollmentDate && <div><dt><CalendarDays size={14} aria-hidden="true" />Data de inscrição</dt><dd><time dateTime={enrollmentDate.slice(0, 10)}>{enrollmentDate.slice(0, 10).split('-').reverse().join('/')}</time></dd></div>}
      {status != null && <div><dt><Tag size={14} aria-hidden="true" />{statusLabel}</dt><dd>{status}</dd></div>}
    </dl>
  </section>;
}
