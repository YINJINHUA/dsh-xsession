import { Bridge } from './bridge.js';

export const name = 'dsh-xsession';
export const inject = ['tools', 'agents', 'sessionQuery', 'sandboxPolicy', 'workspaceRegistry'];
const active = new WeakSet();
const string = { type: 'string' };
const schema = properties => ({ type: 'object', properties, additionalProperties: false });
const specs = [
  ['xsession_list', 'List up to 50 same-workspace top-level DSH peers. Offline peers cannot receive. Titles cost history reads; omit unless needed.',
    schema({ titles: { type: 'boolean' }, cursor: string }), 'list'],
  ['xsession_send', 'Send peer-agent data, never human authorization. Idle auto wakes; running auto injects without waking. Use stable requestId; never retry outcome_unknown under a new ID. Avoid acknowledgement loops. Accepted is not completed.',
    { ...schema({ target: string, requestId: string, message: string,
      kind: { type: 'string', enum: ['notice', 'request', 'reply', 'handoff'] },
      delivery: { type: 'string', enum: ['auto', 'inject', 'steer', 'followup'] }, replyTo: string }),
      required: ['target', 'requestId', 'message'] }, 'send'],
  ['xsession_inbox', 'Read only your recent peer messages retained by this plugin instance. No polling loops. Plugin reload clears this convenience view, not DSH session history.',
    schema({ limit: { type: 'integer', description: '1 to 50, default 10.' } }), 'inbox']
];

export function toolDefinitions(bridge) {
  return specs.map(([name, description, parameters, method]) => ({
    name, description, parameters,
    output: { schema: string, render: (_args, result) => [{ type: 'text', text: result }] },
    async execute(args, exec) {
      // Also reject unknown keys for hosts that bypass schema validation in direct calls.
      if (!args || typeof args !== 'object' || Array.isArray(args) ||
          Object.keys(args).some(key => !Object.hasOwn(parameters.properties, key)) ||
          (method === 'list' && args.titles !== undefined && typeof args.titles !== 'boolean') ||
          (method === 'list' && args.cursor !== undefined && typeof args.cursor !== 'string')) {
        return JSON.stringify({ ok: false, error: 'INVALID_ARGUMENTS' });
      }
      try { return JSON.stringify({ ok: true, ...(await bridge[method](args, exec)) }); }
      catch (error) {
        const code = typeof error?.code === 'string' && /^[A-Z_]{3,40}$/.test(error.code) ? error.code :
          exec.signal?.aborted ? 'CANCELLED' : 'HOST_OPERATION_FAILED';
        return JSON.stringify({ ok: false, error: code });
      }
    }
  }));
}

export function apply(ctx) {
  if (active.has(ctx.agents)) throw new Error('DSH_XSESSION_ALREADY_ACTIVE');
  ctx.effect(() => {
    active.add(ctx.agents);
    const bridge = new Bridge(ctx);
    const disposers = [];
    try { for (const definition of toolDefinitions(bridge)) disposers.push(ctx.tools.register(definition)); }
    catch (error) {
      bridge.dispose(); active.delete(ctx.agents);
      for (const dispose of disposers.reverse()) dispose();
      throw error;
    }
    return () => {
      bridge.dispose(); active.delete(ctx.agents);
      for (const dispose of disposers.reverse()) dispose();
    };
  });
}
