import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CandidateForm, type CandidateStudiesState } from './CandidateForm';
import { CandidateSubmissionError } from './candidateValidation';

const studies: CandidateStudiesState = { status: 'ready', options: [{ id: 'study-1', title: 'Sono' }, { id: 'study-2', title: 'Atividade física' }] };
const accounts = { people: [{ id: 'user-1', name: 'Ana Silva', email: 'ana@example.com' }], links: [{ id_estudo: 'study-1', id_usuario: 'user-1' }] };
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Cadastrar candidato' }));
function fillValid() {
  fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: '  Ana Silva  ' } });
  fireEvent.change(screen.getByLabelText(/^Estudo/), { target: { value: 'study-1' } });
}
afterEach(cleanup);

describe('CandidateForm', () => {
  it('mostra erros próximos aos campos, associa descrições e foca o primeiro inválido', () => {
    const onSubmit = vi.fn();
    render(<CandidateForm studies={studies} onSubmit={onSubmit} onCancel={vi.fn()} />);
    submit();
    expect(screen.getByText('Informe o nome completo do candidato.')).toBeTruthy();
    expect(screen.getByText('Selecione um estudo válido.')).toBeTruthy();
    const name = screen.getByLabelText(/Nome completo/);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toBe('candidate-name-error');
    expect(document.activeElement).toBe(name);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('impede nome com espaços e e-mail inválido, permitindo corrigir os campos', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CandidateForm studies={studies} onSubmit={onSubmit} onCancel={vi.fn()} />);
    fillValid();
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('E-mail (opcional)'), { target: { value: 'invalido' } });
    submit();
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
    fillValid();
    fireEvent.change(screen.getByLabelText('E-mail (opcional)'), { target: { value: ' ana@example.com ' } });
    expect(screen.queryByRole('alert')).toBeNull();
    submit();
    await screen.findByText('Candidato cadastrado com sucesso.');
    expect(onSubmit).toHaveBeenCalledWith({ id_estudo: 'study-1', id_usuario: null, nome: 'Ana Silva', email: 'ana@example.com', status_recrutamento: 'Novo' });
  });

  it('impede envio sem estudo, mesmo com os outros campos válidos', () => {
    const onSubmit = vi.fn();
    render(<CandidateForm studies={studies} onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Ana Silva' } });
    submit();
    expect(screen.getByText('Selecione um estudo válido.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('desabilita cadastro sem persistência, explica o motivo e bloqueia submit direto', () => {
    render(<CandidateForm studies={studies} onCancel={vi.fn()} />);
    expect(screen.queryByLabelText('Pessoa cadastrada (opcional)')).toBeNull();
    fillValid();
    const button = screen.getByRole('button', { name: 'Cadastrar candidato' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe('candidate-integration-hint');
    expect(document.getElementById('candidate-integration-hint')?.textContent).toBe('O envio do cadastro estará disponível após a integração com o sistema.');
    submit();
    fireEvent.submit(screen.getByRole('form'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Candidato cadastrado com sucesso.')).toBeNull();
  });

  it('remove a mensagem e habilita o envio quando a persistência se torna disponível', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    const { rerender } = render(<CandidateForm studies={studies} onCancel={onCancel} />);
    fillValid();
    rerender(<CandidateForm studies={studies} onSubmit={onSubmit} onCancel={onCancel} />);
    expect(screen.queryByText('O envio do cadastro estará disponível após a integração com o sistema.')).toBeNull();
    expect((screen.getByRole('button', { name: 'Cadastrar candidato' }) as HTMLButtonElement).disabled).toBe(false);
    submit();
    await screen.findByText('Candidato cadastrado com sucesso.');
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it.each(['', '   '])('valida nome vazio ou com espaços ao sair do campo, mesmo sem persistência (%j)', (name) => {
    render(<CandidateForm studies={studies} onCancel={vi.fn()} />);
    const input = screen.getByLabelText(/Nome completo/);
    fireEvent.change(input, { target: { value: name } });
    fireEvent.blur(input);
    expect(screen.getByRole('alert').textContent).toBe('Informe o nome completo do candidato.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect((input as HTMLInputElement).value).toBe(name);
  });

  it('valida e-mail no blur e mantém os valores ao corrigir o erro', () => {
    render(<CandidateForm studies={studies} onCancel={vi.fn()} />);
    fillValid();
    const email = screen.getByLabelText('E-mail (opcional)');
    fireEvent.change(email, { target: { value: 'invalido' } });
    fireEvent.blur(email);
    expect(document.getElementById(email.getAttribute('aria-describedby')!)?.textContent).toContain('e-mail válido');
    expect((email as HTMLInputElement).value).toBe('invalido');
    fireEvent.change(email, { target: { value: '' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect((screen.getByLabelText(/Nome completo/) as HTMLInputElement).value).toBe('  Ana Silva  ');
  });

  it('apresenta os campos obrigatórios e valida estudo ao sair do seletor', () => {
    render(<CandidateForm studies={studies} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect((screen.getByLabelText(/Nome completo/) as HTMLInputElement).required).toBe(true);
    const study = screen.getByLabelText(/^Estudo/) as HTMLSelectElement;
    expect(study.required).toBe(true);
    expect((screen.getByLabelText('E-mail (opcional)') as HTMLInputElement).required).toBe(false);
    fireEvent.blur(study);
    expect(screen.getByRole('alert').textContent).toBe('Selecione um estudo válido.');
    expect(study.getAttribute('aria-describedby')).toContain('candidate-studyId-error');
    fireEvent.change(study, { target: { value: 'study-1' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    { state: { status: 'loading' }, message: 'Carregando estudos…', busy: true },
    { state: { status: 'ready', options: [] }, message: 'Nenhum estudo disponível para associação.', busy: false },
    { state: { status: 'error' }, message: 'Não foi possível carregar os estudos. Tente novamente mais tarde.', busy: false },
    { state: { status: 'unavailable', message: 'Consulta indisponível para Coordenador.' }, message: 'Consulta indisponível para Coordenador.', busy: false },
  ] satisfies { state: CandidateStudiesState; message: string; busy: boolean }[])('trata o estado de estudos $state.status e impede envio', ({ state, message, busy }) => {
    const onSubmit = vi.fn();
    render(<CandidateForm studies={state} onSubmit={onSubmit} onCancel={vi.fn()} />);
    const study = screen.getByLabelText(/^Estudo/) as HTMLSelectElement;
    expect(study.disabled).toBe(true);
    expect(study.getAttribute('aria-busy')).toBe(String(busy));
    expect(study.options).toHaveLength(1);
    const hint = document.getElementById('candidate-study-hint')!;
    expect(hint.textContent).toBe(message);
    expect(hint.getAttribute('role')).toBe(state.status === 'error' ? 'alert' : 'status');
    const button = screen.getByRole('button', { name: 'Cadastrar candidato' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe('candidate-study-hint');
    fireEvent.submit(screen.getByRole('form'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('atualiza estudos após carregar ou recuperar de falha, preservando nome e e-mail', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(<CandidateForm studies={{ status: 'loading' }} onSubmit={onSubmit} onCancel={onCancel} />);
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Ana Silva' } });
    fireEvent.change(screen.getByLabelText('E-mail (opcional)'), { target: { value: 'ana@example.com' } });
    rerender(<CandidateForm studies={studies} onSubmit={onSubmit} onCancel={onCancel} />);
    const study = screen.getByLabelText(/^Estudo/) as HTMLSelectElement;
    expect(study.disabled).toBe(false);
    expect(study.options).toHaveLength(3);
    fireEvent.change(study, { target: { value: 'study-1' } });
    rerender(<CandidateForm studies={{ status: 'error' }} onSubmit={onSubmit} onCancel={onCancel} />);
    fireEvent.submit(screen.getByRole('form'));
    expect(onSubmit).not.toHaveBeenCalled();
    rerender(<CandidateForm studies={studies} onSubmit={onSubmit} onCancel={onCancel} />);
    expect((screen.getByLabelText(/Nome completo/) as HTMLInputElement).value).toBe('Ana Silva');
    expect((screen.getByLabelText('E-mail (opcional)') as HTMLInputElement).value).toBe('ana@example.com');
    expect(study.value).toBe('study-1');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('rejeita estudo que deixou de pertencer às opções autorizadas', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(<CandidateForm studies={studies} onSubmit={onSubmit} onCancel={onCancel} />);
    fillValid();
    rerender(<CandidateForm studies={{ status: 'ready', options: [{ id: 'study-3', title: 'Outro estudo' }] }} onSubmit={onSubmit} onCancel={onCancel} />);
    submit();
    expect(screen.getByText('Selecione um estudo válido.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('preserva os dados em falha inesperada sem expor detalhes técnicos', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('SQLSTATE 23505: candidatos_estudo_usuario_unico'));
    render(<CandidateForm studies={studies} onSubmit={onSubmit} onCancel={vi.fn()} />);
    fillValid();
    fireEvent.change(screen.getByLabelText('E-mail (opcional)'), { target: { value: 'ana@example.com' } });
    submit();
    await screen.findByText('Não foi possível cadastrar o candidato. Tente novamente.');
    expect(screen.queryByText(/SQLSTATE/)).toBeNull();
    expect((screen.getByLabelText(/Nome completo/) as HTMLInputElement).value).toBe('  Ana Silva  ');
    expect((screen.getByLabelText('E-mail (opcional)') as HTMLInputElement).value).toBe('ana@example.com');
    expect((screen.getByLabelText(/^Estudo/) as HTMLSelectElement).value).toBe('study-1');
    expect(screen.queryByText('Candidato cadastrado com sucesso.')).toBeNull();
  });

  it('preenche dados da pessoa e bloqueia duplicidade no estudo escolhido', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CandidateForm studies={studies} accounts={accounts} onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Pessoa cadastrada (opcional)'), { target: { value: 'user-1' } });
    fireEvent.change(screen.getByLabelText(/^Estudo/), { target: { value: 'study-1' } });
    expect((screen.getByLabelText(/Nome completo/) as HTMLInputElement).value).toBe('Ana Silva');
    submit();
    expect(screen.getByText('Esta pessoa já está vinculada como candidata a este estudo.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^Estudo/), { target: { value: 'study-2' } });
    expect(screen.queryByRole('alert')).toBeNull();
    submit();
    await screen.findByText('Candidato cadastrado com sucesso.');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ id_usuario: 'user-1', id_estudo: 'study-2' }));
  });

  it('preserva valores e mostra erro de campo retornado pela integração, permitindo tentar novamente', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new CandidateSubmissionError('Não foi possível salvar.', { email: 'Confira o e-mail informado.' })).mockResolvedValue(undefined);
    render(<CandidateForm studies={studies} onSubmit={onSubmit} onCancel={vi.fn()} />);
    fillValid();
    submit();
    await screen.findByText('Não foi possível salvar.');
    expect(screen.getByText('Confira o e-mail informado.')).toBeTruthy();
    expect((screen.getByLabelText(/Nome completo/) as HTMLInputElement).value).toBe('  Ana Silva  ');
    expect((screen.getByLabelText(/^Estudo/) as HTMLSelectElement).value).toBe('study-1');
    submit();
    await screen.findByText('Candidato cadastrado com sucesso.');
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('só confirma sucesso após concluir o envio e impede envios repetidos', async () => {
    let finish!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<CandidateForm studies={studies} onSubmit={onSubmit} onCancel={vi.fn()} />);
    fillValid();
    submit();
    expect(screen.queryByText('Candidato cadastrado com sucesso.')).toBeNull();
    fireEvent.submit(screen.getByRole('form'));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: 'Cadastrando…' }) as HTMLButtonElement).disabled).toBe(true);
    finish();
    await screen.findByText('Candidato cadastrado com sucesso.');
    fireEvent.submit(screen.getByRole('form'));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('cancela sem submeter os dados', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(<CandidateForm studies={studies} onSubmit={onSubmit} onCancel={onCancel} />);
    fillValid();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
