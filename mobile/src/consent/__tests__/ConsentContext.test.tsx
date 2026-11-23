import { act, renderHook } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useAuth } from '../../auth/AuthContext';
import { ConsentProvider, useConsent } from '../ConsentContext';
import { consentTerm } from '../consentTerm';

let mockAuth: ReturnType<typeof useAuth>;
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => mockAuth }));

const user = { id: 'participant-a', name: 'Bianca Oliveira', email: 'bianca@example.test', phone: '', role: 'Participante' as const, status: 'Ativo' as const, createdAt: '2026-11-01T00:00:00.000Z' };
beforeEach(() => {
  mockAuth = { status: 'authenticated', user, client: { get: async () => [] }, message: null, login: async () => {}, logout: async () => {}, retry: async () => {} };
});

describe('Aceite local por participante', () => {
  it('associa conta, versão e data ao aceite e mantém a confirmação até Continuar', async () => {
    const { result } = await renderHook(useConsent, { wrapper: ConsentProvider });
    await act(() => result.current.continueToStudies());
    expect(result.current.needsFirstAccess).toBe(true);
    const before = Date.now();
    await act(() => result.current.accept());
    const acceptance = result.current.acceptance!;
    expect(acceptance).toEqual({ participantId: user.id, version: consentTerm.version, acceptedAt: expect.any(String) });
    expect(Date.parse(acceptance.acceptedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(acceptance.acceptedAt)).toBeLessThanOrEqual(Date.now());
    expect(result.current.needsFirstAccess).toBe(true);
    await act(() => result.current.accept());
    expect(result.current.acceptance).toBe(acceptance);
    await act(() => result.current.continueToStudies());
    expect(result.current.needsFirstAccess).toBe(false);
  });

  it('não transfere o aceite entre contas e conserva o aceite da mesma conta nesta execução', async () => {
    const app = await renderHook(useConsent, { wrapper: ConsentProvider });
    await act(() => app.result.current.accept());
    const acceptance = app.result.current.acceptance;
    await act(async () => {
      mockAuth = { ...mockAuth, user: { ...user, id: 'participant-b' }, client: { get: async () => [] } };
      app.rerender(undefined);
    });
    expect(app.result.current.accepted).toBe(false);
    expect(app.result.current.needsFirstAccess).toBe(true);
    await act(async () => {
      mockAuth = { ...mockAuth, user, client: { get: async () => [] } };
      app.rerender(undefined);
    });
    expect(app.result.current.acceptance).toBe(acceptance);
    expect(app.result.current.needsFirstAccess).toBe(false);
  });

  it('não aceita sem autenticação e reinicia o aceite ao reabrir o aplicativo', async () => {
    const app = await renderHook(useConsent, { wrapper: ConsentProvider });
    await act(() => app.result.current.accept());
    await app.unmount();
    const reopened = await renderHook(useConsent, { wrapper: ConsentProvider });
    expect(reopened.result.current.accepted).toBe(false);
    await act(async () => {
      mockAuth = { ...mockAuth, status: 'unauthenticated', user: null, client: null };
      reopened.rerender(undefined);
    });
    await act(() => reopened.result.current.accept());
    expect(reopened.result.current.acceptance).toBeNull();
  });
});
