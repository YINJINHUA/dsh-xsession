// Optional isolated compatibility probe. All bridge state and transport endpoints are temporary.
import assert from 'node:assert/strict';
import { mkdtemp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
export async function testCompanion({ source, ctx, root, a, b, exec }) {
  const load = file => import(pathToFileURL(join(resolve(source), file)));
  const { register, projectConfig } = await load('lib/config.mjs');
  const { start } = await load('plugin/index.mjs');
  const { exchange } = await load('lib/transport.mjs');
  const { createUserMessage } = await import(pathToFileURL(join(resolve(process.argv[2]), '@deepseek-ai/dsh-llm/lib/index.js')));
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'xsc-')));
  const base = join(dir, 'state'); let stop;
  // Only these controller/archive adapters are fixtures; routing, IPC and agent loop are real code.
  ctx.workspaceRegistry.resolveByPath = async path => path === root ? { id: 'fixture-workspace', sessionIds: [a.id, b.id] } : undefined;
  const accepted = new Set();
  ctx.provide('sessionController', {
    prompt: async request => {
      if (!accepted.has(request.requestId)) {
        ctx.agents.get(request.sessionId).followup(createUserMessage({ content: request.content,
          source: { kind: 'user', rpcId: request.requestId } }));
        accepted.add(request.requestId);
      }
      return { accepted: true };
    },
    projections: async ({ sessionId }) => ({ asOfSeq: (await ctx.sessionQuery.readSession(sessionId)).events.at(-1).seq }),
    page: async ({ address }) => ({ records: (await ctx.sessionQuery.readSession(address.sessionId)).events.map(event => ({ type: 'event', event })), hasMore: false })
  });
  try {
    register(base, 'fixture', [root]);
    const revision = projectConfig(base, 'fixture').revision;
    stop = await start(ctx, base);
    const common = { project: 'fixture', session: a.id, revision };
    const inbound = await exchange(base, { ...common, op: 'send', id: randomUUID(), text: 'Relay fixture plan to worker.' });
    assert.equal(inbound.value.accepted, true); await a.whenIdle();
    const forwarded = await exec(a, 'xsession_send', { target: b.id, requestId: 'companion-forward-0001', message: 'Plan document ready.' });
    assert.equal(forwarded.status, 'accepted'); await b.whenIdle();
    const returned = await exec(b, 'xsession_send', { target: a.id, requestId: 'companion-return-0001', message: 'Report document ready.', replyTo: forwarded.id });
    assert.equal(returned.status, 'accepted'); await a.whenIdle();
    const result = await exchange(base, { ...common, op: 'result', id: randomUUID() });
    assert.equal(result.value.loaded, true); assert.match(result.value.latestTurn.text, /Local test fixture/);
    console.log(JSON.stringify({ companion: 'PASS', platform: process.platform,
      transport: process.platform === 'win32' ? 'named-pipe-worker' : 'unix-socket',
      scope: 'cross-app bridge IPC → DSH coordinator → xsession worker → coordinator → bridge result',
      fixtures: ['sessionController adapter', 'workspace membership adapter', 'LLM stream'], externalModelCalls: 0 }));
  } finally { if (stop) await stop(); await rm(dir, { recursive: true, force: true }); }
}
