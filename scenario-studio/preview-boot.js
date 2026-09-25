(function(){
 'use strict';
 // The copied game must never read/write the visitor's real play data, preferences or player name.
 function memory(){const values=new Map();return {get length(){return values.size;},
  getItem:k=>values.has(String(k))?values.get(String(k)):null,
  setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(String(k)),clear:()=>values.clear(),
  key:i=>[...values.keys()][i]??null};}
 for(const key of ['localStorage','sessionStorage'])
  Object.defineProperty(window,key,{value:memory(),configurable:false});
 window.LOOPGIRL_SCENARIO_SANDBOX=true;
})();
