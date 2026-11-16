import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CoordinatorCandidatesPage } from '../pages/coordenatorPage';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ request, user: { id: 'coordinator-id', name: 'Rafael Lima' } }),
}));

const studyId = 'study-1';
const candidateId = 'candidate-1';
const criteria = [
  { id: 'inclusion-1', studyId, type: 'Inclusão', description: 'Idade mínima', active: true },
  { id: 'exclusion-1', studyId, type: 'Exclusão', description: 'Impedimento', active: true },
];
const candidate = {
  id: candidateId,
  studyId,
  name: 'Ana Silva',
  email: null,
  registeredAt: '2026-11-08',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const eligibilityPath = `/studies/${studyId}/candidates/${candidateId}/eligibility-assessments`;
const consentPath = `/studies/${studyId}/candidates/${candidateId}/consents`;
const inclusionPath = `/studies/${studyId}/candidates/${candidateId}/include`;

let candidateStatus: 'Em avaliação' | 'Elegível' | 'Incluído';
let assessment: Record<string, unknown>;
let consent: Record<string, unknown>;

beforeEach(() => {
  candidateStatus = 'Em avaliação';
  assessment = { studyId, candidateId, status: 'Em avaliação', evaluations: [] };
  consent = {
    studyId, candidateId, status: null, termVersion: null, registeredAt: null, registrarId: null, observation: null,
  };
  request.mockReset().mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/studies/disponiveis-recrutamento') return json([{ id: studyId, title: 'Sono' }]);
    if (path === `/studies/${studyId}/candidates`) {
      return json([{ ...candidate, status: candidateStatus }]);
    }
    if (path === `/studies/${studyId}/criteria`) return json(criteria);
    if (path === eligibilityPath) {
      if (options?.method !== 'POST') return json(assessment);
      const input = JSON.parse(String(options.body)) as {
        evaluations: { criterionId: string; result: string; observation: string }[];
      };
      candidateStatus = 'Elegível';
      assessment = {
        studyId,
        candidateId,
        status: candidateStatus,
        evaluations: input.evaluations.map((evaluation, index) => ({
          ...evaluation,
          id: `evaluation-${index + 1}`,
          criterionType: criteria[index].type,
          criterionDescription: criteria[index].description,
          evaluatorId: 'coordinator-id',
          evaluatedAt: '2026-11-08T13:00:00.000Z',
        })),
      };
      return json(assessment, 201);
    }
    if (path === consentPath) {
      if (options?.method !== 'POST') return json(consent);
      const input = JSON.parse(String(options.body)) as {
        status: string; termVersion: string; observation: string | null;
      };
      consent = {
        ...input, studyId, candidateId, registrarId: 'coordinator-id',
        registeredAt: '2026-11-08T13:10:00.000Z',
      };
      return json(consent, 201);
    }
    if (path === inclusionPath && options?.method === 'POST') {
      candidateStatus = 'Incluído';
      return json({
        participationId: 'participation-1', candidateId, studyId, includedAt: '2026-11-08',
        participationStatus: 'Ativo', participantsLinked: 1, participantLimit: 5,
      }, 201);
    }
    throw new Error(`Requisição inesperada: ${options?.method ?? 'GET'} ${path}`);
  });
});

afterEach(cleanup);

describe('RF09–RF11 — fluxo integrado de recrutamento na Web', () => {
  it('avalia, registra consentimento e inclui o candidato, atualizando o estado na listagem', async () => {
    render(
      <MemoryRouter initialEntries={[`/coordenador/candidatos?studyId=${studyId}`]}>
        <CoordinatorCandidatesPage />
      </MemoryRouter>,
    );

    const row = await screen.findByRole('row', { name: /Ana Silva/ });
    fireEvent.click(within(row).getByRole('button', { name: 'Detalhes' }));
    const details = screen.getByRole('dialog', { name: 'Detalhes do candidato' });

    fireEvent.click(within(details).getByRole('button', { name: 'Avaliar elegibilidade' }));
    const eligibility = screen.getByRole('dialog', { name: 'Avaliar elegibilidade' });
    fireEvent.click(within(await within(eligibility).findByRole('group', { name: 'Idade mínima' }))
      .getByRole('radio', { name: 'Atende' }));
    fireEvent.click(within(await within(eligibility).findByRole('group', { name: 'Impedimento' }))
      .getByRole('radio', { name: 'Não atende' }));
    fireEvent.submit(within(eligibility).getByRole('form', { name: 'Avaliação de elegibilidade' }));

    await within(details).findByText('Avaliação registrada com sucesso!');
    expect(candidateStatus).toBe('Elegível');
    expect(within(await screen.findByRole('row', { name: /Ana Silva.*Elegível/ })).getByText('Elegível')).toBeTruthy();

    fireEvent.click(within(details).getByRole('button', { name: 'Registrar consentimento' }));
    const consentDialog = screen.getByRole('dialog', { name: 'Registrar consentimento' });
    await within(consentDialog).findByText('Não registrado', { selector: '.coord-status' });
    fireEvent.click(within(consentDialog).getByRole('radio', { name: 'Registrado' }));
    fireEvent.change(within(consentDialog).getByRole('textbox', { name: 'Versão do termo simulado *' }), {
      target: { value: 'termo-teste-v1' },
    });
    fireEvent.submit(within(consentDialog).getByRole('form', { name: 'Consentimento simulado' }));

    await within(details).findByText('Consentimento simulado registrado com sucesso!');
    expect(consent.status).toBe('Registrado');

    fireEvent.click(within(details).getByRole('button', { name: 'Incluir participante' }));
    const inclusionDialog = screen.getByRole('dialog', { name: 'Incluir participante' });
    fireEvent.click(within(inclusionDialog).getByRole('button', { name: 'Confirmar inclusão' }));

    await within(details).findByText('Participante incluído com sucesso!');
    expect(candidateStatus).toBe('Incluído');
    expect(within(await screen.findByRole('row', { name: /Ana Silva.*Incluído/ })).getByText('Incluído')).toBeTruthy();
    expect(request.mock.calls.filter(([, options]) => options?.method === 'POST').map(([path]) => path)).toEqual([
      eligibilityPath,
      consentPath,
      inclusionPath,
    ]);
  });
});
