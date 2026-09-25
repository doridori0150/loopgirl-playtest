(async function(){
 'use strict';
 const M=StudioModel,X=StudioExchange,R=StudioRender,DB=StudioStorage,A=StudioAttachments;
 const $=id=>document.getElementById(id),data=window.STUDIO_DATA,cacheKey='work:'+data.packageId;
 let saveTimer,pending=false,storageReady=false;
 const S={data,drafts:{},attachments:{},key:null,tab:'dialogue',section:null,
  entry(){return data.events.find(e=>e.record.key===S.key);},
  draft(){return S.drafts[S.key]||(S.drafts[S.key]={working:M.copy(S.entry().record),notes:{}});},
  record(){return S.draft().working;},
  changed(key){const d=S.drafts[key],e=data.events.find(e=>e.record.key===key);
   return !!d&&(M.diff(e.record,d.working).length>0||Object.values(d.notes).some(v=>v.trim()));},
  select(key){S.key=key;S.section=null;R.event(S);R.list(S);},
  edit(path,value,remove=false,render=true){
   const record=S.record();if(remove){const a=path.split('/'),k=a.pop();delete M.get(record,a.join('/'))[k];}
   else M.set(record,path,value);queueSave();if(render)R.event(S);else R.preview(S);R.list(S);
   $('resetBtn').disabled=false;
  },
  note(path,value){S.draft().notes[path]=value;queueSave();R.list(S);$('resetBtn').disabled=false;},
  pickAsset(path){S.assetField=path;$('assetSearch').value='';R.assets(S);$('assetDialog').showModal();}
 };
 function notice(message){$('notice').textContent=message;$('notice').hidden=!message;}
 async function guarded(fn){try{await fn();}catch(e){notice(e.message||String(e));}}
 async function save(){
  clearTimeout(saveTimer);
  if(!storageReady){$('saveState').textContent='파일로 저장 필요';return;}
  try{await DB.put(cacheKey,{drafts:S.drafts,author:$('author').value});pending=false;
   $('saveState').textContent='이 브라우저에 보관됨';
  }catch(e){$('saveState').textContent='자동 보관 실패';notice('브라우저 보관에 실패했습니다. 수정본 파일을 저장해 주세요.');}
 }
 function queueSave(){pending=true;$('saveState').textContent='보관 중…';clearTimeout(saveTimer);
  saveTimer=setTimeout(save,300);}
 function download(text,name,type){
  const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;
  a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);
 }
 function bundle(){return X.create(data,S.drafts,$('exportAuthor').value.trim(),S.attachments);}
 async function checkedBundle(){
  const b=bundle();if(!b.author)throw Error('작업자 이름을 입력하세요.');
  const paths=await A.validate(b.attachments);X.validate(b,data,paths);
  if(!b.events.length)throw Error('전달할 수정 내용이 없습니다.');return b;
 }
 async function importFile(file){
  if(file.size>90*1024*1024)throw Error('수정본 파일이 너무 큽니다.');
  const b=JSON.parse(await file.text()),paths=await A.validate(b.attachments||{}),results=X.validate(b,data,paths);
  const conflicts=results.filter(e=>S.changed(e.key));
  if(conflicts.length&&!confirm(`이미 수정한 이벤트 ${conflicts.length}개가 겹칩니다.\n`
   +conflicts.map(e=>e.key).join('\n')+'\n현재 브라우저 작업을 이 파일 내용으로 바꿀까요? 취소하면 아무것도 바뀌지 않습니다.'))return;
  const next={...S.attachments,...(b.attachments||{})};await A.validate(next);
  if(storageReady)await DB.put(cacheKey+':attachments',next);S.attachments=next;
  for(const e of results)S.drafts[e.key]={working:e.working,notes:e.notes};
  queueSave();await save();if(results.length)S.select(results[0].key);
  notice(`${b.author||'다른 작업자'}의 수정 ${results.length}개 이벤트를 불러왔습니다. 게임에는 아직 반영되지 않았습니다.`);
 }
 for(const [k,v] of Object.entries(R.layers))$('layer').append(R.option(k,v));
 for(const c of Object.values(data.characters))$('character').append(R.option(c.id,c.name));
 for(const e of data.events){const r=e.record;
  e.search=[r.key,r.title,data.characters[r.student]?.name,...r.presentation.portraits.map(p=>data.characters[p]?.name),
   JSON.stringify(r.data)].join(' ').toLowerCase();}
 try{
  await DB.open();storageReady=true;
  const saved=await DB.get(cacheKey);S.drafts=saved?.drafts||{};$('author').value=saved?.author||'';
  S.attachments=await DB.get(cacheKey+':attachments')||{};
 }catch(e){notice('이 브라우저에서는 자동 보관을 사용할 수 없습니다. 작업 후 수정본 파일을 저장하세요.');}
 $('saveState').textContent=storageReady?'이 브라우저에 보관됨':'파일로 저장 필요';
 $('packageInfo').textContent=`기준판 ${data.packageId} · 이벤트 ${data.events.length}개. 게임 데이터는 바뀌지 않습니다.`;
 for(const id of ['search','layer','character','changedOnly'])$(id).oninput=()=>R.list(S);
 $('author').oninput=queueSave;
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;S.section=null;R.event(S);});
 document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 $('helpBtn').onclick=()=>$('helpDialog').showModal();
 $('exportBtn').onclick=()=>{
  $('exportAuthor').value=$('author').value;
  const b=bundle();$('exportSummary').textContent=`${b.events.length}개 이벤트 · `
   +`${b.events.reduce((n,e)=>n+e.changes.length,0)}개 항목 수정 · 첨부 ${Object.keys(b.attachments).length}개`;
  $('exportDialog').showModal();
 };
 $('downloadJson').onclick=()=>guarded(async()=>{
  const b=await checkedBundle();download(JSON.stringify(b,null,2),'LoopGirl-수정본-'+new Date().toISOString().slice(0,10)
   +'.json','application/json');$('author').value=b.author;queueSave();notice('수정본 파일을 저장했습니다. 담당자에게 전달해 주세요.');
 });
 $('downloadReport').onclick=()=>guarded(async()=>{
  const b=await checkedBundle();download(X.report(b),'LoopGirl-변경전후.md','text/markdown;charset=utf-8');
 });
 $('importBtn').onclick=()=>$('importFile').click();
 $('importFile').onchange=()=>guarded(async()=>{
  const file=$('importFile').files[0];if(file)await importFile(file);$('importFile').value='';
 });
 $('assetSearch').oninput=()=>R.assets(S);$('uploadBtn').onclick=()=>$('assetFile').click();
 $('assetFile').onchange=()=>guarded(async()=>{
  const file=$('assetFile').files[0];if(!file)return;const a=await A.fromFile(file);
  const next={...S.attachments,[a.path]:a.value};await A.validate(next);
  if(storageReady)await DB.put(cacheKey+':attachments',next);S.attachments=next;S.edit(S.assetField,a.path);
  $('assetDialog').close();$('assetFile').value='';notice('새 자료를 후보로 첨부했습니다. 수정본 파일에 함께 담깁니다.');
 });
 $('resetBtn').onclick=()=>{
  if(!confirm('이 이벤트의 대사·컷신·메모를 기준판으로 되돌릴까요? 다른 이벤트는 유지됩니다.'))return;
  delete S.drafts[S.key];queueSave();R.event(S);R.list(S);
 };
 for(const [id,delta] of [['prevBtn',-1],['nextBtn',1]])$(id).onclick=()=>{
  const a=R.visible(S),i=a.findIndex(s=>s.id===S.section);S.section=a[Math.max(0,Math.min(a.length-1,i+delta))]?.id;
  R.event(S);
 };
 addEventListener('beforeunload',e=>{if(pending){e.preventDefault();e.returnValue='';}});
 S.select(data.events[0].record.key);window.StudioApp={state:S,save,importFile,bundle};
 dispatchEvent(new Event('studio-ready'));
})();
