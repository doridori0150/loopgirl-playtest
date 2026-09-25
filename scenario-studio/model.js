(function(root,factory){
 'use strict';
 if(typeof module==='object')module.exports=factory();else root.StudioModel=factory();
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const names={text:'대사·지문',speaker:'화자',label:'선택지',reply:'선택 뒤 응답',face:'표정',portrait:'초상',
  bg:'배경',cg:'컷신',image:'상태 이미지',pose:'자세',action:'행동',emotion:'감정',actor:'인물',
  returnText:'돌아온 뒤 지문',purpose:'장면 목적',before:'진입 상태',after:'종료 상태',reason:'연출 판단',
  anchor:'연결 기준 문장',method:'연출 방식',visual:'보여 줄 장면',exit:'해제·전환',avoid:'피할 오독',
  candidate:'후보 이미지',page:'시작 페이지',endPage:'끝 페이지'};
 const visual=new Set(['bg','cg','image','candidate']);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const esc=s=>String(s).replace(/~/g,'~0').replace(/\//g,'~1');
 function get(o,p){return p.split('/').slice(1).reduce((v,k)=>v?.[k.replace(/~1/g,'/').replace(/~0/g,'~')],o);}
 function set(o,p,v){const a=p.split('/').slice(1).map(k=>k.replace(/~1/g,'/').replace(/~0/g,'~'));
  if(a.some(k=>['__proto__','constructor','prototype'].includes(k)))throw Error('잘못된 필드');
  const k=a.pop(),parent=a.reduce((x,k)=>x[k],o);parent[k]=v;
 }
 function sections(record){
  const out=[];
  const section=(id,title,obj,fields,kind='dialogue',meta={})=>{
   out.push({id,title,kind,...meta,fields:fields.filter(k=>names[k]).map(k=>({
    path:id+'/'+esc(k),name:names[k],key:k,value:obj[k],
    type:visual.has(k)?'asset':['page','endPage'].includes(k)?'number':'text'
   }))});
  };
  function choices(cs,p){(cs||[]).forEach((c,i)=>{
   const at=p+'/'+i;section(at,'선택 '+(i+1),c,['label',...(typeof c.reply==='string'?['reply']:[])],'choice',
    {next:c.next||'',effects:c.effects||null});
   if(c.reply&&typeof c.reply==='object')section(at+'/reply','선택 '+(i+1)+'의 응답',c.reply,
    ['speaker','text','face','portrait','bg','cg']);
  });}
  function node(n,p){
   section(p,(n.name||n.id||record.title)+' · 기본 화면',n,['bg','cg'],'scene',
    {node:n.id||record.id,next:n.next||'',trigger:n.trigger||null});
   (n.pages||[]).forEach((v,i)=>section(p+'/pages/'+i,`${i+1}쪽 · ${v.speaker||'지문'}`,v,
    ['speaker','text','face','portrait','bg','cg'],'dialogue',{node:n.id||record.id,page:i+1}));
   choices(n.choices,p+'/choices');
  }
  if(record.data.nodes)record.data.nodes.forEach((n,i)=>node(n,'/data/nodes/'+i));
  else if(record.layer==='daily'){
   section('/data','일일 대화',record.data,['speaker','text','face','portrait','bg','cg']);
   choices(record.data.choices,'/data/choices');
  }else if(record.layer==='interaction'){
   for(const [k,v] of Object.entries(record.data.states||{}))section('/data/states/'+esc(k),
    '상태 · '+k,v,['actor','text','pose','action','emotion','image','returnText'],'state');
   for(const [k,v] of Object.entries(record.data.actions||{}))section('/data/actions/'+esc(k),
    '동작 · '+k,v,['label'],'choice',{next:v.state});
  }else node(record.data,'/data');
  if(record.direction){
   section('/direction','사건과 정보',record.direction,['purpose','before','after','reason'],'direction');
   (record.direction.cues||[]).forEach((c,i)=>section('/direction/cues/'+i,'콘티 · '+c.id,c,
    ['page','endPage','anchor','method','visual','exit','avoid','candidate'],'direction'));
  }
  return out;
 }
 function validate(base,changes,assets){
  if(!Array.isArray(changes)||changes.length>1000)throw Error('한 번에 저장할 수정 수를 확인하세요.');
  const fields=new Map(sections(base).flatMap(s=>s.fields).map(f=>[f.path,f])),seen=new Set();
  const result=copy(base);
  for(const c of changes){
   const f=fields.get(c.path);if(!f||seen.has(c.path))throw Error('편집할 수 없거나 중복된 항목: '+c.path);
   seen.add(c.path);
   if(c.remove){
    if(!['bg','cg','portrait','face','candidate'].includes(f.key))throw Error('필수 항목은 삭제할 수 없습니다.');
    const parts=c.path.split('/'),key=parts.pop();delete get(result,parts.join('/'))[key];continue;
   }
   if(c.value!==null&&typeof c.value!=='string'&&typeof c.value!=='number')throw Error('잘못된 값');
   if(f.type==='number'){
    if(!Number.isInteger(c.value)||c.value<1||c.value>1000)throw Error('페이지는 1 이상의 정수입니다.');
   }else if(c.value!==null&&typeof c.value!=='string')throw Error('문자열만 입력할 수 있습니다.');
   if(typeof c.value==='string'&&c.value.length>20000)throw Error('항목당 20,000자를 넘을 수 없습니다.');
   if(f.key==='text'&&(!c.value||!c.value.trim()))throw Error('대사·지문은 비울 수 없습니다.');
   if(f.type==='asset'&&c.value&&!assets.has(c.value))throw Error('등록된 이미지 목록에서 선택하세요.');
   if(['image','bg'].includes(f.key)&&/\.mp4$/i.test(c.value||''))
    throw Error('배경·상태 이미지는 정지 이미지로 지정하세요. 영상은 컷신에 첨부할 수 있습니다.');
   if(f.key==='portrait'&&c.value&&!/^[a-z0-9_-]{1,60}$/.test(c.value))throw Error('초상 ID를 확인하세요.');
   set(result,c.path,c.value);
  }
  for(const c of result.direction?.cues||[]){
   const pages=result.data.pages||[];
   if(c.page>c.endPage||c.endPage>pages.length)throw Error('콘티 페이지 범위를 확인하세요.');
   if(!pages[c.page-1]?.text.includes(c.anchor))throw Error('콘티 기준 문장이 시작 페이지에 없습니다.');
  }
  return result;
 }
 function diff(base,working){return sections(base).flatMap(s=>s.fields).flatMap(f=>{
  const before=get(base,f.path),after=get(working,f.path);
  return JSON.stringify(before)===JSON.stringify(after)?[]:[{path:f.path,label:f.name,
   before:before??null,after:after??null,beforeExists:before!==undefined,afterExists:after!==undefined}];
 });}
 function frame(record,section){
  let bg=null,cg=null,portrait=null,face=null,speaker='',text='';
  const node=section.id.startsWith('/data/nodes/')?record.data.nodes[+section.id.split('/')[3]]:record.data;
  const apply=p=>{if(Object.hasOwn(p,'bg'))bg=p.bg;if(Object.hasOwn(p,'cg'))cg=p.cg;
   if(Object.hasOwn(p,'portrait'))portrait=p.portrait;if(Object.hasOwn(p,'face'))face=p.face;
   speaker=p.speaker||p.actor||'';text=p.text||(typeof p.reply==='string'?p.reply:p.reply?.text)||p.label||'';};
  apply(node);
  if(section.page)for(let i=0;i<section.page;i++)apply(node.pages[i]);else apply(get(record,section.id)||{});
  return {bg,cg,portrait,face,speaker,text,image:get(record,section.id)?.image};
 }
 return {sections,get,set,copy,validate,diff,frame,names};
});
