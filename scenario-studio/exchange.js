(function(root,factory){
 'use strict';
 if(typeof module==='object')module.exports=factory(require('./model.js'));
 else root.StudioExchange=factory(root.StudioModel);
})(typeof window==='object'?window:globalThis,function(M){
 'use strict';
 const schema='loopgirl.scenario-edits.v1';
 function validate(bundle,catalog,attachmentPaths=[]){
  if(!bundle||bundle.schema!==schema||!Array.isArray(bundle.events)||bundle.events.length>1000)
   throw Error('LoopGirl 수정본 파일이 아닙니다.');
  if(typeof bundle.author!=='string'||bundle.author.length>100)throw Error('작업자 이름을 확인하세요.');
  const assets=new Set([...Object.keys(catalog.assets),...attachmentPaths]),seen=new Set(),results=[];
  for(const edit of bundle.events){
   const entry=catalog.events.find(e=>e.record.key===edit.key);
   if(!entry||seen.has(edit.key))throw Error('알 수 없거나 중복된 이벤트: '+edit.key);seen.add(edit.key);
   if(edit.baseHash!==entry.baseHash)throw Error('기준 대본이 달라졌습니다: '+edit.key);
   if(!Array.isArray(edit.changes))throw Error('변경 목록이 없습니다.');
   for(const c of edit.changes){
    const v=M.get(entry.record,c.path);
    if((v!==undefined)!==c.beforeExists||JSON.stringify(v??null)!==JSON.stringify(c.before))
     throw Error('변경 전 문장이 다릅니다: '+edit.key+' '+c.path);
   }
   let working;
   try{working=M.validate(entry.record,edit.changes.map(c=>({path:c.path,value:c.after,
    remove:!c.afterExists})),assets);}catch(e){throw Error(entry.record.title+': '+e.message);}
   const notes=edit.notes||{},sections=new Set(M.sections(entry.record).map(s=>s.id));
   if(!notes||Array.isArray(notes)||typeof notes!=='object')throw Error('잘못된 연출 메모');
   for(const [p,n] of Object.entries(notes))if(!sections.has(p)||typeof n!=='string'||n.length>20000)
    throw Error('연출 메모 위치/길이를 확인하세요.');
   results.push({key:edit.key,working,notes,changes:M.diff(entry.record,working)});
  }
  return results;
 }
 function create(catalog,drafts,author,attachments={}){
  const events=[];
  for(const [key,d] of Object.entries(drafts)){
   const e=catalog.events.find(e=>e.record.key===key);if(!e)continue;
   const changes=M.diff(e.record,d.working);
   const notes=Object.fromEntries(Object.entries(d.notes||{}).filter(([,v])=>v.trim()));
   if(changes.length||Object.keys(notes).length)events.push({key,baseHash:e.baseHash,changes,notes});
  }
  const used=new Set(events.flatMap(e=>e.changes.map(c=>c.after)).filter(v=>typeof v==='string'));
  return {schema,packageId:catalog.packageId,author,createdAt:new Date().toISOString(),events,
   attachments:Object.fromEntries(Object.entries(attachments).filter(([p])=>used.has(p)))};
 }
 function report(bundle){
  const val=(v,exists=true)=>!exists?'이전 화면 유지':v===null?'해제':String(v);
  const lines=['# LoopGirl 이벤트 수정본',`작업자: ${bundle.author||'미기입'}`,
   `작성 시각: ${bundle.createdAt}`,`이벤트 ${bundle.events.length}개 · 검토용 / 게임 미반영`];
  for(const e of bundle.events){lines.push('## '+e.key);
   for(const c of e.changes)lines.push(`### ${c.label||c.path}`,`위치: ${c.path}`,
    '변경 전:\n\n'+val(c.before,c.beforeExists),'변경 후:\n\n'+val(c.after,c.afterExists));
   for(const [p,n] of Object.entries(e.notes||{}))lines.push('### 연출 메모 '+p,n);
  }
  return lines.join('\n\n')+'\n';
 }
 return {schema,validate,create,report};
});
