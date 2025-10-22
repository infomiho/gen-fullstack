import type { NextFunction, Request, Response } from 'express';
import { validateSession } from './auth';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}

/**
 * Middleware to require authentication
 * Expects Authorization header with Bearer token
 * Sets req.user if valid, returns 401 if invalid
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const user = await validateSession(token);

  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.user = user;
  next();
}
