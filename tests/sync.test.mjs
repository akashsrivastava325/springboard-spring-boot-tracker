import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NotebookSync} from '../sync-engine.mjs';
function fixture(remote={revision:0,notebook:null}){
 const f={remote,applied:null,cached:null,status:null};
 f.engine=new NotebookSync({read:async()=>structuredClone(f.remote),write:async(notebook,revision)=>{
  if(revision!==f.remote.revision)throw Object.assign(new Error('conflict'),{code:'sync/conflict'});
  f.remote={revision:revision+1,notebook};return revision+1;
 },apply:n=>f.applied=n,status:s=>f.status=s,cache:c=>f.cached=structuredClone(c)});return f;
}
test('saves and loads across devices',async()=>{const f=fixture();await f.engine.start();f.engine.edit({answer:'Spring'});await f.engine.flush();const g=fixture(f.remote);await g.engine.start();assert.deepEqual(g.applied,{answer:'Spring'});assert.equal(f.engine.pending,null);});
test('stale device preserves local edits and refuses overwrite',async()=>{const f=fixture();await f.engine.start();f.engine.edit({answer:'local'});f.remote={revision:1,notebook:{answer:'phone'}};await f.engine.flush();assert.equal(f.status,'conflict');assert.deepEqual(f.remote.notebook,{answer:'phone'});assert.deepEqual(f.cached.pending,{answer:'local'});});
test('reload restores unsynced edits and detects cloud conflict',async()=>{const f=fixture({revision:3,notebook:{answer:'phone'}});await f.engine.start({revision:2,pending:{answer:'local'}});assert.equal(f.status,'conflict');assert.deepEqual(f.engine.pending,{answer:'local'});});
test('explicit conflict choices preserve the chosen copy',async()=>{for(const local of [true,false]){const f=fixture({revision:2,notebook:{answer:'phone'}});await f.engine.start({revision:1,pending:{answer:'local'}});await f.engine.resolve(local);assert.equal(f.engine.pending,null);assert.equal(local?f.remote.notebook.answer:f.applied.answer,local?'local':'phone');}});
test('network errors keep edits available to retry',async()=>{const f=fixture();await f.engine.start();const write=f.engine.write;f.engine.write=async()=>{throw new Error('offline')};f.engine.edit({answer:'offline'});await f.engine.flush();assert.equal(f.status,'error');assert.deepEqual(f.cached.pending,{answer:'offline'});f.engine.write=write;await f.engine.flush();assert.equal(f.status,'synced');});
test('edit during a save stays pending for the next write',async()=>{const f=fixture();await f.engine.start();const write=f.engine.write;let release;f.engine.write=async(...args)=>{await new Promise(r=>release=r);return write(...args)};f.engine.edit({answer:'first'});const saving=f.engine.flush();f.engine.edit({answer:'second'});release();await saving;assert.deepEqual(f.engine.pending,{answer:'second'});f.engine.write=write;await f.engine.flush();assert.equal(f.remote.notebook.answer,'second');});

test('restores pending notebook content before attempting network access',async()=>{const f=fixture();f.engine.read=async()=>{throw new Error('offline')};await assert.rejects(f.engine.start({revision:1,pending:{answer:'recovered'}}));assert.deepEqual(f.applied,{answer:'recovered'});});
