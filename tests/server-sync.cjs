// Esegui dalla root del repository: node tests/server-sync.cjs
// Richiede soltanto le dipendenze npm installate; nessun database o servizio esterno.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS isolates the transpiled server modules without a separate build. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const repo = path.resolve(__dirname, '..');
const requireFromRepo = createRequire(path.join(repo, 'package.json'));
const ts = requireFromRepo('typescript');
const cache = new Map();
let databaseFails = false;
let databaseCalls = 0;
function load(file) {
  const absolute = path.resolve(repo, file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const loadedModule = { exports: {} };
  cache.set(absolute, loadedModule);
  const javascript = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const localRequire = (id) => {
    if (id === '@/app/lib/mongoose') return { connectDB: async () => {
      databaseCalls++;
      if (databaseFails) throw new Error('Simulated connection failure');
    }};
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
    return requireFromRepo(id);
  };
  new Function('require', 'module', 'exports', javascript)(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
(async () => {
  const modelModule = load('app/models/avvistamenti.ts');
  const { AvvistamentoModel: Model } = modelModule;
  const { POST } = load('app/api/avvistamenti/sync/route.ts');
  const valid = { clientId: 'offline-id-1', specie: 'Cervo', tipologia: 'Adulto', sesso: 'Maschio', posizione: { lat: 46, lng: 11 }, timestamp: '2026-10-22T10:00:00.000Z' };
  const { clientId, ...historical } = valid;
  await new Model(historical).validate();
  assert.equal(new Model(historical).clientRevision, 0);
  assert.equal(new Model(valid).clientId, clientId);
  const [[keys, options]] = Model.schema.indexes();
  assert.deepEqual(keys, { clientId: 1 });
  assert.equal(options.unique, true);
  assert.deepEqual(options.partialFilterExpression, { clientId: { $type: 'string' } });

  let indexCalls = 0;
  Model.createIndexes = async () => {
    if (++indexCalls === 1) throw new Error('Simulated index setup failure');
  };
  await assert.rejects(modelModule.ensureAvvistamentoSyncIndex());
  await Promise.all([modelModule.ensureAvvistamentoSyncIndex(), modelModule.ensureAvvistamentoSyncIndex()]);
  assert.equal(indexCalls, 2, 'failed index creation is retried and successful setup is shared');

  const documents = new Map();
  let duplicateNext = false;
  let writeFails = false;
  let writes = 0;
  Model.findOne = async ({ clientId }) => documents.get(clientId) ?? null;
  Model.findOneAndUpdate = async (filter, update, options) => {
    writes++;
    if (writeFails) throw new Error('Simulated timeout');
    let record = documents.get(filter.clientId);
    if (duplicateNext) {
      duplicateNext = false;
      record = { _id: 'database-id-2', clientId: filter.clientId };
      documents.set(filter.clientId, record);
      throw Object.assign(new Error('Duplicate key'), { code: 11000 });
    }
    const matchesRevision = !filter.$or || filter.$or.some(({ clientRevision }) => (
      '$lt' in clientRevision
        ? record?.clientRevision !== undefined && record.clientRevision < clientRevision.$lt
        : record?.clientRevision === undefined
    ));
    if (record && !matchesRevision) {
      if (options.upsert) throw Object.assign(new Error('Duplicate key'), { code: 11000 });
      return null;
    }
    if (!record && options.upsert) record = { _id: 'database-id-1', clientId: filter.clientId };
    if (!record) return null;
    Object.assign(record, update.$set);
    documents.set(filter.clientId, record);
    return record;
  };
  const post = async (body) => {
    const response = await POST(new Request('http://localhost/api/avvistamenti/sync', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json() };
  };
  let response = await post({ avvistamenti: [{ ...valid, _id: 'untrusted-id', createdAt: '1999-01-01', syncStatus: 'pending' }] });
  assert.equal(response.status, 207);
  assert.equal(response.body.sincronizzati, 1);
  documents.get(clientId).sesso = 'Indeterminato'; // Correzione successiva da dashboard.
  response = await post({ avvistamenti: [valid] });
  assert.equal(response.body.sincronizzati, 1);
  assert.equal(documents.get(clientId).sesso, 'Indeterminato', 'retry of the same revision preserves later dashboard edits');
  response = await post({ avvistamenti: [{ ...valid, clientRevision: 1, sesso: 'Femmina' }] });
  assert.equal(documents.size, 1, 'replaying a client id does not create a second sighting');
  assert.equal(documents.get(clientId).sesso, 'Femmina', 'edited pending sightings update the same document');
  assert.equal(documents.get(clientId)._id, 'database-id-1');
  assert.equal(documents.get(clientId).createdAt, undefined);
  assert.equal(documents.get(clientId).syncStatus, undefined);

  response = await post({ avvistamenti: [{ ...valid, clientRevision: 3, sesso: 'Indeterminato' }] });
  assert.equal(response.body.sincronizzati, 1);
  response = await post({ avvistamenti: [{ ...valid, clientRevision: 2, sesso: 'Maschio' }] });
  assert.equal(response.body.sincronizzati, 1, 'outdated requests are acknowledged against the current document');
  assert.equal(documents.get(clientId).sesso, 'Indeterminato', 'late responses cannot overwrite a newer revision');
  assert.equal(documents.get(clientId).clientRevision, 3);
  response = await post({ avvistamenti: [valid] });
  assert.equal(response.body.sincronizzati, 1);
  assert.equal(documents.get(clientId).clientRevision, 3, 'legacy clients cannot overwrite a newer revision');

  documents.set('legacy-record', { _id: 'legacy-database-id', clientId: 'legacy-record', sesso: 'Maschio' });
  response = await post({ avvistamenti: [{ ...valid, clientId: 'legacy-record', sesso: 'Femmina' }] });
  assert.equal(response.body.sincronizzati, 1);
  assert.equal(documents.get('legacy-record').sesso, 'Maschio', 'missing stored revisions count as zero for legacy retries');
  response = await post({ avvistamenti: [{ ...valid, clientId: 'legacy-record', clientRevision: 1, sesso: 'Femmina' }] });
  assert.equal(response.body.sincronizzati, 1);
  assert.equal(documents.get('legacy-record').clientRevision, 1, 'stored documents without a revision can be updated');

  duplicateNext = true;
  response = await post({ avvistamenti: [{ ...valid, clientId: 'concurrent-id' }] });
  assert.equal(response.body.sincronizzati, 1, 'a concurrent insert is recovered');
  assert.equal(response.body.risultati[0].id, 'database-id-2');

  const previousWrites = writes;
  response = await post({ avvistamenti: [{ ...valid, specie: 'INVALID' }, { clientId: 'missing-fields' }, { ...valid, clientId: 42 }, null] });
  assert.equal(response.body.falliti, 4);
  assert(response.body.risultati.every((r) => r.status === 'error' && r.retryable === false));
  assert.equal(writes, previousWrites, 'invalid sightings never reach database writes');

  for (const clientRevision of [-1, 1.5, '1', null, Number.MAX_SAFE_INTEGER + 1]) {
    response = await post({ avvistamenti: [{ ...valid, clientRevision }] });
    assert.equal(response.body.risultati[0].retryable, false);
    assert.equal(response.body.risultati[0].status, 'error');
  }
  assert.equal(writes, previousWrites, 'invalid revisions never reach database writes');

  writeFails = true;
  response = await post({ avvistamenti: [valid] });
  assert.equal(response.body.risultati[0].retryable, true);
  writeFails = false;
  databaseFails = true;
  const previousConnections = databaseCalls;
  response = await post({ invalid: true });
  assert.equal(response.status, 400);
  assert.equal(databaseCalls, previousConnections, 'malformed batches are rejected without touching the database');
  const originalError = console.error;
  try {
    console.error = () => {};
    response = await post({ avvistamenti: [valid] });
  } finally { console.error = originalError; }
  assert.equal(response.status, 503);
  assert.equal(response.body.retryable, true);
  console.log('PASS: schema legacy/index, index retry, repeated/edited sync, equal/reordered revisions, concurrent insert recovery, invalid input, transient errors, DB outage.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
