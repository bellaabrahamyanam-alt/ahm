const P={
 compass:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
 borders:'<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/>',
 routes:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h5.5a3.5 3.5 0 000-7h-3a3.5 3.5 0 010-7H16"/>',
 rivers:'<path d="M3 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
 layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
 more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
 search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
 sliders:'<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/>',
 sort:'<path d="M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4"/>',
 fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
 left:'<path d="M15 6l-6 6 6 6"/>',right:'<path d="M9 6l6 6-6 6"/>',up:'<path d="M6 15l6-6 6 6"/>',down:'<path d="M6 9l6 6 6-6"/>',
 x:'<path d="M7 7l10 10M17 7L7 17"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
 nav:'<path d="M3 11L21 3l-8 18-2-8z"/>',
 stackplus:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 4-2.2"/><path d="M19 15v6M16 18h6"/>',
 locate:'<circle cx="12" cy="12" r="6"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
 calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
 timetravel:'<path d="M3.5 12a8.5 8.5 0 108.5-8.5A8.6 8.6 0 005.8 6M3 4v3.5h3.5"/><path d="M10.5 9v6l4.5-3z" fill="currentColor"/>',
 play:'<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
 trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
 upload:'<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
 mount:'<path d="M2.5 19L9 8l4 6.5 2.8-4L21.5 19z"/>',
 note:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
 map:'<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
 lang:'<path d="M4 6h9M8.5 4v2M6 6c.5 3 3 6 6 7M12 6c-.5 3-3 6-6.5 7.5"/><path d="M13 20l4-9 4 9M14.4 17h5.2"/>',
 tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
 folder:'<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
 image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
 alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
 collapse:'<path d="M7 4l5 5 5-5M7 20l5-5 5 5"/>',
 pen:'<path d="M4 20c4-1 5-4 8-7M14 5l5 5-9 9H5v-5z"/>',
 swap:'<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>'
};
const ic=(n,s=16)=>`<svg class="i" viewBox="0 0 24 24" width="${s}" height="${s}">${P[n]}</svg>`;
const ib=(n,t,x='')=>`<button class="ib ${x}" title="${t}" aria-label="${t}">${ic(n)}</button>`;
const TABS=[['compass','Explore'],['borders','Borders'],['routes','Routes'],['rivers','Rivers'],['layers','Layers'],['more','More']];
const hdr=(tab)=>`<header class="hd"><div class="brand"><div class="logo">${ic('mount',18)}</div><div><h1>Armenian Highlands</h1><p>Historical atlas</p></div></div>${ib('left','Hide panel')}</header><nav class="tabs">${TABS.map(([i,t])=>`<button class="tab ${t==tab?'on':''}">${ic(i,20)}${t}</button>`).join('')}</nav>`;
const out=[];
const F=(id,t,inner,cls='')=>out.push(`<div><p class="ttl">${t}</p><div class="frame ${cls}" id="${id}">${inner}</div></div>`);
const side=(tab,body,foot='')=>`${hdr(tab)}<div class="scroll">${body}</div>${foot}`;

/* ---------- fields ---------- */
const inp=(v,x='')=>`<div class="in ${x}">${v}</div>`;
const ph=(t)=>`<span style="color:var(--muted)">${t}</span>`;
const sel=(t,mk='')=>`<div class="in sel">${mk}<span>${t}</span>${ic('down',14)}</div>`;
const fld=(l,b)=>`<div class="sec">${l}</div>${b}`;
const dchip=(t)=>`<span class="dash">${ic('plus',14)}${t}</span>`;
const LC=['hy','en','la','ru','tr','xur'];
const pills=(c)=>`<div class="pills">${LC.map(x=>`<span class="pl ${x==c?'on':''}">${x}</span>`).join('')}</div>`;
const TP={City:['circle','#B3261E'],Fortress:['square','#455A64'],Temple:['diamond','#7B1FA2'],Settlement:['circle s','#8D6E63'],Mountain:['tri','#2E7D32'],Tomb:['square','#6D4C41'],Town:['circle','#E07B39'],Village:['circle s','#C9A227']};
const typePills=(cur)=>`<div class="pills">${Object.entries(TP).map(([n,[k,c]])=>`<span class="pl big ${n==cur?'on':''}"><i class="${k}" style="--c:${n==cur?'#fff':c};${k=='diamond'?'transform:rotate(45deg);width:8px;height:8px':k=='tri'?'clip-path:polygon(50% 0,100% 100%,0 100%);width:11px;height:10px':k=='circle'?'border-radius:50%':k=='circle s'?'border-radius:50%':'border-radius:2px'}"></i>${n}</span>`).join('')}</div>`;
const shapePills=(arr)=>`<div class="pills">${arr.map(([n,c,on,k])=>`<span class="pl big ${on?'on':''}"><svg viewBox="0 0 24 24" width="14" height="14" stroke-linecap="round" stroke-linejoin="round">${k=='area'?`<path d="M4 8l8-4 8 4v8l-8 4-8-4z" fill="${on?'#fff':c}" fill-opacity="${on?.35:.3}" stroke="${on?'#fff':c}" stroke-width="2.4"/>`:`<path d="M4 18c4-9 8 1 16-12" stroke="${on?'#fff':c}" stroke-width="3" fill="none"/>`}</svg>${n}</span>`).join('')}</div>`;

/* ---------- date composer: certainty switch, format pill + live "shown as", fields, CE|BCE toggle ---------- */
const DFP={'YYYY-MM-DD':['y','m','d'],'DD.MM.YYYY':['d','m','y'],'MM/DD/YYYY':['m','d','y'],'D Month YYYY':['d','M','y'],'Month YYYY':['M','y'],'Year':['y'],'Century':['n'],'Millennium':['n']};
const FW={y:'1.3fr',m:'.8fr',d:'.8fr',M:'1.5fr',n:'1fr'};
const ord=(n)=>{n=+n;const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])};
const showD=(f,v)=>{const x=(v||'').split('|');return {'YYYY-MM-DD':`${x[0]}-${x[1]}-${x[2]}`,'DD.MM.YYYY':`${x[0]}.${x[1]}.${x[2]}`,'MM/DD/YYYY':`${x[0]}/${x[1]}/${x[2]}`,'D Month YYYY':`${x[0]} ${x[1]} ${x[2]}`,'Month YYYY':`${x[0]} ${x[1]}`,'Year':x[0],'Century':ord(x[0])+' century','Millennium':ord(x[0])+' millennium'}[f]};
const eraT=(e)=>`<span class="era"><button class="${e=='CE'?'on':''}">CE</button><button class="${e=='BCE'?'on':''}">BCE</button></span>`;
const fieldRow=(fmt,v,e)=>{const ps=DFP[fmt],vs=(v||'').split('|'),w=fmt=='Century'?'century':fmt=='Millennium'?'millennium':'';
 const cols=ps.map(p=>FW[p]).join(' ')+(w?' auto':'')+' auto';
 const cells=ps.map((p,i)=>{const x=vs[i];return p=='M'?sel(x||ph('Month')):inp(x?x:ph({d:'DD',m:'MM',y:'YYYY',n:'n'}[p]))}).join('');
 return `<div class="drow" style="grid-template-columns:${cols}">${cells}${w?`<span class="u">${w}</span>`:''}${eraT(e)}</div>`};
const dateF=(m,a,b,era='CE',fmt='Year',o={})=>{
 const modes=o.modes||['Unknown','Exact','Approx.','Range'];const [e1,e2]=(era+'').split('|'),E2=e2||e1;
 const seg=`<div class="seg">${modes.map(x=>`<button class="${x==m?'on':''}">${x}</button>`).join('')}</div>`;
 const fp=`<span class="fmtp" title="Date format">${ic('calendar',14)}<span>${fmt}</span>${ic('down',12)}</span>`;
 let h=`<div class="df${o.cmp?' cmp':''}">`+(o.cmp?`<div class="dmeta">${seg}${fp}</div>`:seg);
 if(m!='Unknown'){
  const pre=m=='Approx.'?'c. ':'';
  const sh=m=='Range'?(e1==E2?`${showD(fmt,a)} – ${showD(fmt,b)} ${e1}`:`${showD(fmt,a)} ${e1} – ${showD(fmt,b)} ${E2}`):`${pre}${showD(fmt,a)} ${e1}`;
  if(!o.cmp)h+=`<div class="dmeta">${fp}<span class="shown">${sh}</span></div>`;
  if(m=='Range')h+=`<div class="dlab">From</div>${fieldRow(fmt,a,e1)}<div class="dlab">To</div>${fieldRow(fmt,b,E2)}`;else h+=fieldRow(fmt,a,e1);
 }
 return h+'</div>'};

/* ---------- names: pill language, input, compact "Period" row (reference image), add-another ---------- */
const nameRow=(code,val,o={})=>{const x=o.x!==false,per=o.per===undefined?false:o.per;
 let p='';
 if(per==='unknown')p=`<div class="perrow">${ic('clock',14)}<span>Period: unknown</span><a>Set</a></div>`;
 else if(typeof per==='string')p=`<div class="perrow">${ic('clock',14)}<span>Period: <b>${per}</b></span><a>Edit</a></div>`;
 else if(per&&per.open)p=`<div class="perrow">${ic('clock',14)}<span>Period</span><a>Done</a></div>${dateF(per.m,per.a,per.b,per.era,per.fmt||'Year')}`;
 return `<div class="ncard ${per&&per.open?'edit':''}">${pills(code)}<div class="r">${inp(val)}${o.up?ib('up','Move up','sm'):''}${x?ib('x','Remove this name','sm'):''}</div>${p}</div>`};
const ADD=`<div style="margin-top:2px">${dchip('Add another name')}</div>`;

/* ---------- accordion ---------- */
const acc=(head,body,open=true)=>`<div class="acc ${open?'open':''}"><div class="acc-h">${head}</div>${open&&body?`<div class="acc-b">${body}</div>`:''}</div>`;
const foldH=(i,t,sub,open)=>`<span class="ic">${ic(i,18)}</span><div class="tx">${t}<div class="sub">${sub}</div></div><span class="ch">${ic(open?'up':'down')}</span>`;
const fold=(i,t,sub,body,open=true)=>acc(foldH(i,t,sub,open&&!!body),body,open&&!!body);
const PL=[['Ani','#B3261E','circle','961 – 1319 CE',1],['Artashat','#B3261E','circle','176 BCE – 370 CE',2],['Dvin','#8D6E63','circle s','335 – 1236 CE',0],['Erebuni','#455A64','square','782 – 600 BCE',0],['Garni','#7B1FA2','diamond','from c. 800 BCE',1]];
const mk=(p)=>`<span class="mk"><i class="${p[2]}" style="--c:${p[1]}${p[2]=='diamond'?';transform:rotate(45deg);width:10px;height:10px':''}"></i></span>`;
const row=(p)=>`<li class="row">${mk(p)}<div class="tx"><div class="nm">${p[0]}</div><div class="dt">${p[3]}</div></div>${p[4]?`<span class="nn">${ic('note',14)}${p[4]}</span>`:''}</li>`;
const placeAcc=(p,body)=>`<li style="list-style:none">${acc(`${mk(p)}<div class="tx"><div class="nm">${p[0]}</div><div class="dt">${p[3]}</div></div>${p[4]?`<span class="nn">${ic('note',14)}${p[4]}</span>`:''}<span class="ch">${ic('up')}</span>`,body)}</li>`;
const searchRow=(ph_,on)=>`<div class="srow"><div class="search">${ic('search')}<div class="in" style="color:var(--muted)">${ph_}</div></div><button class="ib ${on?'on':''}" title="Filters">${ic('sliders')}${on?'<span class="badge">2</span>':''}</button></div>`;
const bar=(c,extra='')=>`<div class="rbar"><span class="cnt">${c}</span>${extra}${ib('fit','Zoom the map to the results','sm')}</div>`;

/* ---------- footers: Period (filter) and Moment (time travel) share one track ---------- */
const BARS=(a,b)=>[3,4,6,7,9,10,8,7,9,11,10,8,6,7,9,12,14,12,10,9,8,10,12,13,11,9,8,7,9,10,12,13,11,8,6,5,4,3,2,2].map((v,i)=>[v,i*2.5>=a&&i*2.5<=b]);
const bars=(a,b)=>`<div class="bars">${BARS(a,b).map(v=>`<i class="${v[1]?'in':''}" style="height:${v[0]}px"></i>`).join('')}</div>`;
const pfoot=(lbl='Any',a=0,b=100)=>`<footer class="foot"><div class="line"><span style="color:var(--blue)">${ic('clock')}</span><span class="lbl">Period <b>${lbl}</b></span>${ib('timetravel','Time travel: show the map at one moment','sm')}${ib('x','Reset the period','sm')}</div>
 <div class="track">${bars(a,b)}<div class="rail"></div><div class="fill" style="left:${a}%;right:${100-b}%"></div><span class="h" style="left:${a}%"></span><span class="h" style="left:${b}%"></span></div><div class="ticks"><span>1200 BCE</span><span>0</span><span>1500 CE</span></div></footer>`;
const mfoot=()=>`<footer class="foot"><div class="line" style="gap:12px"><span class="playb">${ic('play',16)}</span><div class="atm"><small>Moment</small>c. 85 BCE</div><span style="flex:1"></span>${ib('x','Back to Period','sm')}</div>
 <div class="speed"><span>1×</span><span>10×</span><span class="on">50×</span><span>100×</span><span>500×</span></div>
 <div class="track">${bars(0,48)}<div class="rail"></div><div class="fill" style="left:0;right:52%"></div><span class="h" style="left:48%"></span></div><div class="ticks"><span>1200 BCE</span><span>0</span><span>1500 CE</span></div>
 <div class="swr" style="padding:0"><div style="font-size:12.5px">Show undated places</div><span class="sw on"></span></div></footer>`;
const pair=(a='Save',b='Cancel',dis=false)=>`<div class="pair"><button class="btn primary ${dis?'dis':''}">${a}</button><button class="btn alt">${b}</button></div>`;
const ffoot=(a='Save',dis=false)=>`<footer class="foot form">${pair(a,'Cancel',dis)}</footer>`;
const colr=(on=0,cs=['#9a3b2e','#2a5f8f','#5d7a3a','#c9a227','#7b1fa2','#455a64'])=>`<div class="colr">${cs.map((c,i)=>`<i style="--c:${c}" class="${i==on?'on':''}"></i>`).join('')}<i class="pick"></i></div>`;
const hdrTrash=(t,tip)=>`<div class="fhd"><h5>${t}</h5>${ib('trash',tip,'danger')}</div>`;
const note=(t,lang,when,text,open,mkm=true)=>`<div class="note"><div class="h"><h4>${t}</h4>${ib('edit','Edit note','sm')}${ib('trash','Delete note','sm danger')}</div><div class="m"><span class="lg2">${lang}</span><span class="dot">·</span>${when?`${ic('clock',12)}<span>${when}</span>`:'<span>No date</span>'}</div><p class="${open?'':'clamp'}">${text}</p>${mkm?`<span class="more">${open?'Show less':'Show more'} ${ic(open?'up':'down',14)}</span>`:''}</div>`;
const LT='Founded around 176 BCE by King Artaxias I as the new capital of the Artaxiad kingdom. Plutarch says Hannibal advised on the site, a low hill in a loop of the Araks, which made it easy to defend. The city grew into a trade centre between the Caucasus and Mesopotamia.';

/* ================= SCREENS ================= */
/* 1 Explore */
F('s1','1 · Explore: Period footer with a Time-travel button',side('Explore',`${searchRow('Search places, names, notes…')}${bar('<b>10</b> places',ib('sort','Sort','sm'))}<ul class="list">${PL.map(row).join('')}</ul>`,pfoot()));

/* 2 Filters */
const tchip=(c,k,n,cnt,on)=>`<span class="chip" style="${on?'background:var(--blue);border-color:var(--blue);color:#fff':''}"><i style="display:block;width:9px;height:9px;background:${on?'#fff':c};${k=='circle'?'border-radius:50%':k=='diamond'?'transform:rotate(45deg);width:8px;height:8px':'border-radius:2px'}"></i>${n} <small style="opacity:.7">${cnt}</small></span>`;
F('s2','2 · Explore: filters (Period From / To use the same date field)',side('Explore',
 `${searchRow('Search places, names, notes…',true)}
 <div class="chips" style="margin-top:10px"><span class="chip act">Fortress <span class="x">${ic('x',12)}</span></span><span class="chip act">Period 800 – 500 BCE <span class="x">${ic('x',12)}</span></span><span class="chip clear">Clear all</span></div>
 <div class="sec">Type</div><div class="chips">${tchip('#B3261E','circle','City',5)}${tchip('#455A64','square','Fortress',3,true)}${tchip('#8D6E63','circle','Settlement',1)}${tchip('#7B1FA2','diamond','Temple',1)}</div>
 <div class="sec">Certainty</div><div class="chips"><span class="chip">Exact <small>0</small></span><span class="chip">Approximate <small>0</small></span><span class="chip">Disputed <small>0</small></span></div>
 <div class="sec">Language</div>${sel('All languages')}
 <div class="sec">Period</div><div class="dlab" style="margin:0 0 6px 2px">From</div>${dateF('Exact','800','','BCE','Year',{modes:['Unknown','Exact'],cmp:1})}<div class="dlab" style="margin:12px 0 6px 2px">To</div>${dateF('Exact','500','','BCE','Year',{modes:['Unknown','Exact'],cmp:1})}`,pfoot('800 – 500 BCE',13,31)));

/* 3 Place details: one accordion card */
F('s3','3 · Place details: header and body are one card, one continuous blue edge',side('Explore',
 `${searchRow('Search places, names, notes…')}${bar('<b>10</b> places',ib('sort','Sort','sm'))}<ul class="list">${row(PL[0])}${placeAcc(PL[1],
 `<div class="tools">${ib('edit','Edit place','sm')}${ib('nav','Directions from here','sm')}${ib('stackplus','Add to a layer','sm')}${ib('locate','Show on map','sm')}<span class="sp"></span>${ib('fit','Enlarge this pane','sm')}</div>
 <div class="names" style="margin-top:6px"><span>Արտաշատ<em>hy</em></span><span>Artaxata<em>la</em></span></div>
 <div class="sec">Layers</div><div class="chips"><span class="chip"><i style="width:8px;height:8px;border-radius:50%;background:#5d7a3a;display:block"></i>Artaxiad capitals</span>${dchip('Add to a layer')}</div>
 <div class="sec">Notes · 2</div>${note('Foundation','en','176 BCE',LT,false)}${note('Roman campaigns','en','163 – 166 CE','Burned by Roman forces in 163 CE; the capital moved to Vagharshapat.',false,false)}
 <button class="btn primary">${ic('plus',14)}Add note</button>`)}${row(PL[2])}${row(PL[3])}</ul>`,pfoot()));

/* 7 Place edit */
F('s7','7 · Edit a place: Add another name, compact Period row, new date field',side('Explore',
 `<ul class="list">${placeAcc(PL[1],
 `<div class="fhd" style="margin-bottom:2px"><h5>Edit place</h5></div>
 <div class="sec" style="margin-top:10px">Names</div>
 ${nameRow('hy','Արտաշատ',{per:'unknown'})}${nameRow('en','Artashat',{per:'176 BCE – 370 CE',up:true})}${ADD}
 <p class="hint">The first name of each language is shown on the map. Language missing? Ask an administrator (More › Languages).</p>
 ${fld('Type',typePills('City'))}
 ${fld('Began / founded',dateF('Exact','176','','BCE'))}
 ${fld('Ended / abandoned',dateF('Unknown'))}`)}</ul>`,ffoot()));

/* 28 Name period expanded */
F('s28','28 · Period of a name: tap Edit, same date field, Done folds it back',side('Explore',
 `<ul class="list">${placeAcc(PL[2],
 `<div class="fhd" style="margin-bottom:2px"><h5>Edit place</h5></div><div class="sec" style="margin-top:10px">Names</div>
 ${nameRow('en','Dvin',{per:'335 – 700 CE',x:false})}
 ${nameRow('hy','Դվին',{per:{open:true,m:'Range',a:'800',b:'700',era:'BCE|BCE'},up:true})}${ADD}`)}</ul>`,ffoot()));

/* 19 More */
const langs=[['hy','Armenian','Հայերեն'],['en','English',''],['ru','Russian','Русский'],['la','Latin','Latina']];
const tl=(m,n,g)=>`<div class="rw2">${m}<div class="tx">${n}</div><span class="tag">${g}</span>${ib('edit','Edit '+n,'sm')}</div>`;
const mkm=(k,c)=>`<span class="mk" style="width:28px;height:28px"><i class="${k}" style="--c:${c}"></i></span>`;
F('s19','19 · More: every section is the same accordion card',side('More',
 fold('map','Maps &amp; base map','Terrain · 3D view · relief','',false)+fold('nav','Directions','Car route between two points','',false)+
 fold('lang','Languages','6 languages',`<div class="hint" style="margin:0 0 8px">Every name and note uses one of these languages. Missing one? Ask an administrator.</div><div class="lg hd2"><span>Code</span><span>Name</span><span>In the language</span><span></span></div>${langs.map(l=>`<div class="lg"><span class="c">${l[0]}</span><span>${l[1]}</span><span class="n">${l[2]||'–'}</span>${ib('edit','Edit '+l[1],'sm')}</div>`).join('')}<div style="margin-top:8px">${dchip('Add language')}</div>`)+
 fold('tag','Types','25 place, route and area types',`<div class="sec" style="margin-top:0">Places</div>${tl(mkm('circle','#B3261E'),'City','point')}${tl(mkm('square','#455A64'),'Fortress','point')}${tl(mkm('diamond','#7B1FA2'),'Temple','point')}<div class="rw2" style="color:var(--muted)">+ 10 more</div><div class="sec">Routes</div>${tl(mkm('square','#c9a227'),'Trade','line')}<div style="margin-top:10px">${dchip('Place type')} ${dchip('Route type')}</div>`)+
 fold('folder','Categories','Groups for layers','',false)));

/* 21 More: historical maps + categories */
F('s21','21 · More: historical maps and categories (same accordion)',side('More',
 fold('image','Historical maps','1 image overlay',`<div class="card" style="background:var(--bg);padding:10px 12px"><div style="display:flex;align-items:center;gap:10px"><span class="mk" style="width:24px;height:24px;border-radius:6px;background:var(--blue);border-color:var(--blue);color:#fff">${ic('check',12)}</span><b style="flex:1;color:var(--ink);font-weight:600">Map of Greater Armenia, 1 c. BCE</b>${ib('fit','Fit to the map','sm')}${ib('edit','Edit overlay','sm')}</div><div class="look" style="grid-template-columns:62px 1fr 38px;margin-top:8px"><span class="l">Opacity</span><div class="range"><i style="width:60%"></i><b style="left:60%"></b></div><span class="v">60%</span></div></div><div style="margin-top:8px">${dchip('Add image overlay')}</div>`)+
 fold('folder','Categories','Groups for layers',['Military campaign','State or kingdom','Trade network'].map(c=>`<div class="rw2" style="padding:6px 2px"><div class="tx">${c}</div>${ib('edit','Rename '+c,'sm')}</div>`).join('')+`<div style="margin-top:6px">${dchip('Add category')}</div>`)+
 fold('nav','Directions','Car route between two points','',false)+fold('lang','Languages','6 languages','',false)));

/* 20 / 43 / 44 type editors */
const SYM={circle:'<circle cx="12" cy="12" r="7"/>',ring:'<circle cx="12" cy="12" r="6.5" fill="none" stroke="#455A64" stroke-width="3"/>',square:'<rect x="5" y="5" width="14" height="14" rx="2"/>',diamond:'<path d="M12 3l9 9-9 9-9-9z"/>',triangle:'<path d="M12 4l9 15H3z"/>',plus:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',hexagon:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/>',drop:'<path d="M12 3s7 7.5 7 12a7 7 0 01-14 0c0-4.5 7-12 7-12z"/>',bar:'<rect x="3" y="10" width="18" height="4" rx="2"/>',cedar:'<path d="M12 2l5 6h-3l4 5h-4l3 4H7l3-4H6l4-5H7zM11 17h2v4h-2z"/>',mine:'<path d="M3 9c4-5 14-5 18 0l-2.4 1.6C15.8 8 8.2 8 5.4 10.6zM11 9h2v12h-2z"/>'};
const symT=(n,on,cu)=>`<span class="sym ${on?'on':''}">${`<svg viewBox="0 0 24 24" width="22" height="22" fill="#455A64">${SYM[n]}</svg>`}${cu?'<em>svg</em>':''}</span>`;
const patT=(d,on)=>`<span class="sym ${on?'on':''}" style="height:36px"><svg width="46" height="8"><line x1="2" y1="4" x2="44" y2="4" stroke="#455A64" stroke-width="3" stroke-linecap="round" ${d?`stroke-dasharray="${d}"`:''}/></svg></span>`;
const prev=(i)=>`<div class="card" style="display:flex;align-items:center;gap:14px;padding:12px 14px">${i}</div>`;
F('s20','20 · Place type editor: Add another name, symbol list, uploaded symbols',side('More',
 `${hdrTrash('Edit type · Fortress','Remove this type (only when nothing uses it)')}
 <div class="sec" style="margin-top:12px">Names</div>${nameRow('en','Fortress',{x:false})}${nameRow('hy','Ամրոց')}${ADD}
 <div class="sec">Symbol</div><div class="symgrid">${['circle','ring','square','diamond','triangle','plus','star','hexagon','drop','bar'].map(n=>symT(n,n=='square')).join('')}${symT('cedar',false,1)}${symT('mine',false,1)}<span class="sym up">${ic('upload',20)}</span></div>
 <p class="hint">Built-in symbols, then your uploaded SVG ones. Upload a simple one-colour SVG; it is drawn in the colour below.</p>
 <div class="sec">Colour and size</div><div class="look"><span class="l">Colour</span>${colr(5,['#455a64','#8d6e63','#b3261e','#c9a227','#7b1fa2','#2a5f8f'])}<span></span><span class="l">Size</span><div class="range"><i style="width:45%"></i><b style="left:45%"></b></div><span class="v">8.5</span></div>
 <div class="sec">Preview</div>${prev(`<i style="display:block;width:11px;height:11px;border-radius:2px;background:#455A64;box-shadow:0 0 0 2px #fff"></i><span style="font:600 14px var(--serif);color:var(--ink)">Tushpa</span><span class="hint" style="margin:0 0 0 auto">on the map</span>`)}`,ffoot()));
F('s43','43 · Route / river type editor: Add another name',side('More',
 `${hdrTrash('Edit type · Military','Remove this type (only when nothing uses it)')}
 <div class="sec" style="margin-top:12px">Names</div>${nameRow('en','Military',{x:false})}${nameRow('hy','Ռազմական')}${ADD}
 <div class="sec">Line</div><div class="look"><span class="l">Colour</span>${colr(2,['#c9a227','#2a5f8f','#9a3b2e','#5d7a3a','#7b1fa2','#455a64'])}<span></span><span class="l">Width</span><div class="range"><i style="width:40%"></i><b style="left:40%"></b></div><span class="v">2.5 px</span><span class="l">Opacity</span><div class="range"><i style="width:85%"></i><b style="left:85%"></b></div><span class="v">85%</span></div>
 <div class="sec">Pattern</div><div class="symgrid" style="grid-template-columns:repeat(4,1fr)">${patT('',true)}${patT('8 5')}${patT('2 5')}${patT('8 4 2 4')}</div>
 <div class="swr" style="margin-top:6px"><div>Arrow shows the direction<div class="hint" style="margin:1px 0 0">From the first place to the last.</div></div><span class="sw on"></span></div>`,ffoot()));
F('s44','44 · Area type editor: Add another name',side('More',
 `${hdrTrash('Edit type · Kingdom','Remove this type (only when nothing uses it)')}
 <div class="sec" style="margin-top:12px">Names</div>${nameRow('en','Kingdom',{x:false})}${nameRow('hy','Թագավորություն')}${ADD}
 <div class="sec">Area</div><div class="look"><span class="l">Colour</span>${colr(0)}<span></span><span class="l">Fill opacity</span><div class="range"><i style="width:30%"></i><b style="left:30%"></b></div><span class="v">30%</span><span class="l">Outline width</span><div class="range"><i style="width:35%"></i><b style="left:35%"></b></div><span class="v">2 px</span></div>
 <div class="sec">Outline pattern</div><div class="symgrid" style="grid-template-columns:repeat(4,1fr)">${patT('',true)}${patT('8 5')}${patT('2 5')}${patT('8 4 2 4')}</div>
 <div class="sec">Preview</div>${prev(`<svg width="150" height="56"><path d="M12 34l26-24 60 8 38 18-28 22-60-4z" fill="#9a3b2e" fill-opacity=".3" stroke="#9a3b2e" stroke-width="2"/></svg><span class="hint" style="margin:0 0 0 auto">Kingdom of Urartu</span>`)}`,ffoot()));

/* 33 Border new version, 34 Route form */
F('s33','33 · Border: new version in time (Add another name, new date field)',side('Borders',
 `<div class="banner"><h5>New version of “Artaxiad Armenia”</h5><div class="hint" style="margin:0">Move the points on the map, then save with the dates when this shape was true.</div></div>
 <div class="sec">Names</div>${nameRow('en','Artaxiad Armenia',{x:false})}${nameRow('hy','Արտաշեսյան Հայաստան')}${ADD}
 ${fld('Type',shapePills([['Kingdom','#9a3b2e',1,'area'],['Province','#2a5f8f',0,'area'],['Country','#5d7a3a',0,'area']]))}
 ${fld('Began',dateF('Exact','100','','BCE'))}${fld('Ended',dateF('Exact','12','','CE'))}`,ffoot('Save version')));
F('s34','34 · Route form after drawing',side('Routes',
 `<div class="banner"><h5>Save the route</h5><div class="hint" style="margin:0">212 km · 4 points. Places are matched from the ends.</div></div>
 <div class="sec">Places on the way</div><div class="chips"><span class="chip">Van</span><span style="color:var(--muted)">→</span><span class="chip">free point</span><span style="color:var(--muted)">→</span><span class="chip">Artashat</span></div>
 <div class="sec">Names</div>${nameRow('en','Van – Artashat road',{x:false})}${ADD}
 ${fld('Type',shapePills([['Trade','#c9a227',1,'line'],['Military','#9a3b2e',0,'line'],['Migration','#2a5f8f',0,'line']]))}
 <div class="swr"><div>Usable both ways</div><span class="sw on"></span></div>
 ${fld('Began',dateF('Approx.','550','','BCE'))}`,`<footer class="foot form"><button class="btn primary" style="height:44px;font-size:14px">Save route</button>${'<div class="pair"><button class="btn alt">Back to the map</button><button class="btn alt">Discard</button></div>'}</footer>`));

/* 41 language + category edit */
F('s41','41 · More: add a language, rename a category (Add another name)',side('More',
 fold('lang','Languages','Add a language',`<div class="sec" style="margin:0 0 6px">New language</div><div style="display:grid;grid-template-columns:84px 1fr;gap:6px">${inp(ph('hy'))}${inp(ph('Name in English'))}</div><div style="height:6px"></div>${inp(ph('Name in the language itself'))}<div style="margin-top:12px">${pair('Save','Cancel',true)}</div>`)+
 fold('folder','Categories','Rename a category',`<div class="sec" style="margin:0 0 6px">Rename · Military campaign</div>${nameRow('en','Military campaign',{x:false})}${nameRow('hy','Ռազմական արշավանք')}${ADD}<div style="margin-top:12px">${pair('Save','Cancel')}</div>`)));

/* 45 Notes */
F('s45','45 · Notes (Period footer is the same component everywhere)',`${hdr('Explore')}<div class="scroll" style="padding-top:8px">
 <div style="display:flex;align-items:center;gap:6px;margin:0 -6px 6px">${ib('left','Back to the list')}<span class="mk" style="width:28px;height:28px"><i class="circle" style="--c:#B3261E"></i></span><b style="font:600 17px var(--serif);color:var(--ink);flex:1;padding-left:4px">Artashat</b>${ib('edit','Edit place','sm')}${ib('x','Shrink the pane','sm')}</div>
 <div style="display:flex;align-items:center;gap:6px"><div class="sec" style="margin:0;flex:1">Notes · 8</div>${ib('sort','Sort by date','sm')}${ib('collapse','Collapse all notes','sm')}</div>
 <div class="pills" style="margin:10px 0 14px"><span class="pl on">All 8</span><span class="pl">en 5</span><span class="pl">ru 2</span><span class="pl">hy 1</span></div>
 ${note('Foundation','en','176 BCE',LT,false)}${note('Hannibal legend','en','c. 176 BCE','The tradition that Hannibal planned the city is told by Strabo and Plutarch; modern historians doubt it.',true)}${note('Roman campaigns','en','163 – 166 CE','Burned by Roman forces under Statius Priscus in 163 CE, then rebuilt before the capital moved to Vagharshapat.',false)}${note('Excavations','en','','Archaeological work began in the 1970s on the hills of Khor Virap.',false,false)}
 <div class="pager">${ib('left','Previous page','sm')}<span class="pg on">1</span><span class="pg">2</span>${ib('right','Next page','sm')}<span class="cnt2">1–4 of 8</span></div></div>${pfoot()}`);

/* 46 Note edit */
F('s46','46 · Note edit: Date uses the new date field',`${hdr('Explore')}<div class="scroll" style="padding-top:8px">
 <div style="display:flex;align-items:center;gap:6px;margin:0 -6px 8px">${ib('left','Back')}<b style="font:600 17px var(--serif);color:var(--ink);flex:1;padding-left:4px">Artashat</b></div>
 ${note('Foundation','en','176 BCE',LT,false)}
 <div class="acc open"><div class="acc-h">${'<div class="fhd" style="flex:1"><h5>Edit note</h5></div>'}${ib('trash','Delete this note','sm danger')}</div><div class="acc-b" style="padding-top:2px">
 <div class="sec" style="margin-top:8px">Title</div>${inp('Roman campaigns')}<div class="sec">Language</div>${pills('en')}
 <div class="sec">Date</div>${dateF('Range','163','166','CE','Year')}
 <div class="sec">Text</div><div class="in ta" style="min-height:70px;color:var(--ink)">Burned by Roman forces under Statius Priscus in 163 CE…</div></div></div></div>${ffoot()}`);

/* 47 Format menu */
const FM=[['Full date',[['YYYY-MM-DD','1500-03-21'],['DD.MM.YYYY','21.03.1500'],['MM/DD/YYYY','03/21/1500'],['D Month YYYY','21 March 1500']]],['Month',[['Month YYYY','March 1500']]],['Year and coarser',[['Year','1500'],['Century','16th century'],['Millennium','2nd millennium']]]];
F('s47','47 · Date format menu: grouped by precision, current format ticked',`${hdr('Explore')}<div class="scroll"><div class="fhd"><h5>Began / founded</h5></div><p class="hint" style="margin:2px 0 12px">How sure you are, then the format you type it in.</p>${dateF('Exact','21|March|1500','','CE','D Month YYYY')}</div>${ffoot()}
 <div class="menu" style="left:16px;top:272px;width:300px">${FM.map(g=>`<div class="mg">${g[0]}</div>`+g[1].map(f=>`<div class="mi ${f[0]=='D Month YYYY'?'on':''}"><span>${f[0]}<small>${f[1]}</small></span>${f[0]=='D Month YYYY'?ic('check',14):''}</div>`).join('')).join('')}</div>`);

/* 48 Date formats */
F('s48','48 · Date formats: every layout, CE | BCE as a toggle',`${hdr('Explore')}<div class="scroll"><div class="sec" style="margin-top:0">Approximate · Century</div>${dateF('Approx.','16','','CE','Century')}
 <div class="sec">Range · Month YYYY</div>${dateF('Range','March|1500','June|1502','CE','Month YYYY')}
 <div class="sec">Range across eras · Year</div>${dateF('Range','120','30','BCE|CE','Year')}</div>${ffoot()}`);

/* 22 Moment */
F('s22','22 · Moment (time travel): same footer slot, replaces Period while on',side('Explore',
 `${searchRow('Search places, names, notes…')}${bar('<b>6</b> places at c. 85 BCE',ib('sort','Sort','sm'))}<ul class="list">${[PL[1],PL[4],PL[3],PL[0],PL[2]].map(row).join('')}</ul>`,mfoot()));

/* 49 Period vs Moment */
F('s49','49 · Period vs Moment: two entities, one footer slot',`<div class="cmpw"><div><h5>Period · a filter</h5><div class="mini">${pfoot('800 – 500 BCE',13,31)}</div><dl>
 <dt>Question</dt><dd>Which years do I want to see?</dd><dt>Handles</dt><dd>Two (from, to). Also in Filters › Period.</dd><dt>Effect</dt><dd>Hides places, borders, routes that did not exist inside the range.</dd><dt>On / off</dt><dd>Always there. ✕ resets to Any.</dd></dl></div>
 <div><h5>Moment · time travel</h5><div class="mini">${mfoot()}</div><dl>
 <dt>Question</dt><dd>What existed on this one date?</dd><dt>Handles</dt><dd>One, plus play at 1× to 500× years per second.</dd><dt>Effect</dt><dd>Shows only what existed at that instant. Period is paused, not lost.</dd><dt>On / off</dt><dd>Time-travel icon in the Period footer. ✕ returns to Period.</dd></dl></div></div>`,'wide');

document.getElementById('out').innerHTML=out.join('');
