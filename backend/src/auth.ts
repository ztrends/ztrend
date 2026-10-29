import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from './db.js';

const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('JWT_SECRET must be set to at least 32 characters');
  return value;
};
export async function hashPassword(password: string) { return bcrypt.hash(password, 12); }
export async function verifyPassword(password: string, hash: string) { return bcrypt.compare(password, hash); }
export type Identity = { id: string; name: string; email: string; identity_type: 'FOUNDER'|'ADMIN'|'CUSTOMER'; force_password_change: boolean };
declare global { namespace Express { interface Request { user?: Identity; permissions?: Set<string> } } }

const cookieSameSite = (): 'lax' | 'strict' | 'none' => {
  const value = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
  if (value === 'lax' || value === 'strict' || value === 'none') return value;
  throw new Error('COOKIE_SAME_SITE must be lax, strict, or none');
};
const cookieSecure = () => process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
const cookieBaseOptions = () => ({httpOnly: true, secure: cookieSecure(), sameSite: cookieSameSite(), path: '/'} as const);

export function issueSession(user: Identity, res: Response) {
  const token = jwt.sign({ sub: user.id, typ: user.identity_type }, secret(), { expiresIn: '8h', issuer: 'nexora-erp' });
  res.cookie('nexora_session', token, {...cookieBaseOptions(), maxAge: 8 * 60 * 60 * 1000});
}
export function logout(res: Response) { res.clearCookie('nexora_session', cookieBaseOptions()); }

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = req.cookies?.nexora_session || (header?.startsWith('Bearer ') ? header.slice(7) : null);
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const decoded = jwt.verify(token, secret(), { issuer: 'nexora-erp' }) as any;
    const result = await query<Identity & { active: boolean }>('SELECT id,name,email,identity_type,force_password_change,active FROM users WHERE id=$1', [decoded.sub]);
    const user = result.rows[0];
    if (!user || !user.active || user.identity_type !== decoded.typ) return res.status(401).json({ error: 'Session is no longer valid' });
    if (user.force_password_change && !['/api/auth/me', '/api/auth/change-password', '/api/auth/logout'].includes(req.path)) {
      return res.status(403).json({error: 'Password change required before using this account'});
    }
    req.user = user;
    if (user.identity_type === 'ADMIN') {
      const p = await query<{module:string;action:string}>(
        `SELECT p.module,p.action FROM permissions p JOIN user_permissions up ON up.permission_id=p.id WHERE up.user_id=$1`, [user.id]);
      req.permissions = new Set(p.rows.map(x => `${x.module}:${x.action}`));
    } else req.permissions = new Set(['*:*']);
    next();
  } catch (e) { next(e); }
}
export function requireIdentity(...types: Array<Identity['identity_type']>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !types.includes(req.user.identity_type)) return res.status(403).json({ error: 'Access denied for this panel' });
    next();
  };
}
export function requirePermission(module: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.identity_type === 'FOUNDER') return next();
    if (!req.permissions?.has(`${module}:${action}`)) return res.status(403).json({ error: `Permission required: ${module}:${action}` });
    next();
  };
}
