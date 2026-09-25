(function(){
 'use strict';
 let db;
 async function open(){return new Promise((resolve,reject)=>{
  const r=indexedDB.open('loopgirl-scenario-studio-v1',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('items');
  r.onsuccess=()=>{db=r.result;resolve();};r.onerror=()=>reject(r.error);
 });}
 async function get(key){return new Promise((resolve,reject)=>{
  const r=db.transaction('items').objectStore('items').get(key);
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 });}
 async function put(key,value){return new Promise((resolve,reject)=>{
  const t=db.transaction('items','readwrite');t.objectStore('items').put(value,key);
  t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);
 });}
 window.StudioStorage={open,get,put};
})();
