import { query, initDb } from '../db.js';

async function seed() {
  await initDb();
  try {
    // Create users
    const alice = await query("INSERT INTO users (email, password_hash) VALUES ('alice@example.com', 'seed') ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING id, email");
    const bob = await query("INSERT INTO users (email, password_hash) VALUES ('bob@example.com', 'seed') ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING id, email");

    const aliceId = alice.rows[0].id;
    const bobId = bob.rows[0].id;

    // Create notes
    const note1 = await query('INSERT INTO notes (owner_id, title, content) VALUES ($1, $2, $3) RETURNING *', [aliceId, 'Shopping list', 'Milk, Eggs, Bread']);
    const note2 = await query('INSERT INTO notes (owner_id, title, content) VALUES ($1, $2, $3) RETURNING *', [aliceId, 'Ideas', 'Build a notes app']);
    const note3 = await query('INSERT INTO notes (owner_id, title, content) VALUES ($1, $2, $3) RETURNING *', [bobId, 'Bob Note', 'Bob content']);

    // Share note1 with Bob
    await query('INSERT INTO note_shares (note_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [note1.rows[0].id, bobId]);

    console.log('Seed complete');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed', err);
    process.exit(1);
  }
}

seed();
