import { httpRequest } from '../api/http';

export async function authRequest(path: 'login' | 'logout' | 'me', body?: object, token?: string) {
  return httpRequest(`/auth/${path}`, {
    method: path === 'me' ? 'GET' : 'POST', body, token, readResponse: path !== 'logout',
  });
}
