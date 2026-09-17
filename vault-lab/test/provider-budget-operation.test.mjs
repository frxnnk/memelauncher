import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBudgetFlag, TARGET } from '../scripts/prepare-provider-budget.mjs';

const key = () => ({...TARGET, disabled:false, include_byok_in_limit:false,
  limit_remaining:4.99, expires_at:null, workspace_id:'fixture'});
test('budget preparation changes only the reviewed BYOK flag and verifies the original cap', async () => {
  const state=key(), calls=[];
  const fetchImpl=async (url, init) => {
    assert.equal(url, `https://openrouter.ai/api/v1/keys/${TARGET.hash}`);
    calls.push(init.method);
    if(init.method==='PATCH') { assert.deepEqual(JSON.parse(init.body), {include_byok_in_limit:true}); state.include_byok_in_limit=true; }
    return Response.json({data:state});
  };
  const result=await applyBudgetFlag({managementKey:'fixture',fetchImpl});
  assert.deepEqual(calls,['GET','PATCH','GET']);
  assert.deepEqual(result.budget,{limit:5,remaining:4.99,reset:null,includesByok:true});
  calls.length=0;
  assert.equal((await applyBudgetFlag({managementKey:'fixture',fetchImpl})).changed,false);
  assert.deepEqual(calls,['GET','GET']);
});
test('budget operation refuses wrong, enlarged, resetting or disabled keys before any mutation', async () => {
  for(const invalid of [{name:'Other'}, {hash:'other'}, {limit:10}, {limit_reset:'daily'}, {disabled:true}]) {
    let calls=0;
    await assert.rejects(applyBudgetFlag({managementKey:'fixture',fetchImpl:async (url,init) => {
      calls++; assert.equal(init.method,'GET'); return Response.json({data:{...key(),...invalid}});
    }}), /reviewed key/);
    assert.equal(calls,1);
  }
});
