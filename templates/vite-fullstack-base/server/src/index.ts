import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import express from 'express';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors());
app.use(express.json());

// Example API endpoint - customize based on requirements
app.get('/api/users', async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.post('/api/users', async (req, res) => {
  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = await prisma.user.create({
    data: { email, name },
  });
  res.json(user);
});

// Global error handler - must be after all routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Handle Prisma unique constraint violations
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Email already exists' });
  }

  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
