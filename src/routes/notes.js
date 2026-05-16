import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Create note
router.post('/', authenticate, async (req, res) => {
  const { title, content, pinned = false } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const result = await query(
      'INSERT INTO notes (owner_id, title, content, pinned) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, title, content, pinned]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

// List notes owned or shared with user
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT n.* FROM notes n
       LEFT JOIN note_shares s ON s.note_id = n.id
       WHERE n.owner_id = $1 OR s.user_id = $1
       GROUP BY n.id
       ORDER BY n.pinned DESC, n.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

// Get specific note (only if owner or shared)
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT n.* FROM notes n
       LEFT JOIN note_shares s ON s.note_id = n.id
       WHERE n.id = $1 AND (n.owner_id = $2 OR s.user_id = $2)
       LIMIT 1`,
      [id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

// Update note (owner only)
router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { title, content, pinned } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const check = await query('SELECT owner_id, pinned FROM notes WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'not found' });
    if (String(check.rows[0].owner_id) !== String(req.user.id)) return res.status(403).json({ error: 'forbidden' });
    const nextPinned = typeof pinned === 'boolean' ? pinned : check.rows[0].pinned;
    const result = await query(
      'UPDATE notes SET title = $1, content = $2, pinned = $3, updated_at = now() WHERE id = $4 RETURNING *',
      [title, content, nextPinned, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

// Delete note (owner only)
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const check = await query('SELECT owner_id FROM notes WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'not found' });
    if (String(check.rows[0].owner_id) !== String(req.user.id)) return res.status(403).json({ error: 'forbidden' });
    await query('DELETE FROM notes WHERE id = $1', [id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

// Pin a note (owner only)
router.post('/:id/pin', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const check = await query('SELECT owner_id FROM notes WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'not found' });
    if (String(check.rows[0].owner_id) !== String(req.user.id)) return res.status(403).json({ error: 'forbidden' });
    await query('UPDATE notes SET pinned = true, updated_at = now() WHERE id = $1', [id]);
    res.json({ message: 'pinned' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

// Unpin a note (owner only)
router.post('/:id/unpin', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const check = await query('SELECT owner_id FROM notes WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'not found' });
    if (String(check.rows[0].owner_id) !== String(req.user.id)) return res.status(403).json({ error: 'forbidden' });
    await query('UPDATE notes SET pinned = false, updated_at = now() WHERE id = $1', [id]);
    res.json({ message: 'unpinned' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

// Share note with another user by email (owner only)
router.post('/:id/share', authenticate, async (req, res) => {
  const { id } = req.params;
  const { share_with_email } = req.body;
  if (!share_with_email) return res.status(400).json({ error: 'share_with_email is required' });
  try {
    const check = await query('SELECT owner_id FROM notes WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'not found' });
    if (String(check.rows[0].owner_id) !== String(req.user.id)) return res.status(403).json({ error: 'forbidden' });
    const u = await query('SELECT id FROM users WHERE email = $1', [share_with_email]);
    if (!u.rows[0]) return res.status(404).json({ error: 'user to share with not found' });
    await query('INSERT INTO note_shares (note_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, u.rows[0].id]);
    res.json({ message: 'shared' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

// Full-text search across accessible notes (extra feature)
router.get('/search', authenticate, async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'q query param required' });
  try {
    const result = await query(
      `SELECT n.* FROM notes n
       LEFT JOIN note_shares s ON s.note_id = n.id
       WHERE (n.owner_id = $1 OR s.user_id = $1)
       AND to_tsvector('english', coalesce(n.title,'') || ' ' || coalesce(n.content,'')) @@ plainto_tsquery('english', $2)
       GROUP BY n.id
       ORDER BY n.created_at DESC`,
      [req.user.id, q]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

export default router;
