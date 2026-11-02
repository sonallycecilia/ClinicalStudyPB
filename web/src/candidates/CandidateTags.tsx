import { UserRound, X } from 'lucide-react';

export interface CandidateTag {
  id: string;
  name: string;
}

/** Para a consulta por estudo em S2-W2-06. Remoção só aparece com uma ação autorizada. */
export function CandidateTags({ candidates, onRemove }: { candidates: readonly CandidateTag[]; onRemove?: (candidate: CandidateTag) => void }) {
  const unique = candidates.filter((candidate, index) => candidates.findIndex((item) => item.id === candidate.id) === index);
  return <ul className="candidate-tags" aria-label="Candidatos vinculados">
    {unique.slice(0, 9).map((candidate) => <li key={candidate.id}>
      <UserRound size={14} aria-hidden="true" /><span>{candidate.name}</span>
      {onRemove && <button type="button" className="icon-button" aria-label={`Remover vínculo de ${candidate.name}`} onClick={() => onRemove(candidate)}><X size={13} aria-hidden="true" /></button>}
    </li>)}
    {unique.length > 9 && <li aria-label={`${unique.length - 9} outros candidatos`}>+{unique.length - 9}</li>}
  </ul>;
}
