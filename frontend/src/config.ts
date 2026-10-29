export function getRouterBasename(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized || '/';
}

export function getApiBase(apiBase: string | undefined, isDev: boolean): string {
  const candidate = apiBase?.trim() || (isDev ? 'http://localhost:4000/api' : '');
  return candidate.replace(/\/+$/, '');
}
