// Opt-in integration against a supplied, trusted DSH runtime. No live desktop profile or model API.
import assert from 'node:assert/strict';
import { mkdtemp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as plugin from '../src/plugin.js';
import { testCompanion } from './test-companion.mjs';
const runtime = process.argv[2];
if (!runtime) throw Error('Usage: node scripts/test-host.mjs <trusted-runtime-node_modules>');
const load = name => import(pathToFileURL(join(resolve(runtime), '@deepseek-ai', name, 'lib/index.js')));
const { Context } = await load('cordis');
const { assertV4RowAdmission } = await load('dsh-session-format-v3-to-v4');
const names = ['dsh-session', 'dsh-session-projection', 'dsh-system-prompt', 'dsh-tools',
  'dsh-agent', 'dsh-session-query', 'dsh-sandbox-policy', 'dsh-agent-loop'];
const modules = await Promise.all(names.map(load));
const root = await realpath(await mkdtemp(join(tmpdir(), 'xsession-host-中文 space-')));
const ctx = new Context(), forks = [], handles = [];
let calls = 0, release, entered;
let gate = null;
ctx.provide('workspaceRegistry', { archivedSessionIds: [] });
ctx.provide('llm', { prepareCall: async config => ({ config, stream: async function* () {
  calls++; if (gate) { entered(); await gate; gate = null; }
  yield { type: 'text-delta', index: 0, text: 'Local test fixture. No external model.' };
  yield { type: 'finish', reason: { kind: 'stop' } };
} }) });
const exec = async (agent, name, args) => {
  const result = await ctx.tools.execute({ name, arguments: args, agent,
    signal: AbortSignal.timeout(10000), callId: `host-fixture-${calls}` });
  assert.equal(result.isError, false, JSON.stringify(result));
  return JSON.parse(result.value);
};
try {
  for (const { default: implementation } of modules.slice(0, 6)) forks.push(ctx.plugin(implementation, {}));
  forks.push(ctx.plugin(modules[6].default, { mode: 'workspace-write', workspaceRoot: root }));
  forks.push(ctx.plugin(modules[7].default, { agents: [], maxParallelToolCalls: 1 }));
  const pluginFork = ctx.plugin(plugin, {}); forks.push(pluginFork);
  await new Promise(setImmediate);
  assert.deepEqual(ctx.tools.schemas().map(t => t.name), ['xsession_list', 'xsession_send', 'xsession_inbox']);
  for (let n = 1; n <= 2; n++) handles.push(await ctx.agents.create({
    sessionId: `session-20000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    meta: { cwd: root }, agentOptions: { provider: 'fixture', model: 'fixture' }
  }));
  const [a, b] = handles.map(h => h.agent);
  modules[6].setSandboxMode(b.session, 'read-only');
  const first = await exec(a, 'xsession_send', { target: b.id, requestId: 'host-fixture-0001', message: 'Quiet context', delivery: 'inject' });
  assert.equal(first.status, 'accepted'); assert.equal(calls, 0); assert.equal(b.inbox.nextStep.length, 1);
  let enteredPromise = new Promise(r => { entered = r; });
  gate = new Promise(r => { release = r; });
  const wake = await exec(a, 'xsession_send', { target: b.id, requestId: 'host-fixture-0002', message: 'Wake' });
  assert.equal(wake.delivery, 'followup');
  await Promise.race([enteredPromise, new Promise((_, reject) => { const timer=setTimeout(()=>reject(Error('driver timeout')),5000);timer.unref(); })]);
  const running = await exec(a, 'xsession_send', { target: b.id, requestId: 'host-fixture-0003', message: 'Running update' });
  assert.equal(running.delivery, 'inject'); assert.equal(running.wakes, false);
  release(); await b.whenIdle();
  const events = (await ctx.sessionQuery.readSession(b.id)).events;
  for (const receipt of [first, wake, running]) {
    const event = events.find(e => e.type === 'user/message' && e.data.id === receipt.id);
    assert.ok(event, `missing model-surface message ${receipt.id}`);
    assert.deepEqual(event.data.source, { kind: 'plugin:dsh-xsession' });
    assert.doesNotThrow(() => assertV4RowAdmission(event));
    assert.throws(() => assertV4RowAdmission({ ...event, data: { ...event.data,
      source: { kind: 'plugin', plugin: 'dsh-xsession' } } }), /producer-owned source kind/);
  }
  const reply = await exec(b, 'xsession_send', { target: a.id, requestId: 'host-fixture-reply', message: 'Report is ready.', replyTo: wake.id });
  assert.equal(reply.hop, 1); await a.whenIdle();
  assert.equal(ctx.sandboxPolicy.resolve({ session: a.session }).mode, 'workspace-write');
  assert.equal(ctx.sandboxPolicy.resolve({ session: b.session }).mode, 'read-only');
  const inbox = await exec(a, 'xsession_inbox', {}); assert.equal(inbox.messages[0].id, reply.id);
  const before = calls;
  const duplicate = await exec(b, 'xsession_send', { target: a.id, requestId: 'host-fixture-reply', message: 'Report is ready.', replyTo: wake.id });
  assert.equal(duplicate.duplicate, true); assert.equal(calls, before);
  const listed = await exec(a, 'xsession_list', { titles: true }); assert.equal(listed.sessions[0].id, b.id);
  if (process.argv[3]) await testCompanion({ source: process.argv[3], ctx, root, a, b, exec });
  await pluginFork.dispose(); assert.equal(ctx.tools.schemas().length, 0);
  console.log(JSON.stringify({ result: 'PASS', platform: process.platform, node: process.version,
    realHost: ['Cordis', 'tools', 'agents', 'agent-loop', 'session', 'session-query', 'sandbox-policy'],
    fixtures: ['workspace archive registry', 'local LLM stream'], externalModelCalls: 0,
    verified: ['load', 'schema', 'inject-no-wake', 'idle-wake', 'running-inject', 'model-surface', 'reply', 'dedupe', 'titles', 'unchanged-file-policy', 'unload'] }));
} finally {
  release?.();
  for (const handle of handles.reverse()) await handle.dispose();
  for (const fork of forks.reverse()) await fork.dispose();
  await rm(root, { recursive: true, force: true });
}
