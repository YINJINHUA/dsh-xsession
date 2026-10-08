import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Bridge } from '../src/bridge.js';
export const id = n => `session-10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'dsh-xsession-'));
  const root = join(base, '项目 with space'); const other = join(base, 'other');
  await mkdir(root); await mkdir(other);
  const agents = new Map(), headers = new Map(), archive = [], calls = [], titleReads = [];
  const ctx = {
    agents: { get: key => agents.get(key) },
    workspaceRegistry: { archivedSessionIds: archive },
    sandboxPolicy: { resolve: ({session}) => ({mode: session.mode ?? 'workspace-write', workspaceRoot: session.header.cwd}) },
    sessionQuery: {
      listSessions: async () => [...headers.values()].map(header => ({header, live: agents.has(header.id)})),
      readTitleSnapshots: async ids => { titleReads.push(ids); return ids.map(sessionId => ({sessionId, status:'fulfilled', value:{ title:'Peer', session:headers.get(sessionId)}})); }
    }
  };
  function add(n, options = {}) {
    const header = { id:id(n), cwd:root, ...options };
    const agent = { id:header.id, session:{header}, status:'idle',
      followup: message => { calls.push({mode:'followup', message}); },
      inject: message => { calls.push({mode:'inject', message}); },
      steer: message => { calls.push({mode:'steer', message}); }
    };
    agents.set(agent.id, agent); headers.set(agent.id, header); return agent;
  }
  const a=add(1), b=add(2); let clock=100000;
  const bridge=new Bridge(ctx, {now:()=>clock});
  t.after(async()=>{bridge.dispose();await rm(base,{recursive:true,force:true});});
  return {base,root,other,ctx,agents,headers,archive,calls,titleReads,add,a,b,bridge,
    exec:{agent:a}, tick:()=>{clock+=61000;}, args:(extras={})=>({target:b.id,requestId:'request-0001',message:'Please read the plan.',...extras})};
}
