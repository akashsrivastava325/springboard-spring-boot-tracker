import {NotebookSync} from './sync-engine.mjs';
import {createCommentStore} from './comments-store.mjs';
const $ = id => document.getElementById(id);
const app = window.notebookApp;
let engine, auth, sdk, user, timer, busy = false;
const config = window.SPRINGBOARD_FIREBASE_CONFIG;
const cacheKey = uid => 'springboard-sync-v1-' + uid;
const messages = {
  'auth/invalid-credential':'Email or password is incorrect.',
  'auth/email-already-in-use':'This email already has an account. Sign in or reset your password.',
  'auth/weak-password':'Choose a stronger password with at least 6 characters.',
  'auth/too-many-requests':'Too many attempts. Please try again later.',
  'auth/operation-not-allowed':'Enable Email/Password sign-in in Firebase Authentication.',
  'auth/network-request-failed':'Cannot reach Firebase. Check your connection.',
  'permission-denied':'Access denied. Check that the private Firestore rules have been published.'
};
function errorMessage(error) { return messages[error.code] || error.message || 'Please try again.'; }
function status(kind, error) {
  const labels = {synced:'Saved to your account',pending:'Saved locally · waiting to sync',error:'Not synced · '+errorMessage(error || {}),conflict:'Sync paused · choose a copy below'};
  $('cloudStatus').textContent=labels[kind] || kind;
  $('savestatus').textContent=kind==='synced'?'Saved to account':'Saved locally · '+(kind==='conflict'?'sync conflict':'sync pending');
  $('editorSave').textContent=$('cloudStatus').textContent;
  $('retrySync').hidden=!['error','pending'].includes(kind);
  $('syncConflict').hidden=kind!=='conflict';
}
function lock(locked) { document.querySelector('.layout').inert=locked; }
function saveCache(uid, value) {
  try {localStorage.setItem(cacheKey(uid),JSON.stringify(value));}
  catch(error) { $('cloudStatus').textContent='Local backup unavailable · keep this tab open until synced'; }
}
async function retry() {
  const target=engine,uid=user?.uid;if(!target || !uid)return;
  try {if(!target.ready) await target.start(JSON.parse(localStorage.getItem(cacheKey(uid)) || 'null'));else await target.flush();}
  catch(error){if(engine===target)status('error',error);}finally{if(engine===target)lock(false);}
}
async function setup() {
  if (!config?.apiKey || !config?.projectId || !config?.authDomain || !config?.appId) {
    $('cloudStatus').textContent='Cloud sync awaits Firebase setup';
    $('accountBtn').addEventListener('click',()=>{app.openAccount();$('accountMessage').textContent='Firebase is not configured yet. Your guest notebook still saves on this device.';});
    $('accountForm').addEventListener('submit',e=>e.preventDefault());
    return;
  }
  const version='12.4.0';
  const [firebase, authentication, firestore] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
  ]);
  sdk=authentication;
  const instance=firebase.initializeApp(config);
  auth=sdk.getAuth(instance);
  const db=firestore.getFirestore(instance);
  $('accountBtn').addEventListener('click',()=>{app.openAccount();$('accountMessage').textContent='';});
  sdk.onAuthStateChanged(auth,async current=>{
    clearTimeout(timer);engine=null;user=current;window.accountSyncActive=!!current;
    window.SpringboardComments?.setAccount(current?{uid:current.uid,name:(current.displayName||current.email?.split('@')[0]||'You').slice(0,80)}:null,current?createCommentStore({firestore,db,uid:current.uid}):null);
    app.switchAccount(current?.uid);
    $('accountBtn').hidden=!!current;$('signOutBtn').hidden=!current;
    $('migrateGuest').hidden=true;$('syncConflict').hidden=true;$('retrySync').hidden=true;
    $('accountLabel').textContent=current?current.email:'Guest notebook · this device only';
    if(!current){lock(false);$('cloudStatus').textContent='';$('savestatus').textContent='Saved on this device';return;}
    lock(true);$('cloudStatus').textContent='Loading your account…';
    const uid=current.uid;let sessionEngine;
    const active=()=>user?.uid===uid && engine===sessionEngine;
    const ref=firestore.doc(db,'users',uid,'notebooks','main');
    const read=async()=>{
      const snap=await firestore.getDocFromServer(ref);
      if(!active())throw new Error('Account changed.');
      if(!snap.exists())return {revision:0,notebook:null};
      const data=snap.data();return {revision:data.revision,notebook:app.validate(JSON.parse(data.payload))};
    };
    sessionEngine=new NotebookSync({read,apply:value=>{if(active())app.apply(value);},status:(...args)=>{if(active())status(...args);},cache:value=>{if(active())saveCache(uid,value);},write:async(notebook,revision)=>{
      const payload=JSON.stringify(notebook);
      if(new TextEncoder().encode(payload).length>900000)throw new Error('Notebook exceeds the 900 KB cloud limit. Export a backup and shorten notes before retrying.');
      return firestore.runTransaction(db,async transaction=>{
        const snap=await transaction.get(ref),actual=snap.exists()?snap.data().revision:0;
        if(actual!==revision){const error=new Error('Another device saved changes.');error.code='sync/conflict';throw error;}
        transaction.set(ref,{payload,revision:revision+1,updatedAt:firestore.serverTimestamp()});
        return revision+1;
      });
    }});
    engine=sessionEngine;
    await retry();
    if(active())$('migrateGuest').hidden=false;
  });
  $('accountForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;busy=true;
    const buttons=[...$('accountForm').querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
    try{
      const email=$('accountEmail').value.trim(),password=$('accountPassword').value;
      await (event.submitter?.name==='create'?sdk.createUserWithEmailAndPassword(auth,email,password):sdk.signInWithEmailAndPassword(auth,email,password));
      $('accountPassword').value='';$('accountDialog').close();
    }catch(error){$('accountMessage').textContent=errorMessage(error);}
    finally{busy=false;buttons.forEach(b=>b.disabled=false);}
  });
  $('resetPassword').addEventListener('click',async()=>{
    if(!$('accountEmail').reportValidity())return;
    try{await sdk.sendPasswordResetEmail(auth,$('accountEmail').value.trim());$('accountMessage').textContent='If this email has an account, check its inbox for reset instructions.';}
    catch(error){$('accountMessage').textContent=errorMessage(error);}
  });
  $('signOutBtn').addEventListener('click',async()=>{
    if(busy)return;busy=true;lock(true);
    try{
      await engine?.flush();
      if(engine?.pending){status(engine.conflict?'conflict':'error',new Error('Save or resolve your pending changes before signing out.'));return;}
      await sdk.signOut(auth);
    }catch(error){status('error',error);}finally{busy=false;lock(false);}
  });
  $('migrateGuest').addEventListener('click',()=>{
    if(!engine?.ready)return;
    if(confirm('Replace this account’s notebook with the guest notebook on this device? Export your account notebook first if you want to keep both.'))app.replace(app.guest());
  });
  $('retrySync').addEventListener('click',retry);
  for(const [id,useLocal] of [['useCloud',false],['useLocal',true]])$(id).addEventListener('click',async()=>{
    if(!confirm(useLocal?'Replace the cloud notebook with this device’s copy?':'Discard pending edits here and load the cloud copy?'))return;
    try{await engine.resolve(useLocal);}catch(error){status('error',error);}
  });
  // Refresh while the app is open without disturbing an active note editor.
  setInterval(async()=>{
    if(!engine?.ready || document.hidden || document.querySelector('dialog[open]'))return;
    try{if(engine.pending)await engine.flush();else await engine.refresh();}catch(error){status('error',error);}
  },15000);
}
window.addEventListener('notebook-edited',event=>{
  if(!engine)return;engine.edit(event.detail);clearTimeout(timer);timer=setTimeout(()=>engine?.flush(),800);
});
window.addEventListener('online',()=>{if(engine)retry();});
window.addEventListener('beforeunload',event=>{if(engine?.pending){event.preventDefault();event.returnValue='';}});
setup().catch(error=>{$('cloudStatus').textContent='Cloud unavailable · '+errorMessage(error);});
