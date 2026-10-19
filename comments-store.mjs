// Comments live in their own collection. This adapter never reads or writes notebook documents.
export function createCommentStore({firestore: fs, db, uid}) {
  const comments=fs.collection(db,'users',uid,'questionComments');
  return {
    subscribe(questionId, onComments, onError) {
      const query=fs.query(comments,fs.where('questionId','==',questionId));
      return fs.onSnapshot(query,snapshot=>{
        const items=snapshot.docs.map(doc=>{
          const data=doc.data();
          return {id:doc.id,text:data.text,authorName:data.authorName,createdAt:data.createdAt?.toMillis() ?? null};
        }).sort((a,b)=>(a.createdAt ?? Infinity)-(b.createdAt ?? Infinity)||a.id.localeCompare(b.id));
        onComments(items,snapshot.metadata.fromCache);
      },onError);
    },
    async post({id,questionId,text,authorName}) {
      if(!/^q\d{3}$|^custom-[\w-]{1,100}$/.test(questionId))throw new Error('This question is not supported.');
      if(!/^[\w-]{1,100}$/.test(id))throw new Error('Invalid comment ID.');
      if(!text.trim() || text.length>5000)throw new Error('Enter a comment between 1 and 5,000 characters.');
      const ref=fs.doc(comments,id);
      // Stable IDs make retrying safe if the first commit succeeded but its acknowledgement was lost.
      await fs.runTransaction(db,async transaction=>{
        const existing=await transaction.get(ref);
        if(existing.exists()){
          if(existing.data().questionId===questionId && existing.data().text===text)return;
          throw new Error('This draft was already posted. Open a new comment to continue.');
        }
        transaction.set(ref,{questionId,text,authorName:authorName.slice(0,80),createdAt:fs.serverTimestamp()});
      });
    }
  };
}
