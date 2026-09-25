(function(){
 'use strict';
 const M=window.StudioModel,$=id=>document.getElementById(id);
 const layers={main:'메인 스토리',opening:'첫 의뢰',base:'기본 인연',reaction:'귀환·후속',daily:'일일 대화',
  b:'B 인연·엔딩',interaction:'엔딩 뒤 상호작용'};
 function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;
  if(cls)n.className=cls;return n;}
 function button(label,action,cls){const b=el('button',label,cls);b.type='button';b.onclick=action;return b;}
 function option(value,label){const n=el('option',label);n.value=value;return n;}
 const val=v=>v===undefined?'이전 화면 유지':v===null?'해제':String(v);
 function assetUrl(S,p){return S.attachments[p]?`data:${S.attachments[p].mime};base64,${S.attachments[p].data}`:
  S.data.assets[p]?.url||p;}
 function list(S){
  const q=$('search').value.trim().toLowerCase(),layer=$('layer').value,char=$('character').value;
  const rows=S.data.events.filter(e=>(!q||e.search.includes(q))&&(!layer||e.record.layer===layer)
   &&(!char||e.record.student===char||e.record.presentation.portraits.includes(char))
   &&(!$('changedOnly').checked||S.changed(e.record.key)));
  $('resultCount').textContent=rows.length+'개 이벤트';$('eventList').replaceChildren();
  for(const e of rows){const r=e.record,b=button(r.title,()=>S.select(r.key),'eventItem');
   b.dataset.key=r.key;b.classList.toggle('active',r.key===S.key);b.classList.toggle('dirty',S.changed(r.key));
   b.append(el('span',layers[r.layer]+' · '+(S.data.characters[r.student]?.name||r.id)));
   $('eventList').append(b);
  }
  if(!rows.length)$('eventList').append(el('p','일치하는 이벤트가 없습니다. 검색 조건을 바꿔 주세요.','empty'));
  $('dirtyCount').textContent=Object.keys(S.drafts).filter(k=>S.changed(k)).length;
 }
 function visible(S){return M.sections(S.record()).filter(s=>S.tab==='cuts'?
  s.kind!=='choice':s.kind!=='scene'&&s.kind!=='direction');}
 function fields(S,section){
  const box=$('editor');box.replaceChildren(el('h3',section.title));
  const show=section.fields.filter(f=>S.tab==='cuts'?
   f.type==='asset'||section.kind==='direction'||['pose','action','emotion'].includes(f.key):
   f.type!=='asset'&&!['pose','action','emotion'].includes(f.key));
  for(const f of show){
   const label=el('label',undefined,'field');label.append(el('span',f.name));
   let input;
   if(f.type==='asset'){
    const wrap=el('div',undefined,'assetValue'),select=el('select');select.dataset.path=f.path;
    select.setAttribute('aria-label',f.name);select.append(option('__inherit__','이전 화면 유지'),option('__clear__','해제'));
    const currentName=S.data.assets[f.value]?.name||S.attachments[f.value]?.name||f.value;
    if(f.value)select.append(option(f.value,'현재: '+currentName));
    select.value=f.value===undefined?'__inherit__':f.value===null?'__clear__':f.value;
    select.onchange=()=>S.edit(f.path,select.value==='__clear__'?null:select.value,select.value==='__inherit__');
    wrap.append(select,button('자료 선택',()=>S.pickAsset(f.path)));label.append(wrap);
    label.append(el('div',f.value||'별도 자료 지정 없음','assetPath'));
   }else{
    input=el(['text','reply','returnText','action','visual','exit','avoid','before','after','reason','purpose']
     .includes(f.key)?'textarea':'input');input.dataset.path=f.path;input.setAttribute('aria-label',f.name);
    if(f.type==='number'){input.type='number';input.min='1';}
    input.value=f.value??'';
    input.oninput=()=>S.edit(f.path,f.type==='number'?Number(input.value):input.value,false,false);
    label.append(input);
   }
   const original=M.get(S.entry().record,f.path);
   if(['text','reply','label','visual'].includes(f.key)){
    const details=el('details');details.append(el('summary','기준 대본 보기'),el('p',val(original)));label.append(details);
   }
   box.append(label);
  }
  if(!show.length)box.append(el('p','이 장면에는 별도로 지정된 컷신 연출 항목이 없습니다.','muted'));
  const note=el('label',undefined,'field note');note.append(el('span','연출·수정 메모'));
  const area=el('textarea');area.id='sceneNote';area.placeholder='컷 추가, 구도, 표정, 분기 변경 요청 등을 적으세요.';
  area.value=S.draft().notes[section.id]||'';area.oninput=()=>S.note(section.id,area.value);
  note.append(area);box.append(note);
 }
 function changes(S){
  $('sectionList').replaceChildren();const box=$('editor');box.replaceChildren(el('h3','변경 전후'));
  const diff=M.diff(S.entry().record,S.record());
  const sections=M.sections(S.entry().record);
  for(const c of diff){const section=sections.find(s=>s.fields.some(f=>f.path===c.path));
   const row=el('article',undefined,'change');row.append(el('h3',(section?.title||'장면')+' · '+c.label),
   el('p','기준\n'+val(c.beforeExists?c.before:undefined),'before'),
   el('p','수정\n'+val(c.afterExists?c.after:undefined),'after'));box.append(row);}
  for(const [p,n] of Object.entries(S.draft().notes))if(n.trim()){
   const title=sections.find(s=>s.id===p)?.title||'장면';
   const row=el('article',undefined,'change');row.append(el('h3',title+' · 연출 메모'),el('p',n,'after'));box.append(row);}
  if(!box.querySelector('article'))box.append(el('p','아직 수정한 내용이 없습니다.','empty'));
 }
 function preview(S){
  const sections=M.sections(S.record()),section=sections.find(s=>s.id===S.section)||sections[0];
  const f=M.frame(S.record(),section),bg=f.image||f.cg||f.bg;
  const media=bg&&(/\.mp4$/i.test(bg)||S.attachments[bg]?.mime==='video/mp4');
  const image=$('previewBg');image.hidden=!bg||media;image.removeAttribute('src');
  if(bg&&!media)image.src=assetUrl(S,/^[A-Z]$/.test(bg)?`assets/env/bg_${bg}.webp`:bg);
  const video=$('previewVideo');video.hidden=!media;
  if(media&&video.dataset.path!==bg){video.src=assetUrl(S,bg);video.dataset.path=bg;}
  if(!media){video.pause();video.removeAttribute('src');video.dataset.path='';}
  const char=S.data.characters[f.portrait];
  const portrait=!f.cg&&!f.image&&(S.data.portraits[f.portrait]?.[f.face||'neutral']?.path||char?.appearance);
  $('previewPortrait').hidden=!portrait;$('previewPortrait').removeAttribute('src');
  if(portrait)$('previewPortrait').src=assetUrl(S,portrait);
  $('previewSpeaker').textContent=f.speaker||'지문';$('previewText').textContent=String(f.text||'화면 연출 확인');
  const id=f.portrait||S.record().student||Object.values(S.data.characters).find(c=>c.name===f.speaker)?.id;
  const c=S.data.characters[id],voice=$('voiceContent');voice.replaceChildren();
  if(c){voice.append(el('p',c.name+' · '+c.concept),el('p','말투: '+c.voice),
   el('p','살릴 특징: '+c.signature.pattern),el('p',c.signature.keep));}
  else voice.append(el('p','인물 대사를 선택하면 해당 캐릭터의 말투 기준이 표시됩니다.'));
  const info=$('sourceInfo');info.replaceChildren(el('p','이벤트: '+S.key),
   el('p','노드: '+(section.node||S.record().id)),el('p','다음 연결: '+(section.next||'각 노드의 선택·종료 조건 참조')));
  const data=S.record().data;
  const nodes=data.nodes||[data];
  for(const n of nodes.filter(n=>!section.node||n.id===section.node)){
   if(n.trigger)info.append(el('p','조건: '+JSON.stringify(n.trigger)));
   for(const choice of n.choices||[])if(choice.next)info.append(button(choice.label+' → '+choice.next,()=>{
    const target=M.sections(S.record()).find(s=>s.node===choice.next&&s.kind==='dialogue');
    if(target){S.section=target.id;S.tab='dialogue';event(S);}
   }));
  }
  for(const source of S.record().sourceFiles)info.append(el('p',source.path,'sourcePath'));
 }
 function event(S){
  const r=S.record();$('eventKey').textContent=layers[r.layer]+' / '+r.key;$('eventTitle').textContent=r.title;
  $('eventSummary').textContent=r.direction?.purpose||r.cutStatus.decision;
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===S.tab));
  document.querySelector('.editorGrid').classList.toggle('changesMode',S.tab==='changes');
  const sections=visible(S);if(!sections.some(s=>s.id===S.section))S.section=sections[0]?.id;
  if(S.tab==='changes')changes(S);else{
   $('sectionList').replaceChildren();for(const s of sections){
    const b=button(s.title,()=>{S.section=s.id;event(S);},'sectionItem');b.dataset.section=s.id;
    b.classList.toggle('active',s.id===S.section);$('sectionList').append(b);
   }
   if(sections.length)fields(S,sections.find(s=>s.id===S.section));
  }
  preview(S);$('resetBtn').disabled=!S.changed(S.key);
 }
 function assets(S){
  const q=$('assetSearch').value.trim().toLowerCase(),all={...S.data.assets,...S.attachments};
  const entries=Object.entries(all).filter(([p,a])=>(p+' '+a.name).toLowerCase().includes(q));
  const box=$('assetList');box.replaceChildren();
  for(const [p,a] of entries.slice(0,45)){
   const b=button('',()=>{S.edit(S.assetField,p);$('assetDialog').close();},'assetCard');
   const media=a.type==='video'||a.mime==='video/mp4';const image=el(media?'video':'img');
   if(media){image.preload='metadata';image.muted=true;}else{image.loading='lazy';image.alt=a.name;}
   image.src=assetUrl(S,p);b.append(image,el('span',a.name),el('b',S.attachments[p]?'새 첨부 후보':'기존 자료'));box.append(b);
  }
  if(entries.length>45)box.append(el('p',`총 ${entries.length}개 중 45개 표시. 이름으로 좁혀 주세요.`));
  if(!entries.length)box.append(el('p','검색 결과가 없습니다. 새 후보를 첨부할 수 있습니다.','empty'));
 }
 window.StudioRender={el,button,option,layers,list,event,preview,assets,visible};
})();
