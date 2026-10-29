import {getApiBase} from './config';

const BASE = getApiBase(import.meta.env.VITE_API_BASE_URL, import.meta.env.DEV);

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BASE) {
    throw new Error('Backend API is not configured for this deployment. Set the VITE_API_BASE_URL repository variable to your deployed HTTPS API URL, then redeploy the frontend.');
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${BASE}${normalizedPath}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  const body: unknown = await response.json().catch(() => ({error: 'Unexpected server response'}));
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
      ? body.error
      : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}
