// Firebase-Attrappe im Speicher: Auth, Realtime Database (once/on/set/update/transaction, Abfragen)
const store={}; const listeners=new Set();
const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
const hooks=[];   // werden nach jedem Schreiben aufgerufen (für die simulierte Cloud Function)
/* ServerValue.TIMESTAMP ({".sv":"timestamp"}) durch die aktuelle Zeit ersetzen */
const resolve=v=>Array.isArray(v)?v.map(resolve):v&&typeof v==='object'?(v['.sv']==='timestamp'?Date.now():Object.fromEntries(Object.entries(v).map(([k,x])=>[k,resolve(x)]))):v;
let pushN=0;
function get(path){ let o=store; for(const k of path.split('/').filter(Boolean)){ if(o==null||typeof o!=='object') return null; o=o[k]; } return o===undefined?null:clone(o); }
function setP(path,val){ const ks=path.split('/').filter(Boolean); let o=store; for(let i=0;i<ks.length-1;i++){ if(typeof o[ks[i]]!=='object'||o[ks[i]]===null) o[ks[i]]={}; o=o[ks[i]]; } if(val===null||val===undefined) delete o[ks.at(-1)]; else o[ks.at(-1)]=clone(resolve(val)); setTimeout(()=>listeners.forEach(l=>l()),3); hooks.forEach(h=>h(ks.join('/'),val)); }
function snap(v){ return {val:()=>clone(v)}; }
function makeFirebase(email){
  let user=null;
  function ref(path='',q){ return {
    child:k=>ref(path+'/'+k),
    push:()=>ref(path+'/-g'+Date.now().toString(36)+(pushN++)),
    get key(){ return path.split('/').filter(Boolean).at(-1); },
    orderByChild:(f)=>ref(path,{f}), limitToLast:(n)=>ref(path,Object.assign({},q,{n})), startAt:(a)=>ref(path,Object.assign({},q,{a})), endAt:(b)=>ref(path,Object.assign({},q,{b})), limitToFirst:(n)=>ref(path,Object.assign({},q,{first:n})),
    once:async()=>{ let v=get(path); if(q&&q.f&&v){ let ent=Object.entries(v); if(q.a!==undefined) ent=ent.filter(e=>{const x=(e[1]||{})[q.f]; return typeof x==='string'&&x>=q.a&&x<=q.b;}); ent.sort((a,b)=>{const x=(a[1]||{})[q.f]||0,y=(b[1]||{})[q.f]||0; return x<y?-1:x>y?1:0;}); if(q.first) ent=ent.slice(0,q.first); else ent=ent.slice(-(q.n||1e9)); v=Object.fromEntries(ent);} return snap(v); },
    on(ev,cb){ const l=()=>cb(snap(get(path))); l.cb=cb; l.path=path; listeners.add(l); setTimeout(l,1); return cb; },
    off(ev,cb){ for(const l of listeners) if((cb&&l.cb===cb)||(!cb&&l.path===path)) listeners.delete(l); },
    set(v){ if(path.startsWith('codes/')&&get(path)!=null) return Promise.reject(new Error('PERMISSION_DENIED')); setP(path,v); return Promise.resolve(); },
    update(o){ for(const k in o) setP(path+"/"+k,o[k]); return Promise.resolve(); },
    remove(){ setP(path,null); return Promise.resolve(); },
    async transaction(fn){ const nv=fn(get(path)); if(nv!==undefined) setP(path,nv); return {committed:nv!==undefined}; },
    onDisconnect(){ return {remove(){}, cancel(){}}; } }; }
  const obs=new Set();
  const auth={ get currentUser(){return user;}, onAuthStateChanged(f){ obs.add(f); setTimeout(()=>f(user),1); return ()=>obs.delete(f); },
    async createUserWithEmailAndPassword(m,p){ user={uid:'u_'+m.split('@')[0],email:m,displayName:'',updateProfile(o){ Object.assign(user,o); return Promise.resolve(); }}; obs.forEach(f=>f(user)); return {user}; },
    async signInWithEmailAndPassword(m,p){ return this.createUserWithEmailAndPassword(m,p); },
    async signOut(){ user=null; obs.forEach(f=>f(null)); } };
  const database=()=>({ref:(p)=>ref(p)});
  database.ServerValue={TIMESTAMP:{'.sv':'timestamp'}};
  return { initializeApp(){}, auth:()=>auth, database };
}
module.exports={makeFirebase,store,hooks};
