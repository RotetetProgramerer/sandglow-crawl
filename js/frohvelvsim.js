'use strict';
/* =================================================================
   FRØHVELVET: reglene i minispillet, uten DOM (testes med tools/test-frohvelv.js).
   makeVault(D) lager et spill av data/frohvelv.js. vaultTry(V,valg) prøver et svar og sier hva som skjedde:
     {ok:true|false, say:'det Frøken Frø sier', done:true når stasjonen er ferdig}
   vaultNext(V) går til neste stasjon (V.i===D.stations.length betyr at alle er ferdige).
   Ingen kan tape: et feil svar gir bare et hint, og i pick blir det feile bildet borte (V.off).
   ================================================================= */
function makeVault(D){return{D,i:-1,st:null,planted:false,got:new Set(),round:0,off:new Set(),k:0,done:false,wrong:0,right:0}}
const vaultStation=V=>V.D.stations[V.i]||null;
function vaultNext(V){V.i++;V.planted=false;V.got=new Set();V.round=0;V.off=new Set();V.k=0;V.done=V.i>=V.D.stations.length;return vaultStation(V)}
// what the station is waiting for now: the line Frøken Frø says, and (for pick and sort) the round or the item
function vaultNow(V){const S=vaultStation(V);if(!S)return null;
  if(S.kind==='grow')return{say:V.planted?S.say:S.plant,need:V.planted?'items':'plant'};
  if(S.kind==='pick'){const r=S.rounds[V.round];return r?{say:r.say,round:r}:null}
  if(S.kind==='sort'){const it=S.items[V.k];return it?{say:S.say,item:it}:null}
  return null}
// try an answer. grow: 'plant' or an item id. pick: an option id. sort: true (in) or false (not in)
function vaultTry(V,c){const S=vaultStation(V);if(!S)return{ok:false,say:''};const pr=V.D.praise,P=pr[(V.right)%pr.length];let res;
  if(S.kind==='grow'){
    if(!V.planted){res=c==='plant'?(V.planted=true,{ok:true,say:S.say}):{ok:false,say:S.plant}}
    else{const it=S.items.find(x=>x.id===c);
      if(!it)res={ok:false,say:S.say};
      else if(!it.ok)res={ok:false,say:it.say};
      else if(V.got.has(it.id))res={ok:true,say:it.say,again:true};
      else{V.got.add(it.id);const all=S.items.filter(x=>x.ok).every(x=>V.got.has(x.id));res={ok:true,say:all?S.done:it.say,done:all,stage:V.got.size}}}}
  else if(S.kind==='pick'){const r=S.rounds[V.round];
    if(c===r.answer){V.round++;V.off=new Set();const done=V.round>=S.rounds.length;res={ok:true,say:r.yes,done,next:done?null:S.rounds[V.round]}}
    else{V.off.add(c);res={ok:false,say:S.hint}}}
  else if(S.kind==='sort'){const it=S.items[V.k];
    if(!!c===!!it.in){V.k++;const done=V.k>=S.items.length;res={ok:true,say:done?S.done:(it.in?P+' '+it.label+' skal inn.':P+' '+it.label+' skal ikke inn.'),done}}
    else res={ok:false,say:it.in?S.hint.in:S.hint.out}}
  if(res.ok&&!res.again)V.right++;else if(!res.ok)V.wrong++;
  return res}
if(typeof module!=='undefined')module.exports={makeVault,vaultNext,vaultNow,vaultTry,vaultStation};
