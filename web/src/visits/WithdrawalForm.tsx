import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { TriangleAlert, UserMinus } from 'lucide-react';
import {
  isWithdrawnParticipant, saoPauloToday, ScheduledVisitsApiError, WITHDRAWAL_INVALID_RESPONSE, WITHDRAWAL_UNEXPECTED_ERROR,
  type IncludedParticipant, type RegisterWithdrawalInput, type WithdrawalField,
} from './scheduledVisitsApi';

export interface WithdrawalFormProps {
  participant: IncludedParticipant;
  /** E08 — deve resolver somente com a participação atualizada pela API. */
  onWithdraw: (participant: IncludedParticipant, input: RegisterWithdrawalInput, signal: AbortSignal) => Promise<IncludedParticipant>;
  onWithdrawn: (participant: IncludedParticipant) => void;
  onCancel: () => void;
  /** Chamado quando a API informa que a participação já não está ativa ou não existe, para os dados serem recarregados. */
  onStale?: () => void;
  onBusyChange?: (busy: boolean) => void;
  /** Relógio injetável para os testes. */
  now?: () => Date;
}

type FieldErrors = Partial<Record<WithdrawalField, string>>;

const formatDay = (day: string) => day.split('-').reverse().join('/');
const isCivilDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

export function WithdrawalForm({ participant, onWithdraw, onWithdrawn, onCancel, onStale, onBusyChange, now = () => new Date() }: WithdrawalFormProps) {
  const prefix = useId();
  const today = saoPauloToday(now());
  const [withdrawalDate, setWithdrawalDate] = useState(() => (today >= participant.includedAt ? today : ''));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const lifecycle = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    return () => controller.abort();
  }, []);

  const id = (field: WithdrawalField) => `${prefix}-${field}`;
  const errorId = (field: WithdrawalField) => `${prefix}-${field}-error`;

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!withdrawalDate) next.withdrawalDate = 'Informe a data da retirada.';
    else if (!isCivilDate(withdrawalDate)) next.withdrawalDate = 'Informe uma data válida.';
    else if (withdrawalDate < participant.includedAt) next.withdrawalDate = `A data não pode ser anterior à inclusão do participante (${formatDay(participant.includedAt)}).`;
    else if (withdrawalDate > today) next.withdrawalDate = 'A data da retirada não pode ser futura.';
    if (!reason.trim()) next.reason = 'Informe o motivo da retirada.';
    return next;
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const fieldErrors = validate();
    setErrors(fieldErrors);
    setFormError(null);
    const first = (['withdrawalDate', 'reason'] as const).find((field) => fieldErrors[field]);
    if (first) {
      window.setTimeout(() => document.getElementById(id(first))?.focus());
      return;
    }
    setConfirming(true);
  }

  async function confirm() {
    if (submitting.current) return;
    const input: RegisterWithdrawalInput = { withdrawalDate, reason: reason.trim() };
    const signal = lifecycle.current!.signal;
    submitting.current = true;
    setSaving(true);
    setFormError(null);
    onBusyChange?.(true);
    let updated: IncludedParticipant | undefined;
    try {
      const response = await onWithdraw(participant, input, signal);
      if (signal.aborted) return;
      if (!isWithdrawnParticipant(response, participant, input)) throw new ScheduledVisitsApiError(WITHDRAWAL_INVALID_RESPONSE);
      updated = response;
    } catch (reason: unknown) {
      if (signal.aborted) return;
      // Os dados preenchidos são mantidos: o usuário volta ao formulário para corrigir ou tentar de novo.
      const error = reason instanceof ScheduledVisitsApiError ? reason : new ScheduledVisitsApiError(WITHDRAWAL_UNEXPECTED_ERROR);
      setFormError(error.message);
      setErrors(error.fieldErrors);
      setConfirming(false);
      if (error.code === 'PARTICIPATION_NOT_ACTIVE' || error.status === 404) onStale?.();
    } finally {
      submitting.current = false;
      if (!signal.aborted) {
        setSaving(false);
        onBusyChange?.(false);
      }
    }
    // A participação só aparece como retirada depois da confirmação da API.
    if (updated) onWithdrawn(updated);
  }

  const describedBy = (field: WithdrawalField, ...extra: string[]) =>
    [...extra, errors[field] && errorId(field)].filter(Boolean).join(' ') || undefined;
  const fieldError = (field: WithdrawalField) => errors[field]
    ? <small id={errorId(field)} className="study-field-error">{errors[field]}</small> : null;

  return <form className="withdrawal-form" aria-label={`Retirada de ${participant.name}`} aria-busy={saving} noValidate onSubmit={review}>
    <h4>Registrar retirada</h4>
    <p className="coord-help-copy">A participação passará para a situação Retirado. As visitas e os resultados já registrados são preservados no histórico.</p>

    <div className="study-field coord-field">
      <label htmlFor={id('withdrawalDate')}>Data da retirada</label>
      <input id={id('withdrawalDate')} type="date" value={withdrawalDate} min={participant.includedAt} max={today} disabled={saving || confirming}
        aria-invalid={Boolean(errors.withdrawalDate)} aria-describedby={describedBy('withdrawalDate', `${prefix}-date-hint`)}
        onChange={(event) => { setWithdrawalDate(event.target.value); setErrors(({ withdrawalDate: _removed, ...rest }) => rest); }} />
      <small id={`${prefix}-date-hint`} className="study-field-hint">Entre a inclusão ({formatDay(participant.includedAt)}) e hoje.</small>
      {fieldError('withdrawalDate')}
    </div>

    <div className="study-field coord-field coord-field-wide">
      <label htmlFor={id('reason')}>Motivo da retirada</label>
      <textarea id={id('reason')} rows={3} value={reason} disabled={saving || confirming} placeholder="Ex.: participante solicitou desligamento por motivos pessoais"
        aria-invalid={Boolean(errors.reason)} aria-describedby={describedBy('reason')}
        onChange={(event) => { setReason(event.target.value); setErrors(({ reason: _removed, ...rest }) => rest); }} />
      {fieldError('reason')}
    </div>

    {formError && <div role="alert" className="candidate-inclusion-error coord-field-wide">
      <TriangleAlert size={18} aria-hidden="true" />
      <div><h3>Não foi possível registrar a retirada</h3><p>{formError}</p></div>
    </div>}

    {confirming ? <div className="withdrawal-confirm coord-field-wide" role="group" aria-label="Confirmar retirada">
      <p><strong>Confirma a retirada de {participant.name} em {formatDay(withdrawalDate)}?</strong> Depois de confirmada, a participação não volta a ficar ativa e novas visitas não poderão ser agendadas.</p>
      {saving && <p className="coord-help-copy" role="status">Registrando retirada…</p>}
      <div className="modal-actions coord-modal-actions">
        <button type="button" className="button button-outline coord-secondary-button" disabled={saving} onClick={() => setConfirming(false)}>Voltar</button>
        <button type="button" className="button coord-danger-button" disabled={saving} onClick={() => void confirm()}><UserMinus size={13} aria-hidden="true" /> Confirmar retirada</button>
      </div>
    </div> : <div className="modal-actions coord-modal-actions">
      <button type="button" className="button button-outline coord-secondary-button" disabled={saving} onClick={onCancel}>Cancelar</button>
      <button type="submit" className="button coord-danger-button" disabled={saving}><UserMinus size={13} aria-hidden="true" /> Registrar retirada</button>
    </div>}
  </form>;
}
