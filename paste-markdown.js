/* Convert the semantic formatting on the clipboard to portable Markdown.
 * Clipboard HTML never enters the page: scripts, styles, SVG and embeds are discarded.
 */
(function () {
  const ignored = new Set(['SCRIPT','STYLE','SVG','MATH','IFRAME','OBJECT','EMBED','TEMPLATE','NOSCRIPT']);
  function fromHTML(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const blocks=[],prefix='SPRINGBOARD_CODE_'+crypto.randomUUID()+'_';
    function children(node) { return Array.from(node.childNodes).map(convert).join(''); }
    function inline(node) { return children(node).trim(); }
    function cell(node) { return inline(node).replace(/\n+/g, ' ').replace(/\|/g, '\\|'); }
    function convert(node) {
      if (node.nodeType === 3) return node.textContent.replace(/\s+/g, ' ');
      if (node.nodeType !== 1 || ignored.has(node.tagName.toUpperCase())) return '';
      const tag=node.tagName.toUpperCase();
      if (tag==='PRE') {
        const code=node.querySelector('code') || node;
        const text=code.textContent.replace(/\n$/, '');
        const language=(code.className.match(/(?:^|\s)language-([\w+-]+)/)||[])[1] || '';
        const longest=Math.max(2,...Array.from(text.matchAll(/`+/g),m=>m[0].length));
        const fence='`'.repeat(longest+1);
        const token=prefix+blocks.length;blocks.push(fence+language+'\n'+text+'\n'+fence);
        return '\n\n'+token+'\n\n';
      }
      if (tag==='TABLE') {
        const rows=Array.from(node.querySelectorAll('tr')).map(row=>Array.from(row.children).filter(c=>['TH','TD'].includes(c.tagName)).map(cell)).filter(r=>r.length);
        if (!rows.length) return '';
        const columns=Math.max(...rows.map(r=>r.length));
        const line=row=>'| '+Array.from({length:columns},(_,i)=>row[i] || '').join(' | ')+' |';
        return '\n\n'+[line(rows[0]),line(Array(columns).fill('---')),...rows.slice(1).map(line)].join('\n')+'\n\n';
      }
      if (tag==='UL' || tag==='OL') {
        let number=Number(node.getAttribute('start')) || 1;
        const lines=Array.from(node.children).filter(c=>c.tagName==='LI').map(li=>{
          const nested=Array.from(li.children).filter(c=>['UL','OL'].includes(c.tagName));
          const body=Array.from(li.childNodes).filter(c=>!nested.includes(c)).map(convert).join('').trim().replace(/\n{2,}/g,'\n');
          const prefix=tag==='OL'?number+++'. ':'- ';
          return prefix+body.replace(/\n/g,'\n'+' '.repeat(prefix.length))+nested.map(c=>'\n'+convert(c).trim().split('\n').map(l=>'    '+l).join('\n')).join('');
        });
        return '\n\n'+lines.join('\n')+'\n\n';
      }
      if (tag==='BR') return '\n';
      if (tag==='HR') return '\n\n---\n\n';
      if (/^H[1-6]$/.test(tag)) return '\n\n'+'#'.repeat(Number(tag[1]))+' '+inline(node)+'\n\n';
      if (tag==='STRONG' || tag==='B') return '**'+inline(node)+'**';
      if (tag==='EM' || tag==='I') return '*'+inline(node)+'*';
      if (tag==='DEL' || tag==='S') return '~~'+inline(node)+'~~';
      if (tag==='CODE') {
        const text=node.textContent;
        const fence='`'.repeat(Math.max(0,...Array.from(text.matchAll(/`+/g),m=>m[0].length))+1);
        const padding=text.includes('`')?' ':'';
        return fence+padding+text+padding+fence;
      }
      if (tag==='A') {
        const text=inline(node),href=node.getAttribute('href') || '';
        try {if (['https:','http:','mailto:'].includes(new URL(href).protocol)) return '['+text+']('+href.replace(/ /g,'%20').replace(/\(/g,'%28').replace(/\)/g,'%29')+')';} catch(e) { /* Keep readable text. */ }
        return text;
      }
      if (tag==='INPUT') return node.getAttribute('type')==='checkbox'?'['+(node.hasAttribute('checked')?'x':' ')+'] ':'';
      if (tag==='IMG') return node.getAttribute('alt') || '';
      if (tag==='BLOCKQUOTE') return '\n\n'+inline(node).split('\n').map(line=>'> '+line).join('\n')+'\n\n';
      const text=children(node);
      return ['P','DIV','SECTION','ARTICLE','HEADER','FOOTER','FIGURE','FIGCAPTION'].includes(tag)?'\n\n'+text.trim()+'\n\n':text;
    }
    let markdown=children(doc.body).replace(/\n[ \t]+\n/g,'\n\n').replace(/\n{3,}/g,'\n\n').trim();
    blocks.forEach((block,index)=>{markdown=markdown.replace(prefix+index,()=>block);});return markdown;
  }
  function choose(plain, html) {
    // ChatGPT's Copy button already supplies Markdown; preserve that source verbatim.
    const isMarkdown=/(^|\n)\s*(#{1,6} |`{3,}|~{3,}|\|.+\||>)|\*\*[^\n]+\*\*|\[[^\]]+\]\([^)]+\)/.test(plain);
    return html && !isMarkdown ? fromHTML(html) || plain : plain;
  }
  window.SpringboardPaste={fromHTML,choose};
})();
