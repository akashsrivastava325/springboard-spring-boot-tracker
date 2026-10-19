(function(){
const results=document.querySelector('#results');
if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname)){results.textContent='These checks only run on an isolated local preview with Firebase disabled.';return;}
const frame=document.querySelector('iframe');
frame.addEventListener('load',async()=>{
 const w=frame.contentWindow,d=w.document,checks=[];
 function assert(value,message='Assertion failed'){if(!value)throw new Error(message);}
 async function test(name,fn){try{await fn();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:error.message});}}
 const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
 const before=JSON.stringify(w.notebookApp.get());
 let listener,fail=false,items=[],posts=0;const adapter={subscribe(id,next){listener=next;next(items.filter(x=>x.questionId===id),false);return()=>{};},async post(value){if(fail)throw new Error('offline');posts++;items.push({...value,createdAt:Date.now()});listener(items,false);}};
 await test('Every question has a Comments button',()=>{assert(d.querySelectorAll('[data-comments]').length===204);});
 await test('Guest can open thread and sees sign-in prompt',()=>{d.querySelector('[data-comments="q001"]').click();assert(d.getElementById('commentsDialog').open);assert(!d.getElementById('commentGuest').hidden);assert(d.getElementById('commentForm').hidden);d.getElementById('commentsDialog').close();});
 w.SpringboardComments.setAccount({uid:'test-'+crypto.randomUUID(),name:'Akash'},adapter);
 await test('Account sees private empty thread and New comment composer',()=>{w.SpringboardComments.open('q001');assert(!d.getElementById('commentsEmpty').hidden);assert(!d.getElementById('newComment').hidden);d.getElementById('newComment').click();assert(d.activeElement.id==='commentText');});
 await test('Posting displays text literally and includes a timestamp',async()=>{const input=d.getElementById('commentText');input.value='<img src=x onerror=alert(1)> My comment';input.dispatchEvent(new w.Event('input'));d.getElementById('commentForm').requestSubmit();await tick();assert(posts===1);assert(d.querySelectorAll('#commentList .commentbubble').length===1);assert(d.querySelector('#commentList .commentmarkdown').textContent.includes('<img'));assert(!d.querySelector('#commentList img'));assert(!!d.querySelector('#commentList time').dateTime);assert(input.value==='');});
 await test('Opening, reading and posting never changes notebook data',()=>{assert(JSON.stringify(w.notebookApp.get())===before);});
 await test('Failed post retains draft for retry',async()=>{fail=true;const input=d.getElementById('commentText');input.value='Keep this draft';input.dispatchEvent(new w.Event('input'));d.getElementById('commentForm').requestSubmit();await tick();assert(input.value==='Keep this draft');assert(d.getElementById('commentStatus').textContent.includes('Not posted'));fail=false;d.getElementById('commentForm').requestSubmit();await tick();assert(posts===2);assert(input.value==='');});
 await test('Closing and reopening during a post does not duplicate it',async()=>{
  const originalPost=adapter.post;let release;adapter.post=value=>new Promise(resolve=>{release=async()=>{await originalPost(value);resolve();};});
  const input=d.getElementById('commentText');input.value='Pending across reopen';input.dispatchEvent(new w.Event('input'));d.getElementById('commentForm').requestSubmit();
  d.getElementById('commentsDialog').close();await tick();w.SpringboardComments.open('q001');assert(d.getElementById('postComment').disabled);
  await release();await tick();assert(input.value==='');assert(!d.getElementById('postComment').disabled);assert(posts===3);adapter.post=originalPost;
 });
 await test('Posted Markdown uses the exact notes renderer and typography',()=>{
  const source='## Design\n\n**StudentService** coordinates registration.\n\n- Validate\n- Save\n\n| Class | Role |\n| --- | --- |\n| Service | Coordinates |\n\n```java\nrepository.save(student);\n```';
  const stored={id:'md-test',text:source,authorName:'Akash',createdAt:Date.now()};listener([stored],false);
  const body=d.querySelector('#commentList .commentmarkdown');assert(body.innerHTML===w.notebookApp.renderMarkdown(source),'Renderer differs from notes');assert(body.querySelector('h2')&&body.querySelector('strong')&&body.querySelector('ul')&&body.querySelector('table')&&body.querySelector('pre code'));assert(w.getComputedStyle(body).fontSize==='16px');assert(stored.text===source,'Stored source was modified');
 });
 await test('Comment preview and formatted paste match notes without posting',()=>{
  const input=d.getElementById('commentText'),oldPosts=posts;input.value='';
  const clipboard=new w.DataTransfer();clipboard.setData('text/plain','Design');clipboard.setData('text/html','<h2>Design</h2><p><strong>StudentService</strong></p>');input.dispatchEvent(new w.ClipboardEvent('paste',{clipboardData:clipboard,bubbles:true,cancelable:true}));
  assert(input.value==='## Design\n\n**StudentService**');d.getElementById('commentPreview').click();assert(input.hidden);assert(d.getElementById('commentPreviewBody').innerHTML===w.notebookApp.renderMarkdown(input.value));d.getElementById('newComment').click();assert(!input.hidden);assert(posts===oldPosts,'Preview posted a comment');
 });
 await test('Unsafe comment markup stays inert',()=>{
  listener([{id:'unsafe',text:'<script>alert(1)</script>\n\n[bad](javascript:alert(1))',authorName:'Akash',createdAt:Date.now()}],false);
  const body=d.querySelector('#commentList .commentmarkdown');assert(!body.querySelector('script,img,iframe,svg'));assert(!body.querySelector('a[href^="javascript:"]'));assert(body.textContent.includes('<script>'));
 });
 await test('Switching account clears visible comments and draft',()=>{d.getElementById('commentText').value='Private draft';d.getElementById('commentText').dispatchEvent(new w.Event('input'));const stale=listener;w.SpringboardComments.setAccount({uid:'other-'+crypto.randomUUID(),name:'Other'}, {subscribe:(_id,next)=>{next([],false);return()=>{};},post:async()=>{}});stale([{id:'old',text:'Previous account',authorName:'Private',createdAt:Date.now()}],false);assert(d.querySelectorAll('#commentList li').length===0);assert(d.getElementById('commentText').value==='');});
 d.getElementById('commentsDialog').close();
 await test('Custom question Comments button and both revision views work',()=>{const q=w.createAddition({title:'Comment test only',kind:'question',section:'s01',complete:'test',skim:'test'});w.render();assert(d.querySelector('[data-comments="'+q.id+'"]'));for(const view of ['complete','skim']){d.querySelector('[data-view="'+view+'"]').click();assert(d.querySelector('[data-comments="'+q.id+'"]'));}});
 await test('Comments dialog fits a phone viewport',()=>{w.SpringboardComments.open('q001');assert(d.documentElement.scrollWidth<=d.documentElement.clientWidth,'Horizontal page overflow');assert(d.getElementById('commentsDialog').getBoundingClientRect().width<=390,'Dialog exceeds phone width');d.getElementById('commentsDialog').close();});
 // Restore only this isolated local preview's original notebook.
 w.notebookApp.replace(JSON.parse(before));
 results.textContent=JSON.stringify({passed:checks.filter(t=>t.passed).length,total:checks.length,checks},null,2);
 document.title=checks.every(t=>t.passed)?'PASS — Comment checks':'FAIL — Comment checks';
});frame.src='../index.html';
})();
