import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { releasePlan, requireGreenChecks, publishAction, requiredJobs, repository, packageName } from '../scripts/release-plan.mjs';
const sha='a'.repeat(40), integrity='sha512-fixture';
function fixture(version='0.1.0-alpha.3',prerelease=true){
 return {event:{action:'published',repository:{full_name:repository,private:false},release:{id:5,draft:false,prerelease,tag_name:'v'+version}},
 manifest:{name:packageName,version,repository:{url:`git+https://github.com/${repository}.git`}}};
}
test('release channels and exact version/repository gates',()=>{
 let f=fixture();assert.equal(releasePlan(f.event,f.manifest,sha).channel,'next');
 f=fixture('0.1.0',false);assert.equal(releasePlan(f.event,f.manifest,sha).channel,'latest');
 for(const mutate of [f=>f.event.release.draft=true,f=>f.event.repository.private=true,
  f=>f.event.repository.full_name='other/repository',f=>f.event.action='edited',
  f=>f.event.release.tag_name='v9.0.0',f=>f.manifest.name='other']){
  f=fixture();mutate(f);assert.throws(()=>releasePlan(f.event,f.manifest,sha));
 }
 f=fixture();f.event.release.prerelease=false;assert.throws(()=>releasePlan(f.event,f.manifest,sha));
});
test('only exact-commit default-branch latest successful CI with every required job is accepted',()=>{
 const run={id:1,run_number:1,head_sha:sha,head_repository:{full_name:repository},head_branch:'main',event:'push',path:'.github/workflows/test.yml',status:'completed',conclusion:'success'};
 const jobs=requiredJobs.map(name=>({name,run_id:1,status:'completed',conclusion:'success'}));
 assert.equal(requireGreenChecks([run],jobs,sha,'main').id,1);
 for(const mutate of [r=>r.head_sha='b'.repeat(40),r=>r.head_branch='feature',r=>r.event='pull_request',
  r=>r.head_repository={full_name:'fork/repo'},r=>r.status='in_progress',r=>r.conclusion='failure']){
  const r=structuredClone(run);mutate(r);assert.throws(()=>requireGreenChecks([r],jobs,sha,'main'));
 }
 assert.throws(()=>requireGreenChecks([run],jobs.slice(1),sha,'main'));
 assert.throws(()=>requireGreenChecks([run],jobs.map((j,i)=>i?j:{...j,conclusion:'skipped'}),sha,'main'));
 assert.throws(()=>requireGreenChecks([run,{...run,id:2,run_number:2,conclusion:'failure'}],jobs,sha,'main'));
});
test('publish retries verify exact bytes and promotion never rolls latest back',()=>{
 const f=fixture(),p=releasePlan(f.event,f.manifest,sha);
 assert.equal(publishAction({},p,integrity),'publish');
 const meta={versions:{[p.version]:{dist:{integrity}}},'dist-tags':{next:p.version}};
 assert.equal(publishAction(meta,p,integrity),'verify');
 assert.throws(()=>publishAction(meta,p,'sha512-different'));
 const stable=fixture('0.1.0',false),s=releasePlan(stable.event,stable.manifest,sha);
 assert.equal(publishAction({versions:{[s.version]:{dist:{integrity}}}},s,integrity),'tag');
 assert.throws(()=>publishAction({'dist-tags':{latest:'0.2.0'}},s,integrity));
});
test('workflow uses a published Release, OIDC, immutable actions and explicit CI matrix names',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/publish.yml',import.meta.url),'utf8');
 assert.match(workflow,/types: \[published\]/);assert.match(workflow,/id-token: write/);
 assert.doesNotMatch(workflow,/NPM_TOKEN|NODE_AUTH_TOKEN|pull_request_target/);
 for(const use of workflow.matchAll(/uses: ([^\s]+)/g))assert.match(use[1],/@[a-f0-9]{40}$/);
 const ci=readFileSync(new URL('../.github/workflows/test.yml',import.meta.url),'utf8');
 assert.match(ci,/name: test \(\$\{\{ matrix.os \}\}, \$\{\{ matrix.node \}\}\)/);
});
