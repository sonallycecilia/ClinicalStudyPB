import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { participantsApi, ParticipantsApiError, type Participant } from './participantsApi';
import { todayInSaoPaulo } from './apiErrors';
import { formatIncludedAt } from './ParticipantSummary';

/** Retirada do participante (POST …/participants/:id/withdrawal). Só aparece como ação para participação ativa em estudo em andamento. */
export function WithdrawalPanel({ participant, writable, onWithdrawn }: { participant: Participant; writable: boolean; onWithdrawn: (participant: Participant) => void }) {
  const { request } = useAuth();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => todayInSaoPaulo());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const today = todayInSaoPaulo();

  if (participant.status === 'Retirado') {
    return <section className="participant-withdrawal" aria-label="Retirada do participante">
      <p role="status">Participação retirada{participant.withdrawnAt ? ` em ${formatIncludedAt(participant.withdrawnAt)}` : ''}.</p>
      {participant.withdrawalReason && <p className="coord-help-copy">Motivo: {participant.withdrawalReason}</p>}
    </section>;
  }
  if (participant.status !== 'Ativo') return null;
  if (!writable) return <section className="participant-withdrawal" aria-label="Retirada do participante"><p role="status" className="coord-help-copy">Estudo encerrado: a retirada não está disponível.</p></section>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!reason.trim()) return setError('Informe o motivo da retirada.');
    if (date < participant.includedAt || date > today) return setError('A data de retirada deve estar entre a data de inclusão e hoje.');
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      const updated = await participantsApi.registerWithdrawal(request, participant.studyId, participant.participationId, { withdrawalDate: date, reason });
      setOpen(false);
      setReason('');
      onWithdrawn(updated);
    } catch (reasonError) {
      setError(reasonError instanceof ParticipantsApiError ? reasonError.message : 'Não foi possível registrar a retirada. Consulte o participante antes de tentar novamente.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  if (!open) return <section className="participant-withdrawal" aria-label="Retirada do participante">
    <button type="button" className="button button-outline" onClick={() => setOpen(true)}>Registrar retirada</button>
  </section>;
  return <section className="participant-withdrawal" aria-label="Retirada do participante">
    <form className="coord-form" aria-label="Registrar retirada" aria-busy={saving} onSubmit={(event) => void submit(event)}>
      <label className="study-field coord-field"><span>Data da retirada</span>
        <input type="date" required value={date} min={participant.includedAt} max={today} onChange={(event) => setDate(event.target.value)} /></label>
      <label className="study-field coord-field coord-field-wide"><span>Motivo da retirada</span>
        <textarea required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <p className="coord-help-copy">A retirada altera apenas a participação. Visitas e resultados já registrados são preservados.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="modal-actions coord-modal-actions">
        <button type="button" className="button button-outline" disabled={saving} onClick={() => { setOpen(false); setError(''); }}>Cancelar</button>
        <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Registrando…' : 'Confirmar retirada'}</button>
      </div>
    </form>
  </section>;
}
