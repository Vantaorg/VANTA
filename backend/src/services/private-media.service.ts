import jwt from 'jsonwebtoken';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

type PrivateMediaClaims = { userId: string; fileId: string; scope: 'private-media' };
function signingSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required for private media access');
  return secret;
}
export function createPrivateMediaUrl(fileId: string, userId: string): string {
  const token = jwt.sign({ userId, fileId, scope: 'private-media' } satisfies PrivateMediaClaims, signingSecret(), { expiresIn: '30m', algorithm: 'HS256' });
  return `/api/media/private/${encodeURIComponent(fileId)}?token=${encodeURIComponent(token)}`;
}
export function verifyPrivateMediaToken(token: string, fileId: string): string {
  const claims = jwt.verify(token, signingSecret(), { algorithms: ['HS256'] }) as jwt.JwtPayload & Partial<PrivateMediaClaims>;
  if (claims.scope !== 'private-media' || claims.fileId !== fileId || typeof claims.userId !== 'string' || !claims.userId) throw new Error('Invalid private media token');
  return claims.userId;
}
export async function privateMediaStaticGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filename = path.basename(decodeURIComponent(req.path));
    const privateFile = await prisma.uploadedFile.findFirst({ where: { filename, category: 'message' }, select: { id: true } });
    if (privateFile) { res.status(404).json({ error: 'Not found' }); return; }
    next();
  } catch (error) {
    console.error('Private media static guard failed:', error instanceof Error ? error.message : 'unknown error');
    res.status(503).json({ error: 'Media authorization is temporarily unavailable' });
  }
}
