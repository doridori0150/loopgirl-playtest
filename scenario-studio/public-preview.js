(function(){
 'use strict';
 function ready(){
  const S=StudioApp.state,button=document.getElementById('gamePreviewBtn');
  if(!button||button.dataset.ready)return;button.dataset.ready='true';
  document.getElementById('publicVersion').textContent='작업실 '+STUDIO_DATA.release.version
   +' · 게임 화면 기준 '+STUDIO_DATA.release.gameVersion;
  button.onclick=async()=>{
   let popup;
   try{
    const edits=StudioExchange.create(STUDIO_DATA,{[S.key]:S.draft()},'장면 미리보기',S.attachments);
    StudioExchange.validate(edits,STUDIO_DATA,Object.keys(edits.attachments));
    popup=window.open('about:blank','_blank');
    if(!popup)throw Error('새 창을 허용한 뒤 다시 눌러 주세요.');
    popup.opener=null;popup.document.body.textContent='수정한 장면을 준비하고 있습니다…';
    await StudioAttachments.validate(edits.attachments);
    const id=crypto.randomUUID(),urls={};
    for(const [p,a] of Object.entries(STUDIO_DATA.assets))urls[p]=new URL(a.url||p,location.href).href;
    const payload={schema:'loopgirl.scenario-preview.v1',id,record:StudioModel.copy(S.record()),
     attachments:edits.attachments,urls,packageId:STUDIO_DATA.packageId,gameVersion:STUDIO_DATA.release.gameVersion,
     createdAt:new Date().toISOString()};
    await StudioStorage.put('preview:'+id,payload);await StudioApp.save();
    popup.location.replace(new URL('test.html#preview='+id,location.href));
   }catch(e){if(popup&&!popup.closed)popup.close();
    const n=document.getElementById('notice');n.hidden=false;n.textContent='게임 화면 확인: '+e.message;}
  };
 }
 addEventListener('studio-ready',ready);if(window.StudioApp)ready();
})();
