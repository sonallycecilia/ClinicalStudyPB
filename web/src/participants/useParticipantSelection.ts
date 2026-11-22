import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Estudo e participação selecionados ficam na URL (studyId, participationId), preservando
 * a escolha ao recarregar e ao navegar entre agendamento, histórico e retirada.
 * Trocar de estudo sempre descarta a participação anterior.
 */
export function useParticipantSelection() {
  const [params, setParams] = useSearchParams();
  const studyId = params.get('studyId') ?? '';
  const participationId = studyId ? params.get('participationId') ?? '' : '';

  const update = useCallback((next: { studyId?: string; participationId?: string }) => {
    setParams((current) => {
      const copy = new URLSearchParams(current);
      for (const [key, value] of Object.entries(next)) {
        if (value) copy.set(key, value); else copy.delete(key);
      }
      return copy;
    });
  }, [setParams]);

  return {
    studyId, participationId,
    selectStudy: useCallback((id: string) => update({ studyId: id, participationId: '' }), [update]),
    selectParticipation: useCallback((id: string) => update({ participationId: id }), [update]),
    clearParticipation: useCallback(() => update({ participationId: '' }), [update]),
  };
}
