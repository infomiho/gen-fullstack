import { type Request, type Response, Router } from 'express';
import { createSession, deleteSession, hashPassword, verifyPassword } from './auth';
import { requireAuth } from './auth-middleware';
import { prisma } from './lib/prisma';

export const authRouter = Router();

/**
 * POST /auth/register
 * Create a new user account
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Username and password must be strings' });
    return;
  }

  if (username.length < 3) {
    res.status(400).json({ error: 'Username must be at least 3 characters' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  // Check if username already exists
  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    res.status(409).json({ error: 'Username already exists' });
    return;
  }

  // Create user
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username,
      password: passwordHash,
    },
  });

  // Create session
  const token = await createSession(user.id);

  res.status(201).json({
    user: {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
    },
    token,
  });
});

/**
 * POST /auth/login
 * Authenticate user and create session
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password);

  if (!isValid) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  // Create session
  const token = await createSession(user.id);

  res.status(200).json({
    user: {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
    },
    token,
  });
});

/**
 * POST /auth/logout
 * Delete current session
 */
authRouter.post('/logout', requireAuth, async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    await deleteSession(token);
  }

  res.status(200).json({ message: 'Logged out successfully' });
});

/**
 * GET /auth/me
 * Get current authenticated user
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  res.status(200).json({
    user: req.user,
  });
});
