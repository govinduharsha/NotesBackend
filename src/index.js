import express from 'express';
import dotenv from 'dotenv';
import notesRouter from './routes/notes.js';
import authRouter from './routes/auth.js';
import { initDb } from './db.js';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/notes', notesRouter);
app.use('/auth', authRouter);

app.get('/openapi.json', (req, res) => {
  const p = path.join(process.cwd(), 'openapi.json');
  if (!fs.existsSync(p)) return res.status(404).end();
  res.sendFile(p);
});

app.get('/about', (req, res) => {
  res.json({
    name: 'Your Name',
    email: 'your.email@example.com',
    'my features': {
      'full-text search': 'Search notes by keyword across title and content using Postgres FTS',
      'sharing': 'Share notes with other users by email'
    }
  });
});

app.get('/', (req, res) => res.json({ ok: true, msg: 'Notes API' }));

const PORT = process.env.PORT || 3000;

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
