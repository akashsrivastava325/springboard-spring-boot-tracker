(function(){
if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname)){
 document.querySelector('#results').textContent='Run these checks on a local preview with Firebase disabled. They do not run on the published site.';return;
}
const frame=document.querySelector('iframe'),results=document.querySelector('#results');
frame.addEventListener('load',()=>{
 const w=frame.contentWindow,d=w.document;
 const initial=w.notebookApp.get();w.notebookApp.replace(w.notebookApp.fresh());
 const checks=[];
 function test(name,fn){try{fn();checks.push({name,passed:true});}catch(e){checks.push({name,passed:false,error:e.message});}}
 function equal(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(JSON.stringify(a)+' != '+JSON.stringify(b));}
 const paste=w.SpringboardPaste;
 test('ChatGPT Copy button Markdown stays verbatim',()=>{const md='## Design\n\n**StudentService**\n\n```java\nnew Student();\n```';equal(paste.choose(md,'<p>different HTML</p>'),md);});
 test('Formatted clipboard retains headings, table and fenced code',()=>{
  const md=paste.fromHTML('<h2>Design</h2><p><strong>One responsibility</strong> per class.</p><table><tr><th>Class</th><th>Responsibility</th></tr><tr><td><code>StudentService</code></td><td>Coordinates registration</td></tr></table><pre><code class="language-java">return marks &gt;= 0;</code></pre>');
  for(const token of ['## Design','**One responsibility**','| Class | Responsibility |','`StudentService`','```java','return marks >= 0;'])if(!md.includes(token))throw new Error('Missing '+token);
  const html=w.renderMarkdown(md);const holder=d.createElement('div');holder.innerHTML=html;
  equal(holder.querySelectorAll('table').length,1);equal(holder.querySelector('h2').textContent,'Design');equal(holder.querySelector('pre code').textContent.trim(),'return marks >= 0;');
 });
 test('Code blank lines and nested backticks stay intact',()=>{const md=paste.fromHTML('<pre><code>first\n\n\nlast `tick`</code></pre>');if(!md.includes('first\n\n\nlast `tick`'))throw new Error(md);});
 test('Nested and ordered lists keep their structure',()=>{const md=paste.fromHTML('<ol start="3"><li>Service<ul><li>Validate</li><li>Save</li></ul></li><li>Done</li></ol>');if(!md.includes('3. Service\n    - Validate\n    - Save\n4. Done'))throw new Error(md);});
 test('Clipboard scripts, images and unsafe links cannot execute',()=>{const md=paste.fromHTML('<script>alert(1)</script><p onclick="alert(1)">Safe <a href="javascript:alert(1)">link</a><img src=x onerror=alert(1)></p><svg><text>unsafe</text></svg>');equal(md,'Safe link');const holder=d.createElement('div');holder.innerHTML=w.renderMarkdown(md);equal(holder.querySelectorAll('script,img,svg,[onclick]').length,0);});
 test('Pasting selected rich text into an editor converts and saves it',()=>{
  w.openEditor('q001','complete');const field=d.getElementById('noteText');field.value='';
  const clip=new w.DataTransfer();clip.setData('text/plain','Design\nStudentService');clip.setData('text/html','<h2>Design</h2><p><strong>StudentService</strong></p>');
  field.dispatchEvent(new w.ClipboardEvent('paste',{clipboardData:clip,bubbles:true,cancelable:true}));
  equal(w.notebookApp.get().records.q001.complete,'## Design\n\n**StudentService**');
  d.getElementById('editorDialog').close();
 });
 let custom;
 test('Prerequisite item has visible Delete and cancellation keeps it',()=>{
  custom=w.createAddition({title:'My prerequisite',kind:'note',section:'s01',complete:'Complete answer',skim:'Quick answer'},{section:'s01',anchor:'q001',where:'before'});w.render();
  if(!d.querySelector('[data-delete="'+custom.id+'"]'))throw new Error('Missing Delete');
  d.querySelector('[data-delete="'+custom.id+'"]').click();equal(d.getElementById('deleteDialog').open,true);d.getElementById('deleteDialog').close();
  equal(w.notebookApp.get().custom.some(q=>q.id===custom.id),true);
 });
 test('Seed questions are protected from deletion',()=>{equal(w.deleteCustomItem('q001'),false);equal(d.querySelectorAll('[data-delete="q001"]').length,0);});
 test('Delete appears in Complete and Skim notes',()=>{for(const view of ['complete','skim']){d.querySelector('[data-view="'+view+'"]').click();if(!d.querySelector('[data-delete="'+custom.id+'"]'))throw new Error('Missing Delete in '+view);}});
 test('Delete removes both notes and order; Undo restores them',()=>{
  w.requestDelete(custom.id);d.getElementById('confirmDelete').click();let state=w.notebookApp.get();equal(state.custom.some(q=>q.id===custom.id),false);equal(state.order.s01.includes(custom.id),false);equal(state.records[custom.id],undefined);
  d.getElementById('toastAction').click();state=w.notebookApp.get();equal(state.records[custom.id].complete,'Complete answer');equal(state.records[custom.id].skim,'Quick answer');equal(state.order.s01.indexOf(custom.id),state.order.s01.indexOf('q001')-1);
 });
 test('Normal added questions are deletable from their editor',()=>{const q=w.createAddition({title:'My extra question',kind:'question',section:'s02',complete:'Answer',skim:''});w.render();w.openEditor(q.id);d.getElementById('deleteItem').click();equal(d.getElementById('deleteDialog').open,true);d.getElementById('confirmDelete').click();equal(w.notebookApp.get().custom.some(item=>item.id===q.id),false);});
 test('Reader font remains 16px and tables use horizontal rules',()=>{const holder=d.createElement('div');holder.className='markdown-content';holder.innerHTML=w.renderMarkdown('| Class | Role |\n| --- | --- |\n| Student | Data |');d.body.append(holder);equal(w.getComputedStyle(holder).fontSize,'16px');equal(w.getComputedStyle(holder.querySelector('td')).borderLeftWidth,'0px');holder.remove();});
 w.notebookApp.replace(initial);
 results.textContent=JSON.stringify({passed:checks.filter(t=>t.passed).length,total:checks.length,checks},null,2);
 document.title=checks.every(t=>t.passed)?'PASS — Reader and deletion checks':'FAIL — Reader and deletion checks';
});

frame.src="../index.html";
})();
