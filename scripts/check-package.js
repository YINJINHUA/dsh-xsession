import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = process.env.npm_execpath;
if (!cli) throw Error('Run with npm run check:package');
const result = JSON.parse(execFileSync(process.execPath, [cli, 'pack', '--dry-run', '--json', '--ignore-scripts'],
  { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 }))[0];
const files = result.files.map(f => f.path).sort();
for (const file of files) {
  assert.match(file, /^(src\/[a-z-]+\.js|locale\/(en|zh)\.json|docs\/[A-Z]+\.md|README(?:\.en)?\.md|LICENSE|package\.json|cordis\.patch\.yml)$/);
  const text = readFileSync(resolve(root, file), 'utf8');
  assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|[A-Z]:\\(?:Users|AppWorks)\\|192\.168\.|session-[0-9a-f]{8}-/i, `local information in ${file}`);
}
for (const required of ['src/plugin.js', 'src/bridge.js', 'src/scope.js', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json', 'README.md', 'README.en.md', 'LICENSE']) assert.ok(files.includes(required), `missing ${required}`);
assert.ok(result.unpackedSize < 100000, 'unexpected package growth');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
assert.equal(pkg.name, 'dsh-xsession');
assert.equal(pkg.license, 'MIT');
assert.deepEqual(pkg.dependencies ?? {}, {});
for (const name of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublishOnly']) assert.equal(pkg.scripts?.[name], undefined);
for (const language of ['en', 'zh']) assert.ok(JSON.parse(readFileSync(resolve(root, 'locale', language + '.json'))).meta.description);
console.log(JSON.stringify({name:result.name,version:result.version,files:files.length,unpackedSize:result.unpackedSize,status:'PASS'}));
