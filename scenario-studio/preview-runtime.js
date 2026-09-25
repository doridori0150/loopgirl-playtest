(async function(){
 'use strict';
 const panel=document.createElement('section');panel.id='scenarioTestPanel';
 panel.innerHTML='<strong>시나리오 테스트</strong><span id="scenarioTestStatus">장면 불러오는 중…</span>'
  +'<select id="scenarioStartNode" aria-label="시작 장면"></select>'
  +'<button id="scenarioRestart">다시 보기</button><a href="../scenario-studio/">작업실로 돌아가기</a>';
 document.body.append(panel);
 const status=text=>document.getElementById('scenarioTestStatus').textContent=text;
 const blobUrls=[];
 try{
  const id=new URLSearchParams(location.hash.slice(1)).get('preview');
  if(!/^[0-9a-f-]{36}$/.test(id||''))throw Error('작업실에서 이벤트를 선택한 뒤 ‘게임 화면으로 확인’을 눌러 주세요.');
  await StudioStorage.open();const payload=await StudioStorage.get('preview:'+id);
  if(!payload||payload.schema!=='loopgirl.scenario-preview.v1')throw Error('수정본을 찾을 수 없습니다. 작업실에서 다시 여세요.');
  if(payload.gameVersion!==window.SCENARIO_GAME_VERSION)throw Error('게임 기준판이 바뀌었습니다. 작업실을 새로 여세요.');
  await StudioAttachments.validate(payload.attachments||{});
  const urls={...payload.urls},aliases={};
  for(const [p,a] of Object.entries(payload.attachments||{})){
   const url=URL.createObjectURL(new Blob([StudioAttachments.bytesOf(a.data)],{type:a.mime}));
   const alias='assets/scenario-preview/'+p.split('/').pop();aliases[p]=alias;
   urls[alias]=url;blobUrls.push(url);
  }
  const record=JSON.parse(JSON.stringify(payload.record));
  function map(v){
   if(typeof v==='string'&&aliases[v])return aliases[v];
   if(Array.isArray(v))return v.map(map);
   if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,map(x)]));return v;
  }
  const data=map(record.data),select=document.getElementById('scenarioStartNode');
  window.ASSET_DATA=Object.assign(window.ASSET_DATA||{},urls);
  const motion=GL.dialogMotion;
  if(motion){
   // Preserve the published motion mapping when an unchanged illustration resolves to an absolute URL.
   for(const asset of [...motion.assets]){
    const absolute=new URL(asset.cg,document.baseURI).href;
    for(const [original,url] of Object.entries(urls))if(url===absolute)motion.assets.push({...asset,cg:original});
   }
   for(const [p,a] of Object.entries(payload.attachments||{}))if(a.mime==='video/mp4')
    motion.assets.push({cg:aliases[p],path:aliases[p]});
  }
  let events=data.nodes||[data];
  if(record.layer==='daily')events=[{id:data.id,pages:[{speaker:data.speaker,text:data.text,face:data.face,
   portrait:record.student,bg:data.bg,cg:data.cg}],choices:data.choices}];
  const byId=new Map(events.map(e=>[e.id,e]));
  for(const e of events){const o=document.createElement('option');o.value=e.id;
   o.textContent=(e.name||e.id)+' · '+(e.pages?.length||0)+'쪽';select.append(o);}
  select.value=data.entryId||events[0].id;
  if(record.layer==='interaction'){data.id='scenario_'+data.id;GL.interactions.register(data);}
  function done(){status(record.title+' · 재생 완료. 다른 선택은 다시 보기에서 확인하세요.');}
  function play(){
   GL.dialog.close();GL.interactions?.close();
   status(record.title+' · 수정본 재생 / 공개 게임 저장과 분리');
   if(record.layer==='interaction'){
    select.hidden=true;
    if(!GL.interactions.open(data.id,{name:'대표',isUnlocked:()=>true,onClose:done}))throw Error('상태 장면을 열 수 없습니다.');
   }else GL.dialog.open(byId.get(select.value),{vars:{name:'대표'},can:()=>true,
    resolve:next=>byId.get(next),instant:true,onChoose:()=>{},onClose:done});
   document.body.dataset.previewReady='true';
  }
  document.getElementById('scenarioRestart').onclick=play;select.onchange=play;
  window.ScenarioPreview={record,events,byId,play,payloadId:id};play();
 }catch(e){status(e.message);document.body.dataset.previewError=e.message;}
 addEventListener('pagehide',()=>blobUrls.forEach(u=>URL.revokeObjectURL(u)));
})();
