import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { privatePatterns } from './release-rules.mjs';
import { repository, packageName } from './release-plan.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = new Set(['.github','.gitignore','src','test','scripts','docs','locale',
  'README.md','README.en.md','LICENSE','package.json','cordis.patch.yml']);
let count=0;
function inspect(dir) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(dir===root && entry.name==='.git') continue;
    if(dir===root) assert.ok(allowed.has(entry.name),'unexpected public root entry: '+entry.name);
    const file=path.join(dir,entry.name),st=fs.lstatSync(file);
    assert.ok(!st.isSymbolicLink(),'symlink in public tree');
    if(st.isDirectory()){inspect(file);continue;}
    assert.ok(st.isFile() && st.size<=262144,'non-regular or oversized file');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(file));
    assert.ok(!text.includes('\0'),'binary public file');
    for(const pattern of privatePatterns)assert.ok(!pattern.test(text),'possible private data in '+path.relative(root,file));
    const ids=text.match(/(?:session-)?[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi)||[];
    for(const id of ids)assert.match(id,/^(?:session-)?(?:[12]0000000-0000|abcdef01-abcd)-4000-8000-0000000000\d\d$/i,'non-fixture session ID');
    count++;
  }
}
inspect(root);
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
assert.equal(pkg.name,packageName);assert.equal(pkg.license,'MIT');
assert.equal(pkg.repository.url,`git+https://github.com/${repository}.git`);
assert.deepEqual(pkg.publishConfig,{registry:'https://registry.npmjs.org/',access:'public'});
for(const kind of ['dependencies','devDependencies','optionalDependencies'])assert.equal(Object.keys(pkg[kind]||{}).length,0);
for(const name of ['preinstall','install','postinstall','prepare'])assert.equal(pkg.scripts[name],undefined);
for(const doc of ['README.md','README.en.md'])assert.ok(fs.readFileSync(path.join(root,doc),'utf8').includes(pkg.version),'README version mismatch');
console.log(JSON.stringify({status:'PASS',files:count,note:'Targeted public-tree hygiene, not a proof of absence of every secret.'}));
