(function(root,factory){
 'use strict';
 if(typeof module==='object')module.exports=factory();else root.StudioAttachments=factory();
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const maxBytes=15*1024*1024,totalBytes=60*1024*1024;
 const formats={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','video/mp4':'mp4'};
 const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
 async function digest(bytes){return hex(await crypto.subtle.digest('SHA-256',bytes));}
 function bytesOf(base64){
  if(typeof base64!=='string'||base64.length>Math.ceil(maxBytes/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))
   throw Error('첨부파일 크기 또는 형식이 맞지 않습니다.');
  return Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
 }
 function signature(b,mime){
  const ascii=(a,z)=>String.fromCharCode(...b.slice(a,z));
  return mime==='image/png'?hex(b.slice(0,8))==='89504e470d0a1a0a':
   mime==='image/jpeg'?hex(b.slice(0,3))==='ffd8ff':
   mime==='image/webp'?ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP':mime==='video/mp4'&&ascii(4,8)==='ftyp';
 }
 async function validate(map){
  if(!map||typeof map!=='object'||Array.isArray(map)||Object.keys(map).length>100)throw Error('잘못된 첨부 목록');
  let total=0;
  for(const [p,a] of Object.entries(map)){
   if(!a||!formats[a.mime]||typeof a.name!=='string'||a.name.length>250)throw Error('지원하지 않는 첨부파일');
   const bytes=bytesOf(a.data);total+=bytes.length;
   if(total>totalBytes||bytes.length>maxBytes)throw Error('첨부는 개별 15MB, 합계 60MB까지입니다.');
   if(!signature(bytes,a.mime))throw Error('실제 파일 형식이 확장자와 다릅니다.');
   const hash=await digest(bytes);
   if(a.sha256!==hash||p!==`attachments/${hash}.${formats[a.mime]}`)throw Error('첨부파일 내용이 달라졌습니다.');
  }
  return Object.keys(map);
 }
 async function fromFile(file){
  if(file.size>maxBytes||!formats[file.type])throw Error('PNG·JPG·WEBP·MP4 파일을 15MB 이내로 첨부하세요.');
  const bytes=new Uint8Array(await file.arrayBuffer()),hash=await digest(bytes);let raw='';
  for(let i=0;i<bytes.length;i+=32768)raw+=String.fromCharCode(...bytes.slice(i,i+32768));
  const path=`attachments/${hash}.${formats[file.type]}`;
  const value={name:file.name,mime:file.type,sha256:hash,data:btoa(raw)};await validate({[path]:value});
  return {path,value};
 }
 return {validate,fromFile,bytesOf,maxBytes,totalBytes};
});
