import assert from 'assert';

const base = 'http://localhost:3000';

async function post(path, body, token) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: `Bearer ${token}` } : {}),
    body: JSON.stringify(body)
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function get(path, token) {
  const res = await fetch(base + path, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function run() {
  console.log('Logging in as Alice...');
  const loginA = await post('/auth/login', { email: 'alice@example.com', password: 'password123' });
  console.log('Alice login:', loginA);
  assert(loginA.status === 200 && loginA.body && loginA.body.access_token, 'Alice login failed');
  const aToken = loginA.body.access_token;

  console.log('\nListing Alice notes...');
  const notesA = await get('/notes', aToken);
  console.log('Alice notes:', notesA);

  console.log('\nCreating a note for Alice...');
  const create = await post('/notes', { title: 'Smoke Note', content: 'Created by smoke test' }, aToken);
  console.log('Create:', create);
  assert(create.status === 201 && create.body && create.body.id, 'Create failed');
  const noteId = create.body.id;

  console.log(`\nGet created note ${noteId}...`);
  const getNote = await get(`/notes/${noteId}`, aToken);
  console.log('Get note:', getNote);

  console.log('\nShare note with bob@example.com');
  const share = await post(`/notes/${noteId}/share`, { share_with_email: 'bob@example.com' }, aToken);
  console.log('Share:', share);

  console.log('\nLogging in as Bob...');
  const loginB = await post('/auth/login', { email: 'bob@example.com', password: 'password123' });
  console.log('Bob login:', loginB);
  assert(loginB.status === 200 && loginB.body && loginB.body.access_token, 'Bob login failed');
  const bToken = loginB.body.access_token;

  console.log(`\nBob fetching shared note ${noteId}...`);
  const bobGet = await get(`/notes/${noteId}`, bToken);
  console.log('Bob get:', bobGet);

  console.log('\nSmoke test completed');
}

run().catch(err => { console.error('Smoke test failed:', err); process.exit(1); });
