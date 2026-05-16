import bcrypt from 'bcryptjs';
import { query } from '../db.js';

async function run() {
  const hash = await bcrypt.hash('password123', 10);
  await query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'alice@example.com']);
  await query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'bob@example.com']);
  console.log('Passwords updated');
}

run().catch(err => { console.error(err); process.exit(1); });
