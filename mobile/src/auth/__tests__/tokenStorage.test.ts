import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { tokenStorage } from '../tokenStorage';

jest.mock('expo-secure-store');

beforeEach(async () => {
  jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(null);
  jest.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue(undefined);
  jest.mocked(SecureStore.deleteItemAsync).mockReset().mockResolvedValue(undefined);
  await tokenStorage.clear();
  jest.clearAllMocks();
});

describe('Armazenamento de token', () => {
  it('usa apenas memória na web, sem acessar SecureStore ou armazenamento do navegador', async () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      expect(await tokenStorage.read()).toBeNull();
      await tokenStorage.save('web-token');
      expect(await tokenStorage.read()).toBe('web-token');
      await tokenStorage.clear();
      expect(await tokenStorage.read()).toBeNull();
      expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    } finally { platform.restore(); }
  });

  it('não relê token cuja remoção falhou mesmo após reiniciar o provider', async () => {
    jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('locked'));
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('locked'));
    await expect(tokenStorage.clear()).rejects.toThrow('remover a sessão');
    await expect(tokenStorage.read()).rejects.toThrow('remover a sessão');
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    await tokenStorage.clear();
    expect(await tokenStorage.read()).toBeNull();
  });
});
