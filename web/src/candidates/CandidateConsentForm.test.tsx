import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CandidateConsentForm } from './CandidateConsentForm';
import { CONSENT_UNAVAILABLE_MESSAGE, type CandidateConsent } from './candidatesApi';

const candidate = { id: 'candidate-1', name: 'Candidato de teste', studyId: 'study-1', studyTitle: 'Estudo de teste' };
const unrecorded: CandidateConsent = {
  candidateId: candidate.id, studyId: candidate.studyId, status: null,
  termVersion: null, registeredAt: null, registrarId: null, observation: null,
};
const recorded: CandidateConsent = {
  ...unrecorded, status: 'Registrado', termVersion: 'versao-teste',
  registeredAt: '2026-11-07T15:30:00Z', registrarId: 'researcher-test',
};
const defaults = { candidate, onRetry: vi.fn(), onCancel: vi.fn() };

function fill() {
  fireEvent.click(screen.getByRole('radio', { name: 'Registrado' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Versão do termo simulado *' }), { target: { value: ' versao-teste ' } });
}

afterEach(cleanup);

describe('CandidateConsentForm', () => {
  it('exibe aviso, contexto e opções exatas sem inventar versão ou ausência de registro', () => {
    render(<CandidateConsentForm {...defaults} state={{ status: 'unavailable', message: CONSENT_UNAVAILABLE_MESSAGE }} />);
    expect(screen.getByText('Candidato de teste')).toBeTruthy();
    expect(screen.getByText('Estudo de teste')).toBeTruthy();
    expect(screen.getByText(/este registro é fictício e utilizado exclusivamente para fins educacionais/)).toBeTruthy();
    expect(screen.getByText('Não consultado')).toBeTruthy();
    expect(screen.queryByText('Não registrado')).toBeNull();
    expect(screen.getAllByRole('radio').map((radio) => (radio as HTMLInputElement).value)).toEqual(['Registrado', 'Recusado', 'Revogado']);
    for (const status of ['Registrado', 'Recusado', 'Revogado']) {
      const radio = screen.getByRole('radio', { name: status }) as HTMLInputElement;
      fireEvent.click(radio);
      expect(radio.checked).toBe(true);
    }
    expect((screen.getByRole('textbox', { name: 'Versão do termo simulado *' }) as HTMLInputElement).value).toBe('');
    expect((screen.getByRole('button', { name: 'Registrar consentimento' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(CONSENT_UNAVAILABLE_MESSAGE)).toBeTruthy();
  });

  it('valida campos obrigatórios, direciona o foco e confere sem confirmar gravação', () => {
    render(<CandidateConsentForm {...defaults} state={{ status: 'ready', consent: unrecorded }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conferir preenchimento' }));
    expect(screen.getByText('Selecione o resultado do consentimento.')).toBeTruthy();
    expect(screen.getByText('Informe a versão do termo simulado.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Registrado' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Versão do termo simulado *' }), { target: { value: '   ' } });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Versão do termo simulado *' }));
    expect(screen.getByText('Informe a versão do termo simulado.')).toBeTruthy();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Conferir preenchimento' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Preenchimento conferido. O consentimento não foi salvo.')).toBeTruthy();
    expect(screen.getByText('Não registrado')).toBeTruthy();
    expect(screen.queryByText('Consentimento simulado registrado com sucesso.')).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Observações (opcional)' }), { target: { value: 'Nota de teste' } });
    expect(screen.queryByText('Preenchimento conferido. O consentimento não foi salvo.')).toBeNull();
  });

  it('limita versão e observações e valida os limites inclusive em valores programáticos', () => {
    render(<CandidateConsentForm {...defaults} state={{ status: 'ready', consent: unrecorded }} />);
    const version = screen.getByRole('textbox', { name: 'Versão do termo simulado *' }) as HTMLInputElement;
    const observation = screen.getByRole('textbox', { name: 'Observações (opcional)' }) as HTMLTextAreaElement;
    expect(version.maxLength).toBe(50);
    expect(observation.maxLength).toBe(2000);
    fireEvent.change(version, { target: { value: 'a'.repeat(51) } });
    fireEvent.blur(version);
    fireEvent.change(observation, { target: { value: 'a'.repeat(2001) } });
    fireEvent.blur(observation);
    expect(screen.getByText('A versão deve ter no máximo 50 caracteres.')).toBeTruthy();
    expect(screen.getByText('A observação deve ter no máximo 2.000 caracteres.')).toBeTruthy();
    expect(observation.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(version, { target: { value: 'a'.repeat(50) } });
    fireEvent.change(observation, { target: { value: 'a'.repeat(2000) } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('2000/2.000 caracteres')).toBeTruthy();
  });

  it.each([null, 'Registrado', 'Recusado', 'Revogado'] as const)('apresenta estado confirmado %s e metadados disponíveis', (status) => {
    render(<CandidateConsentForm {...defaults} state={{ status: 'ready', consent: status ? { ...recorded, status } : unrecorded }} />);
    expect(screen.getByText(status ?? 'Não registrado', { selector: 'strong' })).toBeTruthy();
    if (status) {
      expect(screen.getByText('researcher-test')).toBeTruthy();
      expect(screen.getByText('versao-teste')).toBeTruthy();
      expect(document.querySelector('time')?.getAttribute('datetime')).toBe(recorded.registeredAt);
      expect(screen.queryByText('Não registrado')).toBeNull();
    } else {
      expect(screen.queryByText('Responsável pelo último registro (ID)')).toBeNull();
    }
  });

  it('mantém registro bloqueado durante carregamento e erro e permite repetir consulta e cancelar', () => {
    const onRetry = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(<CandidateConsentForm {...defaults} onRetry={onRetry} onCancel={onCancel} state={{ status: 'loading' }} />);
    expect(screen.getByRole('status').textContent).toBe('Consultando consentimento simulado…');
    expect(screen.getByRole('form').getAttribute('aria-busy')).toBe('true');
    rerender(<CandidateConsentForm {...defaults} onRetry={onRetry} onCancel={onCancel} state={{ status: 'error', message: 'Erro de consulta' }} />);
    expect(screen.getByRole('alert').textContent).toBe('Erro de consulta');
    expect(screen.queryByText('Não registrado')).toBeNull();
    expect((screen.getByRole('button', { name: 'Registrar consentimento' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('prepara sucesso futuro somente após resposta da integração e impede envio duplicado', async () => {
    let resolve!: (consent: CandidateConsent) => void;
    const onRegister = vi.fn(() => new Promise<CandidateConsent>((done) => { resolve = done; }));
    render(<CandidateConsentForm {...defaults} state={{ status: 'ready', consent: unrecorded }} onRegister={onRegister} />);
    fill();
    const form = screen.getByRole('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onRegister).toHaveBeenCalledExactlyOnceWith({ status: 'Registrado', termVersion: 'versao-teste', observation: null });
    expect(screen.queryByText('Consentimento simulado registrado com sucesso.')).toBeNull();
    expect(screen.getByText('Não registrado')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Registrar consentimento' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { resolve(recorded); });
    expect(screen.getByText('Consentimento simulado registrado com sucesso.')).toBeTruthy();
    expect(screen.getByText('Registrado', { selector: 'strong' })).toBeTruthy();
  });

  it('não confirma sucesso quando a integração falha', async () => {
    const onRegister = vi.fn().mockRejectedValue(new Error('Falha de rede'));
    render(<CandidateConsentForm {...defaults} state={{ status: 'ready', consent: unrecorded }} onRegister={onRegister} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar consentimento' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Consentimento simulado registrado com sucesso.')).toBeNull();
    expect(screen.getByText('Não registrado')).toBeTruthy();
  });
});
