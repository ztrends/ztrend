import {describe, expect, it} from 'vitest';
import {getApiBase, getRouterBasename} from '../config';

describe('deployment configuration', () => {
  it('uses the repository subpath for GitHub Pages routes', () => {
    expect(getRouterBasename('/NEXORA-COMMERCE-ERP/')).toBe('/NEXORA-COMMERCE-ERP');
  });

  it('uses root routing for local development', () => {
    expect(getRouterBasename('/')).toBe('/');
  });

  it('uses localhost only during development when no API URL is supplied', () => {
    expect(getApiBase(undefined, true)).toBe('http://localhost:4000/api');
    expect(getApiBase(undefined, false)).toBe('');
  });

  it('normalizes a configured API URL', () => {
    expect(getApiBase('https://api.example.com/api/', false)).toBe('https://api.example.com/api');
  });
});
