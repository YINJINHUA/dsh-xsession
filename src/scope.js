import { realpath, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

export function fail(code) { throw Object.assign(new Error(code), { code }); }
export const validId = id => typeof id === 'string' && /^session-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
export function topLevel(header) {
  return header && validId(header.id) && header.origin !== 'subagent' &&
    (header.delegationDepth === undefined || header.delegationDepth === 0);
}
export async function rootOf(cwd) {
  if (typeof cwd !== 'string' || !isAbsolute(cwd)) fail('WORKSPACE_UNAVAILABLE');
  try {
    const path = await realpath(cwd);
    if (!(await stat(path)).isDirectory()) fail('WORKSPACE_UNAVAILABLE');
    return path;
  } catch { fail('WORKSPACE_UNAVAILABLE'); }
}
export function archived(ctx, id) {
  const ids = ctx.workspaceRegistry.archivedSessionIds;
  if (!Array.isArray(ids)) fail('HOST_CONTRACT_UNAVAILABLE');
  return ids.includes(id);
}
export async function identity(ctx, agent) {
  if (!agent || !validId(agent.id) || ctx.agents.get(agent.id) !== agent) fail('CALLER_UNAVAILABLE');
  if (!topLevel(agent.session?.header) || agent.session.header.id !== agent.id) fail('NOT_TOP_LEVEL');
  if (archived(ctx, agent.id)) fail('ARCHIVED_SESSION');
  const root = await rootOf(agent.session.header.cwd);
  const policy = ctx.sandboxPolicy.resolve({ session: agent.session });
  if (!['read-only', 'workspace-write', 'danger-full-access'].includes(policy?.mode)) fail('POLICY_UNAVAILABLE');
  if (await rootOf(policy.workspaceRoot) !== root) fail('WORKSPACE_MISMATCH');
  return { id: agent.id, root, mode: policy.mode };
}
export function resolveTarget(input, records) {
  if (typeof input !== 'string' || input.length > 64) fail('INVALID_TARGET');
  const needle = input.toLowerCase();
  let candidates = records.filter(row => row.header.id.toLowerCase() === needle);
  if (!candidates.length) {
    const prefix = needle.replace(/^session-/, '');
    if (!/^[0-9a-f]{8}[0-9a-f-]*$/i.test(prefix)) fail('INVALID_TARGET');
    candidates = records.filter(row => row.header.id.slice(8).toLowerCase().startsWith(prefix));
  }
  if (!candidates.length) fail('TARGET_NOT_FOUND');
  if (candidates.length !== 1) fail('AMBIGUOUS_TARGET');
  return candidates[0];
}
