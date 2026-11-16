import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const key = 'clinicalstudypb.accessToken';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
let webToken: string | null = null;
let cleanupPending = false;
let queue: Promise<unknown> = Promise.resolve();

// Serializa gravação/exclusão para que um logout também remova uma gravação em curso.
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.catch(() => {});
  return result;
}

export const tokenStorage = {
  read: () => serialized(async () => {
    if (cleanupPending) throw new Error('Não foi possível remover a sessão do dispositivo. Tente sair novamente.');
    try {
      return Platform.OS === 'web' ? webToken : (await SecureStore.getItemAsync(key, options)) || null;
    } catch {
      throw new Error('Não foi possível ler a sessão no armazenamento seguro. Tente novamente ou saia da conta.');
    }
  }),
  save: (token: string) => serialized(async () => {
    try {
      if (Platform.OS === 'web') webToken = token;
      else await SecureStore.setItemAsync(key, token, options);
    } catch {
      throw new Error('Não foi possível salvar a sessão com segurança. Tente novamente.');
    }
  }),
  clear: () => {
    cleanupPending = true;
    webToken = null;
    return serialized(async () => {
      if (Platform.OS !== 'web') {
        try { await SecureStore.deleteItemAsync(key, options); }
        catch {
          // Se a exclusão falhar, inutiliza o valor na mesma chave, sem guardar outro dado.
          try { await SecureStore.setItemAsync(key, '', options); }
          catch { throw new Error('Não foi possível remover a sessão do dispositivo. Tente sair novamente.'); }
        }
      }
      cleanupPending = false;
    });
  },
};
