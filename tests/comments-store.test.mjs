import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCommentStore} from '../comments-store.mjs';
function fixture(uid='owner'){
 const documents=new Map([['users/owner/notebooks/main',{payload:'EXISTING ANSWERS — DO NOT TOUCH',revision:42}]]),writes=[];
 let onSnapshot;
 const fs={collection:(_,...parts)=>parts.join('/'),doc:(collection,id)=>collection+'/'+id,where:(...args)=>args,query:(...args)=>args,
 serverTimestamp:()=>1234,onSnapshot:(_query,next)=>{onSnapshot=next;return ()=>{};},
 runTransaction:async(_db,callback)=>callback({get:async ref=>({exists:()=>documents.has(ref),data:()=>documents.get(ref)}),set:(ref,value)=>{writes.push(ref);documents.set(ref,value);}})};
 return {store:createCommentStore({firestore:fs,db:{},uid}),documents,writes,emit:docs=>onSnapshot({docs,metadata:{fromCache:false}})};
}
const input={id:'stable-id',questionId:'q001',text:'Remember constructor injection.',authorName:'Akash'};
test('comment posting leaves the existing notebook byte-for-byte unchanged',async()=>{const f=fixture();const before=JSON.stringify(f.documents.get('users/owner/notebooks/main'));await f.store.post(input);assert.equal(JSON.stringify(f.documents.get('users/owner/notebooks/main')),before);assert.deepEqual(f.writes,['users/owner/questionComments/stable-id']);});
test('retrying the same comment ID never adds a duplicate',async()=>{const f=fixture();await f.store.post(input);await f.store.post(input);assert.equal(f.writes.length,1);});
test('a retry cannot overwrite an existing comment',async()=>{const f=fixture();await f.store.post(input);await assert.rejects(f.store.post({...input,text:'changed'}));assert.equal(f.documents.get('users/owner/questionComments/stable-id').text,input.text);});
test('account and question paths are isolated',async()=>{const f=fixture('second-account');await f.store.post({...input,questionId:'custom-abcd'});assert.equal(f.writes[0],'users/second-account/questionComments/stable-id');assert.equal(f.documents.get('users/owner/notebooks/main').revision,42);});
test('empty, oversized and unsupported comments are rejected before any write',async()=>{for(const value of [{text:' '},{text:'x'.repeat(5001)},{questionId:'../notebooks/main'},{id:'bad/id'}]){const f=fixture();await assert.rejects(f.store.post({...input,...value}));assert.equal(f.writes.length,0);}});
test('comments arrive in timestamp order, with pending timestamps last',()=>{const f=fixture();let result;f.store.subscribe('q001',items=>result=items,()=>{});f.emit([{id:'b',data:()=>({text:'later',createdAt:{toMillis:()=>200}})},{id:'c',data:()=>({text:'pending'})},{id:'a',data:()=>({text:'first',createdAt:{toMillis:()=>100}})}]);assert.deepEqual(result.map(x=>x.text),['first','later','pending']);});
