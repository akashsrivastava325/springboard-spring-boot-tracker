/* Private, per-question comment threads. No notebook state is changed here. */
(function(){
  const $=id=>document.getElementById(id),dialog=$('commentsDialog');
  let account=null,store=null,questionId=null,unsubscribe=null,epoch=0,posting=false;
  const drafts=new Map(),pending=new Map();
  const key=(uid,id)=>'springboard-comment-draft-v1-'+uid+'-'+id;
  function message(text){$('commentStatus').textContent=text;}
  function draft(){
    if(!account || !questionId)return null;
    const k=key(account.uid,questionId);
    if(drafts.has(k))return drafts.get(k);
    let value;
    try{value=JSON.parse(localStorage.getItem(k)||'null');}catch(e){/* A new draft is safe; no existing comments are altered. */}
    if(!value || typeof value.id!=='string' || typeof value.text!=='string')value={id:crypto.randomUUID(),text:''};
    drafts.set(k,value);return value;
  }
  function remember(value,uid=account?.uid,id=questionId){
    if(!uid||!id)return;
    const k=key(uid,id);drafts.set(k,value);
    try{localStorage.setItem(k,JSON.stringify(value));}catch(e){message('Draft is available in this tab only. Keep it open until posted.');}
  }
  function stop(){epoch++;if(unsubscribe){unsubscribe();unsubscribe=null;}}
  function render(items){
    const list=$('commentList');list.replaceChildren();
    $('commentsCount').textContent=items.length+' '+(items.length===1?'comment':'comments');
    $('commentsEmpty').hidden=items.length>0;
    for(const item of items){
      const entry=document.createElement('li');entry.className='commententry';
      const avatar=document.createElement('span');avatar.className='commentavatar';avatar.setAttribute('aria-hidden','true');avatar.textContent=(item.authorName || 'You').slice(0,1).toUpperCase();
      const body=document.createElement('div');body.className='commentbody';
      const bubble=document.createElement('div');bubble.className='commentbubble';
      const author=document.createElement('strong');author.className='commentauthor';author.textContent=item.authorName || 'You';
      const text=document.createElement('p');text.textContent=item.text;
      bubble.append(author,text);
      const time=document.createElement('time');time.className='commenttime';
      if(Number.isFinite(item.createdAt)){
        const date=new Date(item.createdAt);time.dateTime=date.toISOString();time.title=date.toLocaleString();
        time.textContent=date.toLocaleString(undefined,{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'});
      }else time.textContent='Saving timestamp…';
      body.append(bubble,time);entry.append(avatar,body);list.append(entry);
    }
  }
  function connect(){
    stop();render([]);message('');
    $('commentGuest').hidden=!!account;$('commentForm').hidden=!account;$('newComment').hidden=!account;
    $('commentsEmpty').hidden=!account;
    if(!account||!store){$('commentsCount').textContent='Private to your account';return;}
    const current=epoch,uid=account.uid,id=questionId;
    $('commentAvatar').textContent=account.name.slice(0,1).toUpperCase();
    $('commentText').value=draft().text;posting=pending.has(key(uid,id));$('postComment').disabled=posting;$('commentText').disabled=posting;
    message('Loading comments…');
    unsubscribe=store.subscribe(id,(items,fromCache)=>{
      if(epoch!==current||account?.uid!==uid||questionId!==id)return;
      render(items);if(!posting)message(fromCache?'Showing cached comments. Connect to load the latest.':'');
    },error=>{if(epoch===current)message('Could not load comments. '+(error.code==='permission-denied'?'Check your sign-in and comments access.':'Check your connection and reopen this thread.'));});
  }
  function open(id){
    const question=window.notebookApp.getItem(id);if(!question)return;
    questionId=id;$('commentsQuestion').textContent=question.title;
    window.notebookApp.openComments();connect();
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-comments]');if(button)open(button.dataset.comments);
  });
  $('commentText').addEventListener('input',()=>{const value=draft();if(value)remember({...value,id:value.attempted?crypto.randomUUID():value.id,attempted:false,text:$('commentText').value});});
  $('newComment').addEventListener('click',()=>{$('commentText').focus();$('commentText').scrollIntoView({block:'nearest',behavior:'smooth'});});
  $('commentsSignIn').addEventListener('click',()=>{dialog.close();window.notebookApp.openAccount();});
  dialog.addEventListener('close',()=>{if(dialog.open)return;stop();questionId=null;});
  $('commentForm').addEventListener('submit',async event=>{
    event.preventDefault();if(posting||!account||!store||pending.has(key(account.uid,questionId)))return;
    const original=draft(),text=$('commentText').value.trim();
    if(!text){message('Write a comment before posting.');$('commentText').focus();return;}
    if(text.length>5000){message('Keep your comment to 5,000 characters.');return;}
    const uid=account.uid,id=questionId,current=epoch,adapter=store;
    const value={...original,text,attempted:true};remember(value);pending.set(key(uid,id),value.id);
    const active=()=>account?.uid===uid && questionId===id && dialog.open;
    posting=true;$('postComment').disabled=true;$('commentText').disabled=true;message('Posting comment…');
    const slow=setTimeout(()=>{if(active())message('Still connecting. Your draft is saved; keep this tab open until posting finishes.');},10000);
    try{
      await adapter.post({id:value.id,questionId:id,text,authorName:account.name});
      // Clear only the submitted draft; a draft edited in another thread/account is kept.
      const k=key(uid,id),stored=drafts.get(k);
      if(stored?.id===value.id && stored.text===value.text)remember({id:crypto.randomUUID(),text:''},uid,id);
      if(active()){$('commentText').value='';message('Comment posted.');}
    }catch(error){if(active())message('Not posted. Your draft is kept. '+(error.code==='permission-denied'?'Please check your account access.':'Check your connection, then try Post comment again.'));}
    finally{clearTimeout(slow);pending.delete(key(uid,id));if(active()){posting=false;$('postComment').disabled=false;$('commentText').disabled=false;}}
  });
  window.SpringboardComments={
    open,
    setAccount(next,adapter){
      stop();account=next;store=adapter;posting=false;
      if(dialog.open)connect();
    }
  };
})();
