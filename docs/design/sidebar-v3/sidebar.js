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
 from:'<path d="M4 5v14M8 12h12M16 8l4 4-4 4"/>',
 to:'<path d="M20 5v14M4 12h12M12 8l4 4-4 4"/>',
 arrow:'<path d="M4 12h16M14 6l6 6-6 6"/>',
 swap:'<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>'
};
const ic=(n,s=16)=>`<svg class="i" viewBox="0 0 24 24" width="${s}" height="${s}">${P[n]}</svg>`;
const ib=(n,t,x='')=>`<button class="ib ${x}" title="${t}" aria-label="${t}">${ic(n)}</button>`;
const TABS=[['compass','Explore'],['borders','Borders'],['routes','Routes'],['rivers','Rivers'],['layers','Layers'],['more','More']];
const tog=(open)=>`<button class="tog" title="${open?'Hide panel':'Show panel'}" aria-label="${open?'Hide panel':'Show panel'}"><div class="logo">${ic('mount',20)}</div><span class="bd">${ic(open?'left':'right',11)}</span></button>`;
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
let LC=['hy','en','la','ru','tr','xur','fa','grc','ar','ka','arc','akk'];
const LN={hy:'Armenian',en:'English',la:'Latin',ru:'Russian',tr:'Turkish',xur:'Urartian',fa:'Persian',grc:'Ancient Greek',ar:'Arabic',ka:'Georgian',arc:'Aramaic',akk:'Akkadian'};
const LCNT={hy:5,en:8,la:2,ru:3,tr:1,xur:4,fa:1,grc:2,ar:0,ka:1,arc:2,akk:3};
const moreB=(cls,ico='down')=>`<span class="${cls} fmore" title="All languages"><span class="n">+0</span>${ic(ico,12)}</span>`;
const pills=(c)=>`<div class="pills one" data-fit>${LC.map(x=>`<span class="pl fi ${x==c?'on':''}">${x}</span>`).join('')}${moreB('pl more')}</div>`;
const langMenu=(on,multi,st,anc,al)=>`<div class="menu" data-for="${anc}" data-al="${al}" style="${st}">${LC.map(c=>`<div class="mi ${on.includes(c)?'on':''}"><span class="cb ${multi?'':'r'} ${on.includes(c)?'on':''}">${multi&&on.includes(c)?ic('check',11):''}</span><code>${c}</code><span class="nmx">${LN[c]}</span>${multi?`<small>${LCNT[c]}</small>`:''}</div>`).join('')}${multi?'<div class="mf"><span>Clear</span><span>Done</span></div>':''}</div>`;
const lrow=(sel,mb)=>`<div class="chips one" data-fit>${[...LC].sort((a,b)=>LCNT[b]-LCNT[a]).map(c=>lchip(c,sel.includes(c))).join('')}${mb||moreB('chip more')}</div>`;
const lchip=(c,on)=>`<span class="chip fi ${on?'on':''}">${c} <small>${LCNT[c]}</small></span>`;
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
const modeSeg=(m)=>`<div class="seg" style="flex:none;width:176px"><button class="${m=='P'?'on':''}" title="Show places that existed in a range of years">Period</button><button class="${m=='M'?'on':''}" title="Show the map at one moment of history">Moment</button></div>`;
const pfoot=(lbl='Any',a=0,b=100)=>`<footer class="foot"><div class="line">${modeSeg('P')}<span style="flex:1"></span><span class="lbl" style="flex:none;font-size:13px"><b>${lbl}</b></span>${ib('x','Reset the period','sm')}</div>
 <div class="track">${bars(a,b)}<div class="rail"></div><div class="fill" style="left:${a}%;right:${100-b}%"></div><span class="h" style="left:${a}%"></span><span class="h" style="left:${b}%"></span></div><div class="ticks"><span>1200 BCE</span><span>0</span><span>1500 CE</span></div></footer>`;
const mfoot=()=>`<footer class="foot"><div class="line">${modeSeg('M')}<span style="flex:1"></span><span class="playb" title="Play">${ic('play',16)}</span><div class="atm" style="text-align:right;min-width:92px"><small>Moment</small>c. 85 BCE</div></div>
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
 <div class="sec">Language</div>${lrow(['hy'])}
 <div class="sech"><div class="sec">Period</div><span class="fmtp">${ic('calendar',14)}<span>Year</span>${ic('down',12)}</span></div><div class="pr"><b title="From" aria-label="From">${ic('from',18)}</b>${inp('800')}${eraT('BCE')}</div><div class="pr"><b title="To" aria-label="To">${ic('to',18)}</b>${inp('500')}${eraT('BCE')}</div><p class="hint">Empty field = no limit.</p>`,pfoot('800 – 500 BCE',13,31)));

/* 3 Place details: one accordion card */
F('s3','3 · Place details: header and body are one card, one continuous blue edge',side('Explore',
 `${searchRow('Search places, names, notes…')}${bar('<b>10</b> places',ib('sort','Sort','sm'))}<ul class="list">${row(PL[0])}${placeAcc(PL[1],
 `<div class="tools">${ib('edit','Edit place','sm')}${ib('nav','Directions from here','sm')}${ib('stackplus','Add to a layer','sm')}${ib('locate','Show on map','sm')}<span class="sp"></span>${ib('fit','Enlarge this pane','sm')}</div>
 <div class="names" style="margin-top:6px"><span>Արտաշատ<em>hy</em></span><span>Artaxata<em>la</em></span></div>
 <div class="sec">Layers</div><div class="chips"><span class="chip"><i style="width:8px;height:8px;border-radius:50%;background:#5d7a3a;display:block"></i>Artaxiad capitals</span>${dchip('Add to a layer')}</div>
 <div class="sec">Notes · 2</div>${note('Foundation','en','176 BCE',LT,false)}${note('Roman campaigns','en','163 – 166 CE · period','Burned by Roman forces in 163 CE; the capital moved to Vagharshapat.',false,false)}
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
 fold('lang','Languages','9 languages',`<div class="hint" style="margin:0 0 8px">Every name and note uses one of these languages. Missing one? Ask an administrator.</div><div class="lg hd2"><span>Code</span><span>Name</span><span>In the language</span><span></span></div>${langs.map(l=>`<div class="lg"><span class="c">${l[0]}</span><span>${l[1]}</span><span class="n">${l[2]||'–'}</span>${ib('edit','Edit '+l[1],'sm')}</div>`).join('')}<div style="margin-top:8px">${dchip('Add language')}</div>`)+
 fold('tag','Types','25 place, route and area types',`<div class="sec" style="margin-top:0">Places</div>${tl(mkm('circle','#B3261E'),'City','point')}${tl(mkm('square','#455A64'),'Fortress','point')}${tl(mkm('diamond','#7B1FA2'),'Temple','point')}<div class="rw2" style="color:var(--muted)">+ 10 more</div><div class="sec">Routes</div>${tl(mkm('square','#c9a227'),'Trade','line')}<div style="margin-top:10px">${dchip('Place type')} ${dchip('Route type')}</div>`)+
 fold('folder','Categories','Groups for layers','',false)));

/* 21 More: historical maps + categories */
F('s21','21 · More: historical maps and categories (same accordion)',side('More',
 fold('image','Historical maps','1 image overlay',`<div class="card" style="background:var(--bg);padding:10px 12px"><div style="display:flex;align-items:center;gap:10px"><span class="mk" style="width:24px;height:24px;border-radius:6px;background:var(--blue);border-color:var(--blue);color:#fff">${ic('check',12)}</span><b style="flex:1;color:var(--ink);font-weight:600">Map of Greater Armenia, 1 c. BCE</b>${ib('fit','Fit to the map','sm')}${ib('edit','Edit overlay','sm')}</div><div class="look" style="grid-template-columns:62px 1fr 38px;margin-top:8px"><span class="l">Opacity</span><div class="range"><i style="width:60%"></i><b style="left:60%"></b></div><span class="v">60%</span></div></div><div style="margin-top:8px">${dchip('Add image overlay')}</div>`)+
 fold('folder','Categories','Groups for layers',['Military campaign','State or kingdom','Trade network'].map(c=>`<div class="rw2" style="padding:6px 2px"><div class="tx">${c}</div>${ib('edit','Rename '+c,'sm')}</div>`).join('')+`<div style="margin-top:6px">${dchip('Add category')}</div>`)+
 fold('nav','Directions','Car route between two points','',false)+fold('lang','Languages','9 languages','',false)));

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
 <div class="swr" style="margin-top:6px"><span class="ic">${ic('arrow',18)}</span><div>Arrow shows the direction<div class="hint" style="margin:1px 0 0">From the first place to the last.</div></div><span class="sw on"></span></div>`,ffoot()));
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
 <div class="swr"><span class="ic">${ic('swap',18)}</span><div>Usable both ways</div><span class="sw on"></span></div>
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
 ${note('Foundation','en','176 BCE',LT,false)}${note('Hannibal legend','en','c. 176 BCE','The tradition that Hannibal planned the city is told by Strabo and Plutarch; modern historians doubt it.',true)}${note('Excavations','en','','Archaeological work began in the 1970s on the hills of Khor Virap.',false,false)}
 <div class="pager">${ib('left','Previous page','sm')}<span class="pg on">1</span><span class="pg">2</span>${ib('right','Next page','sm')}<span class="cnt2">1–3 of 8</span></div></div>${pfoot()}`);

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
 <div class="menu" data-for=".fmtp" data-al="frame" style="width:300px">${FM.map(g=>`<div class="mg">${g[0]}</div>`+g[1].map(f=>`<div class="mi ${f[0]=='D Month YYYY'?'on':''}"><span>${f[0]}<small>${f[1]}</small></span>${f[0]=='D Month YYYY'?ic('check',14):''}</div>`).join('')).join('')}</div>`);

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

const mapSvg=`<svg class="map" viewBox="0 0 760 860" preserveAspectRatio="xMidYMid slice"><rect width="760" height="860" fill="#e8e2c4"/><path d="M0 560C120 520 200 600 330 560S520 470 760 520V860H0z" fill="#dcd5b0"/><path d="M60 130C160 80 300 120 380 200S560 240 700 180" stroke="#b9cfd8" stroke-width="6" fill="none"/><path d="M300 330l60-40 90 20 40 70-60 70-100-10z" fill="#9a3b2e" fill-opacity=".18" stroke="#9a3b2e" stroke-width="2"/><g fill="#B3261E"><circle cx="420" cy="400" r="7"/><circle cx="520" cy="300" r="6"/></g><rect x="338" y="352" width="11" height="11" rx="2" fill="#455A64"/><path d="M420 400L520 300" stroke="#c9a227" stroke-width="3" stroke-dasharray="8 5"/></svg>`;
const railB=(i,t,on,x='')=>`<button class="rb ${on?'on':''} ${x}" title="${t}">${ic(i,22)}</button>`;
const rail=(tab,o={})=>`<aside class="rail">${tog(false)}<hr>${TABS.map(([i,t])=>railB(i,t,t==tab,o.hov==t?'hov':'')).join('')}<span class="sp"></span><button class="rb" title="Period">${ic('clock',22)}${o.period?'<span class="dot"></span>':''}</button></aside>`;
const STG=(id,t,inner)=>out.push(`<div><p class="ttl">${t}</p><div class="stage" id="${id}">${mapSvg}${inner}</div></div>`);
STG('s50','50 · Closed sidebar: 60px rail. The logo tile is the one toggle (open and closed)',`${rail('')}<span class="maplab" style="left:380px;top:430px">Artashat</span>`);
STG('s51','51 · Closed: hover shows what a click does. Dot on the clock = Period filter active',`${rail('Explore',{hov:'Borders',period:true})}<div class="tip" style="left:70px;top:132px">Borders<kbd>opens the panel on this tab</kbd></div>`);
STG('s52','52 · Closed: tooltip on the toggle',`${rail('Explore')}<div class="tip" style="left:70px;top:24px">Show panel<kbd>[</kbd></div>`);

/* ---- language picker ---- */
F('s55','55 · Language filter: top languages as chips, the rest in a separate picker',side('Explore',
 `${searchRow('Search places, names, notes…',true)}<div class="sec">Language</div>${lrow(['hy','xur'],moreB('chip more open','up'))}`,pfoot())+langMenu(['hy','xur'],true,'width:330px','.chip.more','frame'));
F('s56','56 · Name language: pills stay on one line, “+5” opens a picker',side('Explore',
 `<ul class="list">${placeAcc(PL[1],`<div class="fhd" style="margin-bottom:2px"><h5>Edit place</h5></div><div class="sec" style="margin-top:10px">Names</div>${nameRow('en','Artashat',{x:false})}${nameRow('hy','Արտաշատ')}`)}</ul>`,ffoot())+langMenu(['en'],false,'width:286px','.pl.more','right'));
F('s57','57 · Narrow sidebar (320px): selected language replaces the last pill, row never wraps',side('Explore',
 `<ul class="list">${placeAcc(PL[1],`<div class="fhd" style="margin-bottom:2px"><h5>Edit place</h5></div><div class="sec" style="margin-top:10px">Names</div>${nameRow('xur','Arttashat',{x:false})}${nameRow('hy','Արտաշատ')}${ADD}`)}</ul>`,ffoot()),'narrow');

/* ---- recovered screens 37-40, 42 (rebuilt in the current design) ---- */
Object.assign(P,{
 drop:'<path d="M12 3s7 7.5 7 12a7 7 0 01-14 0c0-4.5 7-12 7-12z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
 cube:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
 palette:'<path d="M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 003-3c0-5-4-11-8-11z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/>',
 tilt:'<path d="M3 15l5-8h13l-5 8z"/>',
 rot:'<path d="M20 12a8 8 0 11-3-6.2M20 4v4h-4"/>',
 height:'<path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4"/>',
 roads:'<path d="M6 21l3-18M18 21L15 3M12 5v3M12 11v3M12 17v3"/>',
 water:'<path d="M12 3s6 6.5 6 10.5a6 6 0 01-12 0C6 9.5 12 3 12 3z"/>',
 flat:'<path d="M3 14h18M6 10h12"/>',
 north:'<path d="M12 3l4 9h-8zM12 12v9"/>',
 swap2:'<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'
});
const sl=(label,val,pct,icon)=>`<div class="sl"><div class="slh">${icon?`<span class="ic2">${ic(icon,16)}</span>`:''}<span>${label}</span><em>${val}</em></div><div class="range"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></div></div>`;
const tr=(i,l,on)=>`<div class="swr"><span class="ic">${ic(i,16)}</span><div>${l}</div><span class="sw ${on?'on':''}"></span></div>`;
const bmT=(c,n,on)=>`<div class="${on?'on':''}"><i style="background:${c}"></i>${n}</div>`;
F('s37','37 · More: base map and 3D view (same accordion)',side('More',
 fold('map','Maps &amp; base map','Terrain · 3D view · relief',
 `<div class="sec" style="margin-top:0">Base map</div><div class="bm">${bmT('linear-gradient(135deg,#c9d9a0,#8fb27a)','Terrain',1)}${bmT('#ebe6cc','Plain')}${bmT('linear-gradient(135deg,#c9a77a,#6f4e2e)','Relief')}</div><p class="hint">Map data © OpenStreetMap contributors · tiles Terrarium</p>
 <div class="sec">3D view</div>${sl('Tilt','0°',0,'tilt')}${sl('Rotation','0°',0,'rot')}
 <div class="pills" style="margin:-2px 0 12px"><span class="pl big on">${ic('flat',14)}Flat</span><span class="pl big">${ic('tilt',14)}Tilt 60</span><span class="pl big">${ic('north',14)}North up</span></div>
 ${tr('cube','3D terrain',true)}${sl('Height','1.0×',33,'height')}
 <div class="sec">Rivers</div>${sl('River size','1×',28,'water')}`)+
 fold('nav','Directions','Car route between two points','',false)+fold('lang','Languages','12 languages','',false)));
F('s38','38 · More: show on the map and relief options (icons for every option)',side('More',
 `<div class="sec" style="margin-top:0">Show on the map</div>${tr('map','Borders of today',true)}${tr('roads','Roads',false)}${tr('tag','Place labels',true)}${tr('drop','Water labels',true)}
 <div class="sec">Relief</div>${tr('layers','Colour by height',true)}${tr('sun','Shading',true)}${tr('compass','Adapt colours to the view',true)}${tr('water','Smooth colours',true)}${tr('swap2','Smooth colour transitions',true)}
 <div class="swr" style="padding-bottom:4px"><span class="ic">${ic('palette',16)}</span><div>Colour ramp</div></div>${sel('Natural terrain')}<div class="ramp"></div><div class="ticks"><span>0 m</span><span>1500</span><span>3000</span><span>5100 m</span></div><div style="margin:8px 0 12px">${dchip('Edit colours')}</div>${sl('Colour strength','70%',70,'palette')}${sl('Shading strength','45%',45,'sun')}`));
F('s39','39 · More: directions (same accordion)',side('More',
 fold('nav','Directions','Car route between two points',
 `<div style="display:grid;grid-template-columns:1fr auto;gap:6px 6px;align-items:center"><div class="in"><i style="width:9px;height:9px;border-radius:50%;background:#2e7d32;display:block"></i>Van</div>${ib('swap','Swap start and end','sm')}<div class="in"><i style="width:9px;height:9px;border-radius:50%;background:#115098;display:block"></i>Yerevan</div>${ib('x','Clear','sm')}</div>
 <div class="dist"><div>Distance<b>452<small>km</small></b></div><div>Car<b>6 h 40<small>min</small></b></div></div>
 <p class="hint">Click a place or any point on the map, then choose “Directions from/to here”. Car routes only.</p><p class="hint" style="margin-top:4px">Routes: OSRM demo server · © OpenStreetMap contributors.</p>`)+
 fold('map','Maps &amp; base map','Terrain · 3D view · relief','',false)+fold('lang','Languages','12 languages','',false)));
F('s40','40 · Edit image overlay',side('More',
 `${hdrTrash('Edit image overlay','Remove this overlay')}<p class="hint" style="margin-top:2px">Drag the corners on the map to place the image.</p>
 <div class="sec">Title</div>${inp('Map of Greater Armenia, 1 c. BCE')}
 ${sl('Opacity','60%',60)}
 <div class="fromto"><div>${sl('Rotate','0°',0)}</div><div>${sl('Scale','100%',50)}</div></div>
 <div class="sec">Zoom range · now 6.5</div><div class="fromto"><div class="in"><span>4</span><span class="u">from</span><span style="flex:1"></span>${ib('locate','Use current zoom','sm')}</div><div class="in"><span>12</span><span class="u">to</span><span style="flex:1"></span>${ib('locate','Use current zoom','sm')}</div></div>`,ffoot()));
F('s42','42 · Symbol upload: error state, Save disabled',side('More',
 `${hdrTrash('Edit type · Mine','Remove this type (only when nothing uses it)')}
 <div class="sec" style="margin-top:12px">Symbol</div><div class="symgrid">${['circle','ring','square','diamond','triangle','plus','star','hexagon','drop','bar'].map(n=>symT(n,false)).join('')}${symT('cedar',false,1)}${symT('mine',true,1)}<span class="sym up">${ic('upload',20)}</span></div>
 <div class="dz">${ic('upload',20)}<b>Choose an SVG file or paste an &lt;svg&gt;</b>Paths, rectangles and circles work. One colour.</div>
 <div class="errline">${ic('alert',14)}<span>This SVG moves or scales its shapes (transform), which is not supported. Export it again without transforms.</span></div>
 <div class="sec">Advanced: path and box</div><div class="in ta" style="font:12px ui-monospace,Menlo,monospace;min-height:64px">M3 9c4-5 14-5 18 0l-2.4 1.6C15.8 8 8.2 8 5.4 10.6zM11 9h2v12h-2z</div><p class="hint">The drawing area (viewBox) must start at 0 0.</p>`,ffoot('Save',true)));
/* ======== v6 part 1: helpers, Explore states, forms, confirms ======== */
Object.assign(P,{
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 eyeoff:'<path d="M3 3l18 18M10.5 6.2A9.6 9.6 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.7M6.4 7.6C3.7 9.4 2 12 2 12s4 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 004.2 4.2"/>',
 undo:'<path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-3"/>',
 pin:'<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
 area:'<path d="M5 8l7-4 7 4v8l-7 4-7-4z"/>',
 line:'<path d="M4 18c5-10 10 2 16-12"/>',
 lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
 link:'<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
 doc:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
 rect:'<rect x="4" y="6" width="16" height="12" rx="1" stroke-dasharray="3 3"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
 hist:'<path d="M3.5 12a8.5 8.5 0 108.5-8.5A8.6 8.6 0 005.8 6M3 4v3.5h3.5M12 8v4l3 2"/>',
 max:'<path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"/>',
 reverse:'<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
 file:'<path d="M6 3h9l4 4v14H6z"/><path d="M12 11v6M9 14l3-3 3 3"/>'
});
const mkS=(c,k)=>`<span class="mk"><svg viewBox="0 0 24 24" width="18" height="18">${k=='line'?`<path d="M4 18c5-10 10 2 16-12" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`:`<path d="M5 8l7-4 7 4v8l-7 4-7-4z" fill="${c}" fill-opacity=".3" stroke="${c}" stroke-width="2"/>`}</svg></span>`;
const eyeB=(on=true)=>ib(on?'eye':'eyeoff',on?'Hide from the map':'Show on the map','sm');
const srow=(m,name,line,o={})=>`<li class="row">${m}<div class="tx"><div class="nm">${name}</div><div class="dt">${line}</div>${o.aka?`<div class="aka">also called ${o.aka}</div>`:''}</div>${o.eye===null?'':eyeB(o.eye!==false)}</li>`;
const srch=(ph_)=>`<div class="srow"><div class="search">${ic('search')}<div class="in" style="color:var(--muted)">${ph_}</div></div></div>`;
const intro=(a,more)=>`<p class="intro">${ic('info',14)}<span>${a}${more?' <a>More</a>':''}</span></p>`;
const wideAdd=(t,ico='plus')=>`<button class="btn alt wd">${ic(ico,14)}${t}</button>`;
const ck=(t,on)=>`<div class="ck"><span class="cb ${on?'on':''}">${on?ic('check',11):''}</span><span>${t}</span></div>`;
const errb=(t)=>`<div class="errb">${ic('alert',16)}<span>${t}</span></div>`;
const emp=(i,t,s,b)=>`<div class="emp"><span class="mk">${ic(i,22)}</span><b>${t}</b>${s}${b?`<div style="margin-top:12px"><span class="btn alt sm2">${b}</span></div>`:''}</div>`;
const vers=(a)=>`<div class="vers">${a.map(([t,on])=>`<span class="chip ${on?'on':''}">${t}</span>`).join('')}</div>`;
const dk=(a)=>`<div class="dkf">${a.join('')}</div>`;
const bt=(t,k='alt',i)=>`<span class="btn ${k} sm2">${i?ic(i,14):''}${t}</span>`;
const STAGE=(id,t,inner)=>STG(id,t,inner);

/* 60 · Explore: empty, loading, load error */
F('s60','60 · Explore states: no results, loading, load error',side('Explore',
 `${searchRow('zzz',true)}<div class="chips" style="margin-top:10px"><span class="chip act">Fortress <span class="x">${ic('x',12)}</span></span><span class="chip act">Time: 85 BCE <span class="x">${ic('x',12)}</span></span><span class="chip act">only · Artaxiad capitals <span class="x">${ic('x',12)}</span></span><span class="chip clear">Clear all</span></div>
 ${bar('<b>0</b> of 124 places')}
 ${emp('search','No places match.','Try fewer filters.','Reset filters')}
 <div class="sec">Loading</div>${[1,2,3].map(()=>'<div class="skel"></div>').join('')}
 <div class="sec">Could not load</div>${errb('Could not load data (HTTP 500).')}<div style="margin-top:10px">${bt('Try again','alt','hist')}</div>`,pfoot()));

/* 61 · other places (geocoder) */
F('s61','61 · Search: places of the atlas, then “Other places (OpenStreetMap)”',side('Explore',
 `${searchRow('Gyumri',false)}${bar('<b>1</b> of 124 places')}<ul class="list">${row(['Gyumri (Alexandropol)','#B3261E','circle','1829 CE – present',0])}</ul>
 <div class="sec">Other places (OpenStreetMap)</div>
 <ul class="list">${[['Gyumri','Shirak Province, Armenia'],['Gyumri Airport','Shirak, Armenia'],['Gyumri, Mayor Street','Gyumri, Shirak']].map(r=>`<li class="row"><span class="mk" style="color:var(--blue)">${ic('pin',16)}</span><div class="tx"><div class="nm" style="font-size:14px">${r[0]}</div><div class="dt">${r[1]}</div></div>${ic('right',14)}</li>`).join('')}</ul>
 <p class="hint">Search: Nominatim · © OpenStreetMap contributors</p>
 <p class="hint" style="margin-top:14px">Press Enter to search other places. Needs 3 or more letters.</p>`,pfoot()));
F('s62','62 · Other places: searching, nothing found, service down',side('Explore',
 `${searchRow('Gyumri',false)}
 <div class="sec">Other places (OpenStreetMap)</div><div class="skel" style="height:40px"></div><div class="skel" style="height:40px"></div><p class="hint">Searching…</p>
 <div class="sec">Other places (OpenStreetMap)</div>${emp('globe','No other places found.','Check the spelling or try another name.')}
 <div class="sec">Other places (OpenStreetMap)</div>${errb('The search service is not available right now.')}`,pfoot()));

/* 63 · point menu on the map */
STAGE('s63','63 · Map: menu of a clicked point (with and without edit rights)',`
 <div class="pop" style="left:470px;top:250px"><h6>Selected point</h6>
  <div class="pi">${ic('area',16)}Open border: Kingdom of Urartu</div><div class="pi">${ic('plus',16)}Add place here</div><div class="pi">${ic('nav',16)}Route from here</div><div class="pi">${ic('nav',16)}Route to here</div></div>
 <span style="position:absolute;left:452px;top:236px;width:14px;height:14px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#8a949a;box-shadow:var(--shadow)"></span>
 <div class="pop" style="left:430px;top:520px"><h6>Garni</h6>
  <div class="pi">${ic('plus',16)}<span style="flex:1">Route from here</span></div><div class="pi">${ic('nav',16)}Route to here</div><div class="pi dim">${ic('lock',16)}Add place here</div><p class="hint">Adding places is limited to administrators.</p></div>`);

/* 64-66 · place form complete */
const nm1=nameRow('en','Gyumri',{x:false})+nameRow('hy','Գյումրի');
F('s64','64 · New place (1/3): position, names, type, dates',side('Explore',
 `${hdrTrash('New place','')}<div class="banner" style="margin-top:6px"><div class="hint" style="margin:0">${ic('pin',14)} Drag the red pin on the map to place it, or type the coordinates below.</div></div>
 <div class="sec">Names</div>${nm1}${ADD}<p class="hint">One place can have several names, even in one language. Language missing? Ask an administrator (More › Languages).</p>
 ${fld('Type',typePills('Settlement'))}<p class="hint">Type missing? Ask an administrator (More › Types).</p>
 ${fld('Began / founded',dateF('Unknown'))}${fld('Ended / abandoned',dateF('Unknown'))}`,ffoot()).replace('<div class="fhd"><h5>New place</h5>'+ib('trash','','danger')+'</div>','<div class="fhd"><h5>New place</h5></div>'));
const srcRow=(t,on,u)=>`<div class="ck"><span class="cb ${on?'on':''}">${on?ic('check',11):''}</span><span><b style="font-weight:600">${t}</b><br><span class="hint" style="margin:0">${u}</span></span></div>`;
F('s65','64b · New / edit place (2/3): certainty, radius, sources, position, layers',side('Explore',
 `${fld('Certainty',`<div class="pills"><span class="pl">Not stated</span><span class="pl">Exact</span><span class="pl on">Approximate</span><span class="pl">Disputed</span></div>`)}
 <div class="sec">Radius (optional)</div><div class="in"><span>5000</span><span class="u">metres</span></div><p class="hint">A circle is drawn on the map when the place is approximate or disputed.</p>
 <div class="sec">Sources</div>${srcRow('Strabo, Geography 11.14',true,'Strabo · Book 11')}${srcRow('Khorenatsi, History of Armenia',false,'https://example.org/khorenatsi')}
 <div class="acc open" style="margin:6px 0 0"><div class="acc-h" style="padding:8px 12px"><span class="tx" style="font-weight:600">New source</span><span class="ch">${ic('up')}</span></div><div class="acc-b" style="padding-top:10px">${inp(ph('Title'))}<div style="height:6px"></div>${inp(ph('Citation (optional)'))}<div style="height:6px"></div>${inp(ph('Link, https://… (optional)'))}<div style="margin-top:10px">${bt('Add source','alt','plus')}</div></div></div>
 <div class="sec">Position</div><div class="fromto"><div class="in"><span class="u">lat</span><span>40.7894</span></div><div class="in"><span class="u">lon</span><span>43.8475</span></div></div>
 <div class="sec">Add the new place to layers</div><p class="hint" style="margin:0 0 4px">It stays on the main map as well.</p>${ck('Artaxiad capitals',true)}${ck('Trade cities',false)}`,ffoot()));
F('s66','64c · Place form (3/3): mountain type and errors',side('Explore',
 `${fld('Type',typePills('Mountain').replace('Village','Mountain'))}
 <div class="sec">Height (optional)</div><div class="in bad"><span>9500</span><span class="u">metres above sea level</span></div><div class="errline">${ic('alert',14)}Height must be a whole number of metres from 0 to 9000.</div>
 <div class="sec">Radius (optional)</div><div class="in bad"><span>0</span><span class="u">metres</span></div><div class="errline">${ic('alert',14)}Radius must be a whole number of metres from 1 to 1000000.</div>
 <div class="sec">Position</div><div class="fromto"><div class="in bad"><span class="u">lat</span><span>95</span></div><div class="in"><span class="u">lon</span><span>43.8</span></div></div><div class="errline">${ic('alert',14)}Latitude must be between −90 and 90, longitude between −180 and 180.</div>
 <div class="sec">Names</div><div class="ncard">${pills('xx')}<div class="r">${inp(ph('name'),'bad')}</div></div><div class="errline">${ic('alert',14)}Give the place at least one name.</div>
 <div class="errline" style="margin-top:12px">${ic('alert',14)}The language “xx” is not in the list. Ask an administrator to add it.</div>`,`<footer class="foot form"><div class="hint" style="margin:0 0 4px;color:var(--danger)">Save failed: HTTP 500</div>${pair('Save','Cancel')}</footer>`));

/* 67 · new note */
F('s67','65 · New note (place, layer or border): layers, date, errors',side('Explore',
 `${hdrTrash('New note · Artashat','')}${'' }
 <div class="sec">Language</div>${pills('en')}<p class="hint">Language missing? Ask an administrator (More › Languages).</p>
 <div class="sec">This note belongs to layers</div><p class="hint" style="margin:0 0 4px">It is always visible in the general layer too.</p>${ck('Artaxiad capitals',true)}${ck('Roman campaigns',false)}
 <div class="sec">Date (optional)</div>${dateF('Unknown')}
 <div class="sec">Title</div>${inp(ph('title'),'bad')}<div class="errline">${ic('alert',14)}A note needs a title.</div>
 <div class="sec">Text</div><div class="in ta" style="min-height:90px;color:var(--muted)">text</div>`,ffoot()).replace(ib('trash','','danger'),''));

/* 68 · confirm dialogs */
F('s68','66 · Confirm: delete (border, route, layer, type)',side('Borders',
 `${srch('Search borders…')}${bar('<b>12</b> of 12 borders')}<ul class="list">${srow(mkS('#9a3b2e','area'),'Kingdom of Urartu','Kingdom · area · 860 – 590 BCE')}${srow(mkS('#9a3b2e','area'),'Artaxiad Armenia','Kingdom · area · 190 BCE – 12 CE')}</ul>`,'')+`<div class="scrim"><div class="mdl"><h5>Delete “Kingdom of Urartu”?</h5><p>It also leaves its layers. A copy of the old file stays in the archive on the server.</p><div class="pair"><button class="btn danger">Delete</button><button class="btn alt">Cancel</button></div></div></div>`);
F('s69','67 · Confirm: the other four (remove type, delete layer, import, discard)',`<div class="modals">${[['Remove the type “Fortress”?','Only possible when no place or shape uses it.','Remove',1],['Delete the layer “Artaxiad capitals”?','Its places and their notes stay on the map. A copy is archived.','Delete',1],['Import 8 shapes as borders?','They get the type “Territory or area”. You can change the type afterwards.','Import',0],['Discard this route?','The points you clicked are lost.','Discard',1]].map(m=>`<div class="mdl"><h5>${m[0]}</h5><p>${m[1]}</p><div class="pair"><button class="btn ${m[3]?'danger':'primary'}">${m[2]}</button><button class="btn alt">Cancel</button></div></div>`).join('')}</div>`,'wide');

/* 70 · place card read-only */
F('s70','68 · Place card without edit rights (not logged in)',side('Explore',
 `${searchRow('Search places, names, notes…')}${bar('<b>10</b> places')}<ul class="list">${placeAcc(PL[1],
 `<div class="tools">${ib('nav','Route from here','sm')}${ib('locate','Show on map','sm')}<span class="sp"></span>${ib('max','Larger panel','sm')}</div>
 <div class="names" style="margin-top:6px"><span>Արտաշատ<em>hy</em></span><span>Artaxata<em>la</em></span></div>
 <div class="hint" style="margin-top:8px">Certainty: Approximate, about 5 km</div><div class="hint" style="margin:2px 0 0">Sources: <a style="color:var(--blue)">Strabo, Geography</a></div>
 <div class="sec">Layers</div><p class="hint" style="margin:0">Not in any layer.</p>
 <div class="sec">Routes</div><p class="hint" style="margin:0">No route passes here.</p><div class="chips" style="margin-top:8px"><span class="dash">Find a path from here…</span></div>
 <div class="sec">Notes · 2</div><p class="hint" style="margin:0 0 8px">Notes of the layer Artaxiad capitals (2 of 8) · <a style="color:var(--blue);font-weight:600">Show all notes</a></p>${note('Foundation','en','176 BCE','Founded around 176 BCE by King Artaxias I.',true,false)}
 <div class="lk">${ic('lock',14)}<span>Adding places and notes is limited to administrators. <a>Log in</a></span></div>`)}${row(PL[2])}</ul>`,pfoot()));

/* 71 · place card layers/routes blocks (editor) */
F('s71','69 · Place card (editor): layers, routes, scoped notes',side('Explore',
 `<ul class="list">${placeAcc(PL[1],
 `<div class="tools">${ib('edit','Edit place','sm')}${ib('nav','Route from here','sm')}${ib('nav','Route to here','sm')}${ib('locate','Show on map','sm')}<span class="sp"></span>${ib('max','Larger panel','sm')}</div>
 <div class="sec" style="margin-top:6px">Layers</div><div class="chips"><span class="chip act" style="background:var(--surface);color:var(--ink);border-color:var(--line)"><i style="width:8px;height:8px;border-radius:50%;background:#5d7a3a;display:block"></i>Artaxiad capitals<span class="x">${ic('x',12)}</span></span></div><div style="margin-top:8px">${dchip('Add to a layer')}</div>
 <div class="sec">Routes</div><div class="chips"><span class="chip">${ic('line',12)}Van – Artashat road</span><span class="chip">${ic('line',12)}Royal road</span></div><div class="chips" style="margin-top:8px"><span class="dash">Find a path from here…</span><span class="dash">Start a route here</span></div>
 <div style="display:flex;align-items:center;margin-top:16px"><div class="sec" style="margin:0;flex:1">Notes · 8</div>${bt('Expand all','alt')}</div><div style="height:10px"></div>${note('Foundation','en','176 BCE',LT,false)}<button class="btn primary">${ic('plus',14)}Add note</button>`)}</ul>`,pfoot()));

/* ======== v6 part 2: Borders, Rivers, Routes ======== */
const shAcc=(m,name,line,body,aka)=>`<li style="list-style:none">${acc(`${m}<div class="tx"><div class="nm">${name}</div><div class="dt">${line}</div></div><span class="ch">${ic('up')}</span>`,body)}</li>`;
const lookB=(o)=>`<div class="look" style="margin-top:2px"><span class="l">Colour</span>${colr(o.c||0)}<span></span>${o.fill?`<span class="l">${o.fill[0]}</span><div class="range"><i style="width:${o.fill[1]}%"></i><b style="left:${o.fill[1]}%"></b></div><span class="v">${o.fill[1]}%</span>`:''}${o.w?`<span class="l">Width</span><div class="range"><i style="width:${o.w*10}%"></i><b style="left:${o.w*10}%"></b></div><span class="v">${o.w} px</span>`:''}</div>${ck('Show the name on the map',true)}`;
const layerChips=`<div class="chips"><span class="chip act" style="background:var(--surface);color:var(--ink);border-color:var(--line)"><i style="width:8px;height:8px;border-radius:50%;background:#5d7a3a;display:block"></i>Artaxiad capitals</span></div><div style="margin-top:8px">${dchip('Add to a layer')}</div>`;
const tpc=(a)=>`<div class="chips" style="margin:10px 0 0">${a.map(x=>tchip(...x)).join('')}</div>`;

const keys=`<div class="step"><b>Click</b><span>the map to add points.</span></div><div class="step"><b>Drag</b><span>a point to move it.</span></div><div class="step"><b>Right-click</b><span>a point to remove it. Backspace undoes.</span></div><div class="step"><b>Enter</b><span>or a double click finishes. Esc cancels.</span></div>`;
F('s76','73 · Drawing a border area (also: editing the shape, new version)',side('Borders',
 `<div class="banner"><h5>Drawing an area</h5><div class="hint" style="margin:0">2 points so far.</div></div><div style="margin:12px 0 0">${keys}</div>
 <div style="margin-top:10px">${errb('An area needs at least 3 points.')}</div><div style="margin-top:10px">${bt('Undo','alt','undo')}</div>
 <div class="sec">Other titles of this panel</div><div class="card"><div class="nm" style="font-size:14px">Editing the shape</div><div class="nm" style="font-size:14px;margin-top:6px">New version: move the points</div><p class="hint">The outline you started from is not changed. Move the points to the outline for the other time, then press Next to give its dates.</p></div>`,
 `<footer class="foot form"><div class="pair"><button class="btn primary dis">Finish</button><button class="btn alt">Cancel</button></div></footer>`));
F('s77','74 · Drawing a line: follow a river',side('Borders',
 `<div class="banner"><h5>Drawing a line</h5><div class="hint" style="margin:0">4 points so far.</div></div><div style="margin:12px 0 0">${keys}</div>
 <div style="margin-top:8px">${ck('Follow a river between the points I click',true)}</div><div class="srow" style="margin-top:6px"><div class="search"><div class="in" style="padding-left:11px;color:var(--ink)">Araks</div></div>${bt('Find','alt')}</div><p class="hint">3 river lines loaded (blue). Click near the start, then near the end.</p><p class="hint" style="margin-top:2px">Type the river name and press Find.</p>
 <div style="margin-top:10px">${bt('Undo','alt','undo')}</div>`,`<footer class="foot form"><div class="pair"><button class="btn primary">Finish</button><button class="btn alt">Cancel</button></div></footer>`));

const rvRows=(a)=>a.map(r=>`<li class="row">${mkS('#2a5f8f','line')}<div class="tx"><div class="nm" style="font-size:14px">${r[0]}</div></div>${r[1]?`<span class="tag">map</span>`:''}${ib('x','Remove from the selection','sm')}</li>`).join('');
F('s78','75 · Rivers: select rivers (rectangle, area name, selection list)',side('Rivers',
 `${intro('Find a river by name, then draw the part you need by clicking two points on it.',1)}${srch('Search rivers…')}${bar('<b>6</b> of 6 rivers')}
 ${acc(`<span class="tx" style="font-weight:600;font-family:var(--serif);font-size:15px">Select rivers</span><span class="ch">${ic('up')}</span>`,
 `<div style="display:flex;gap:8px;align-items:center"><button class="btn alt" style="flex:1;height:36px">${ic('rect',16)}Select by rectangle</button></div><p class="hint" style="margin:6px 0 0">While active: Drag on the map (Esc cancels).</p><div style="margin-top:6px">${ck('only fully inside',false)}</div>
 ${inp(ph('Select by area: type a name (Lori, Syunik …)'))}<div class="chips" style="margin-top:8px"><span class="chip">Lori <small>province</small></span><span class="chip">Lori Berd <small>town</small></span></div><p class="hint">5 new of 7 rivers found for Lori. Base-map rivers: only those with a name that are loaded in the view; zoom to the area first.</p>
 <div style="display:flex;align-items:center;gap:8px;margin:10px 0 4px"><b style="color:var(--ink);font-weight:600;flex:1">5 selected</b>${ib('eye','Show only these','sm')}${ib('fit','Zoom to the selection','sm')}${ib('x','Clear','sm')}</div>
 <ul class="list">${rvRows([['Debed',0],['Dzoraget',0],['Pambak',1]])}</ul>`)}`,pfoot()));
/* ---- Routes ---- */
const fromTo=(a,b,bad)=>`<div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center"><div class="in ${bad=='a'?'bad':''}"><i style="width:9px;height:9px;border-radius:50%;background:#2e7d32;display:block"></i>${a?`<span style="color:var(--ink)">${a}</span>`:ph('From (a place)')}</div>${ib('swap','Swap','sm')}<div class="in ${bad=='b'?'bad':''}"><i style="width:9px;height:9px;border-radius:50%;background:#115098;display:block"></i>${b?`<span style="color:var(--ink)">${b}</span>`:ph('To (a place)')}</div>${ib('x','Clear','sm')}</div>`;
const findBtns=`<div class="pair" style="margin-top:10px"><button class="btn primary" style="height:36px;font-size:13px">Find path</button><button class="btn alt" style="height:36px;font-size:13px">Clear</button></div>`;
const rtRow=(c,n,l)=>srow(mkS(c,'line'),n,l);
const way=(t,s,legs,on)=>`<div class="way ${on?'on':''}"><div class="t">${t}</div><div class="s">${s}</div>${legs.map(l=>`<div class="leg"><span class="chip">${ic('line',12)}${l[0]}</span><span>${l[1]}</span><span style="color:var(--muted)">${l[2]}</span></div>`).join('')}</div>`;
F('s81','78 · Path finder: ways found, shortest first',side('Routes',
 `${fold('routes','Find a path between places','Van → Artashat',`${fromTo('Van','Artashat')}${findBtns}<p class="hint" style="margin-top:10px">3 ways, shortest first.</p>
 ${way('Van → Tushpa → Artashat','420 km · 2 routes',[['Van – Tushpa road','Van → Tushpa','62 km'],['Royal road','Tushpa → Artashat','358 km · via Bitlis']],true)}
 ${way('Van → Artashat','455 km · 1 route',[['Van – Artashat road','Van → Artashat','455 km']],false)}
 ${way('Van → Dvin → Artashat','590 km · 3 routes',[['Lake road','Van → Dvin','310 km'],['Trade road','Dvin → Artashat','280 km']],false)}`)}`,pfoot()));
F('s82','79 · Path finder: no path and input errors',side('Routes',
 `${fold('routes','Find a path between places','No path',`${fromTo('Van','Artashat')}${findBtns}<p class="hint" style="margin-top:10px;color:var(--ink2)">No chain of routes leads from Van to Artashat in this period. A route joins another one only at a place that both pass, and a one-way route only runs in its own direction.</p>`)}
 <div class="sec">Input errors</div>${fromTo('','','a')}<div class="errline">${ic('alert',14)}Choose both places.</div><div style="height:12px"></div>${fromTo('Van','Van')}<div class="errline">${ic('alert',14)}The start and the end are the same place.</div><div style="height:12px"></div>${fromTo('Vann','Artashat','a')}<div class="errline">${ic('alert',14)}“Vann” is not a place of the map. Choose the start from the list.</div>`,pfoot()));
F('s84','81 · Drawing a route: start, next point, errors',side('Routes',
 `<div class="banner"><h5>Drawing the route</h5></div>
 <div class="sec">Live hint (changes while you draw)</div><div class="card" style="font-size:12.5px;color:var(--ink);line-height:1.5">Click the map to set the start (A).<br><span style="color:var(--muted)">→ Start set. Click the map to add the next point.</span><br><span style="color:var(--muted)">→ 4 points · 212 km. The last point is the destination (B): keep clicking to continue.</span></div>
 <div style="margin-top:12px">${keys.replace('the map to add points.','a place to make it a stop (green), or anywhere else for a free point.').replace('a point to move it.','a point to move it; drop it on a place to make it a stop. Drag the small handle in a segment to insert a point.')}</div>
 <div style="margin-top:8px">${errb('A route needs a start and at least one more point.')}</div><div style="margin-top:8px">${errb('No road between these two points: a straight line was used.')}</div><div style="margin-top:10px">${bt('Undo','alt','undo')}</div>
 <div class="sec">Other titles of this panel</div><div class="card"><div class="nm" style="font-size:14px">Editing the path</div><div class="nm" style="font-size:14px;margin-top:6px">New version: move the points</div></div>`,
 `<footer class="foot form"><div class="pair"><button class="btn primary dis">Finish</button><button class="btn alt">Cancel</button></div></footer>`));

/* ======== v6 part 3: Layers, More states, shell ======== */
const ly=(c,n,line,st)=>`<li class="row"><span class="mk"><i class="circle" style="--c:${c};width:14px;height:14px"></i></span><div class="tx"><div class="nm" style="${st=='hide'?'color:var(--muted)':''}">${n}</div><div class="dt">${line}</div></div><span class="tg2 ${st=='only'?'on':''}" title="Show on the map only the places of this layer">Only</span><span class="tg2 ${st=='hide'?'on':''}" title="Hide the places of this layer">Hide</span></li>`;
const pl2=(i,n,t)=>`<div class="rw2" style="padding:4px 2px"><span class="num">${i}</span><div class="tx">${n}</div><span class="badge2">${t}</span></div>`;
F('s87','84 · Layer: choose places and borders',side('Layers',
 `<div class="banner"><h5>Choose the places and borders of this layer</h5><div class="hint" style="margin:0">Click places or borders on the map, or tick them below. Everything stays on the main map.</div></div>
 <div style="display:flex;align-items:center;gap:8px;margin:10px 0 6px"><span class="chip on" style="height:24px">+3</span><span class="chip" style="height:24px">−1</span><span class="hint" style="margin:0">no changes yet when both are 0</span></div>${srch('Find a place or border…')}
 <div style="margin-top:8px">${[['Artashat','City',1],['Armavir','City',1],['Dvin','Settlement',0],['Garni','Fortress',1],['Erebuni','Fortress',0]].map(r=>`<div class="ck" style="align-items:center"><span class="cb ${r[2]?'on':''}">${r[2]?ic('check',11):''}</span><span style="flex:1">${r[0]}</span><span class="badge2">${r[1]}</span></div>`).join('')}<div class="sec" style="margin-top:10px">Borders</div><div class="ck" style="align-items:center"><span class="cb on">${ic('check',11)}</span><span style="flex:1">Artaxiad Armenia</span><span class="badge2">Kingdom</span></div></div>
 <p class="hint">Nothing matches.</p>`,ffoot('Save places')));
F('s88','85 · Layer form: add / edit',side('Layers',
 `${hdrTrash('Add layer','')}
 <div class="sec" style="margin-top:12px">Names</div>${nameRow('en','Artaxiad capitals',{x:false,per:false})}${ADD}<p class="hint">Language missing? Ask an administrator (More › Languages).</p>
 <div class="sec">Description (one per language, optional)</div><div class="ncard">${pills('en')}<div class="r"><div class="in ta" style="min-height:64px;color:var(--ink)">The cities that served as capitals…</div>${ib('x','Remove this description','sm')}</div></div><div>${dchip('Add a description')}</div>
 <div class="sec">Category (optional)</div>${sel('State or kingdom')}
 <div class="sec">Dates (optional)</div><div class="dlab">From</div>${dateF('Exact','190','','BCE','Year',{modes:['Unknown','Exact'],cmp:1})}<div class="dlab" style="margin-top:8px">To</div>${dateF('Exact','12','','CE','Year',{modes:['Unknown','Exact'],cmp:1})}
 <div class="sec">Colour (optional)</div>${ck('use a colour',true)}${colr(2)}
 <div class="errline" style="margin-top:10px">${ic('alert',14)}Give the layer at least one name.</div>`,ffoot()).replace(ib('trash','','danger'),''));

/* More states */
F('s90','86 · Relief: edit colours, contour lines, height profile',side('More',
 fold('map','Maps &amp; base map','Relief',
 `<div class="sec" style="margin-top:0">Colour ramp</div>${sel('Natural terrain')}<div class="ramp"></div>
 ${acc(`<span class="tx" style="font-weight:600;font-size:13.5px">Edit colours</span><span class="ch">${ic('up')}</span>`,`<div class="stops">${[['#6f9a5a','0'],['#cfc58a','1500'],['#b08b5c','3000'],['#e9e4d6','5100']].map(s=>`<div class="stp"><i style="background:${s[0]}"></i><div class="in" style="height:30px">${s[0]}</div><div class="in" style="height:30px"><span>${s[1]}</span><span class="u">m</span></div>${ib('x','Remove colour','sm')}</div>`).join('')}</div><div class="dkf">${bt('Add colour','alt','plus')}${bt('Reset','alt','hist')}</div>`)}
 ${tr('layers','Contour lines',true)}<div style="margin:2px 0 8px">${sel('Step: automatic')}</div><p class="hint" style="margin:0 0 6px">Other steps: 10, 20, 50, 100, 200, 500, 1000 m.</p>
 <div class="sec">Height profile</div><div class="dkf" style="margin:0 0 8px">${bt('Draw height profile','alt','line')}${bt('Clear','alt','x')}</div>
 <div class="cnvs"><svg viewBox="0 0 340 86" preserveAspectRatio="none"><path d="M0 70 C40 60 60 20 100 30 S160 70 200 48 S280 10 340 36 V86 H0z" fill="#115098" fill-opacity=".12" stroke="#115098" stroke-width="2"/></svg></div>
 <div class="hint">Length 24 km · up 1,240 m · down 860 m</div><div class="hint" style="margin:2px 0 0">Height at the pointer: <b style="color:var(--ink)">2,340 m</b></div>
 <p class="hint" style="margin-top:10px">Relief options appear when the base map is Relief.</p>`)));
F('s91','87 · Historical maps: empty, uploading, error',side('More',
 fold('image','Historical maps','Image overlays',
 `<p class="hint" style="margin:0 0 8px">No historical maps yet.</p>${bt('Add image overlay','primary','upload')}
 <div class="sec">Uploading</div><div class="card" style="background:var(--bg)"><div style="display:flex;gap:10px;align-items:center"><b style="flex:1;color:var(--ink);font-weight:600">greater-armenia.jpg</b><span class="hint" style="margin:0">Uploading… 62%</span></div><div class="range" style="margin-top:10px"><i style="width:62%"></i></div></div>
 <div class="sec">Error</div>${errb('Save failed: the file is larger than 20 MB.')}
 <div class="sec">Visible overlay</div><div class="card" style="background:var(--bg);padding:10px 12px"><div style="display:flex;align-items:center;gap:10px"><span class="cb on" style="border-radius:6px;width:24px;height:24px">${ic('check',12)}</span><b style="flex:1;color:var(--ink);font-weight:600">Map of Greater Armenia, 1 c. BCE</b>${ib('fit','Fit to the map','sm')}${ib('edit','Edit overlay','sm')}</div></div>`)));
const dirIn=(a,ac,b,bc,info,err)=>`<div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center"><div class="in"><i style="width:9px;height:9px;border-radius:50%;background:#2e7d32;display:block"></i>${a?`<span style="color:var(--ink)">${a}</span>`:ph('— choose on the map')}</div>${ib('swap','Swap','sm')}<div class="in"><i style="width:9px;height:9px;border-radius:50%;background:#115098;display:block"></i>${b?`<span style="color:var(--ink)">${b}</span>`:ph('— choose on the map')}</div>${ib('x','Clear','sm')}</div>${info?`<p class="hint" style="margin-top:8px;${err?'color:var(--danger)':''}">${info}</p>`:''}`;
F('s92','88 · Directions: every state',side('More',
 fold('nav','Directions','All states',
 `<div class="sec" style="margin-top:0">Empty</div>${dirIn('','','','','')}
 <div class="sec">Start set</div>${dirIn('Van','','','','Now choose the destination on the map.')}
 <div class="sec">A point on the map (coordinates)</div>${dirIn('40.7894, 43.8475','','','','Now choose the destination on the map.')}
 <div class="sec">Routing</div>${dirIn('Van','','Yerevan','','Routing…')}
 <div class="sec">Result</div>${dirIn('Van','','Yerevan','','')}<div class="dist"><div>Distance<b>452<small>km</small></b></div><div>Car<b>6 h 40<small>min</small></b></div></div>
 <div class="sec">No route</div>${dirIn('Van','','Mount Ararat','','No route found (no road within 5 km).',1)}`)));
F('s93','89 · Languages, Types, Categories: no admin rights and empty lists',side('More',
 fold('lang','Languages','Read only',`<div class="lg hd2"><span>Code</span><span>Name</span><span>In the language</span><span></span></div><div class="lg"><span class="c">hy</span><span>Armenian</span><span class="n">Հայերեն</span><span></span></div><p class="hint" style="margin-top:10px">Only administrators can add a language. Missing one? Ask an administrator.</p><div class="lk" style="margin-top:6px">${ic('lock',14)}<span>No languages yet. (empty list)</span></div>`)+
 fold('tag','Types','Read only',`${tl(mkm('circle','#B3261E'),'City','point')}<p class="hint" style="margin-top:10px">Only administrators can add a type. Missing one? Ask an administrator.</p><p class="hint">No types yet. (empty list)</p>`)+
 fold('folder','Categories','Read only',`<div class="rw2"><div class="tx">Military campaign<div class="hint" style="margin:0">en Military campaign · hy Ռազմական արշավանք</div></div></div><p class="hint" style="margin-top:10px">Only administrators can add a category. Missing one? Ask an administrator.</p><p class="hint">No categories yet. (empty list)</p>`)));
F('s94','90 · Types: full list with usage and the four “Add” buttons',side('More',
 fold('tag','Types','25 place, route, area and river types',`<p class="hint" style="margin:0 0 8px">Every place, border and route has one of these types; the type decides its marker, line or colour. Missing one? Ask an administrator.</p>
 ${[['circle','#B3261E','City','point',41],['square','#455A64','Fortress','point',23],['diamond','#7B1FA2','Temple','point',9]].map(r=>`<div class="rw2">${mkm(r[0],r[1])}<div class="tx">${r[2]}</div><span class="tag">${r[3]}</span><span class="badge2">${r[4]}</span>${ib('edit','Edit '+r[2],'sm')}</div>`).join('')}
 <div class="rw2"><span class="mk" style="width:28px;height:28px">${ic('line',16)}</span><div class="tx">Trade</div><span class="tag">line</span><span class="badge2">6</span>${ib('edit','Edit Trade','sm')}</div>
 <div class="rw2"><span class="mk" style="width:28px;height:28px">${ic('area',16)}</span><div class="tx">Kingdom</div><span class="tag">area</span><span class="badge2">5</span>${ib('edit','Edit Kingdom','sm')}</div>
 <div class="rw2"><span class="mk" style="width:28px;height:28px">${ic('water',16)}</span><div class="tx">River</div><span class="tag">river</span><span class="badge2">6</span>${ib('edit','Edit River','sm')}</div>
 <div class="fromto" style="margin-top:10px"><button class="btn alt">${ic('plus',14)}Place type</button><button class="btn alt">${ic('plus',14)}Line type</button><button class="btn alt">${ic('plus',14)}Area type</button><button class="btn alt">${ic('plus',14)}River type</button></div>`)));

/* shell: dock, resizer, mobile */
F('s97','91 · Panel and dock: drag the edge, drag the grip, larger panel',side('Explore',
 `${searchRow('Search places, names, notes…')}${bar('<b>10</b> places')}<ul class="list">${row(PL[0])}${row(PL[2])}</ul>
 <div class="grip on" title="Drag to resize (double-click to reset)"><i></i></div>
 ${acc(`${mk(PL[1])}<div class="tx"><div class="nm">${PL[1][0]}</div><div class="dt">${PL[1][3]}</div></div>${ib('max','Larger panel','sm')}${ib('x','Close','sm')}`,`<div class="names"><span>Արտաշատ<em>hy</em></span></div><div class="sec">Notes · 2</div>${note('Foundation','en','176 BCE',LT,false)}`)}`,pfoot())+`<div class="rsz"></div><div class="rtip">Drag to resize (double-click to reset)</div>`);
F('s98','92 · Larger panel: the card takes the whole panel',side('Explore',
 `${acc(`${mk(PL[1])}<div class="tx"><div class="nm">${PL[1][0]}</div><div class="dt">${PL[1][3]}</div></div>${ib('collapse','Smaller panel','sm')}${ib('x','Close','sm')}`,`<div class="tools">${ib('edit','Edit place','sm')}${ib('nav','Route from here','sm')}</div><div class="names"><span>Արտաշատ<em>hy</em></span><span>Artaxata<em>la</em></span></div><div class="sec">Notes · 8</div>${note('Foundation','en','176 BCE',LT,false)}${note('Hannibal legend','en','c. 176 BCE','The tradition that Hannibal planned the city is told by Strabo and Plutarch.',true)}${note('Roman campaigns','en','163 – 166 CE','Burned by Roman forces under Statius Priscus in 163 CE.',false)}<button class="btn primary">${ic('plus',14)}Add note</button>`)}`,pfoot()));
const phone=(id,t,inner)=>out.push(`<div><p class="ttl">${t}</p><div class="frame phone" id="${id}">${mapSvg}${inner}</div></div>`);
phone('s99','93 · Phone (≤700px): panel is a bottom sheet, grab handle on top',`<span class="tg2 on" style="position:absolute;right:14px;bottom:468px;height:34px;line-height:34px;padding:0 14px;box-shadow:var(--shadow)">${ic('timetravel',14)}</span><div class="sheet" style="height:440px"><div class="grab"></div><div class="hd" style="padding:6px 14px 8px 16px"><div class="brand"><div class="logo" style="width:28px;height:28px">${ic('mount',16)}</div><div><h1 style="font-size:15px">Armenian Highlands</h1></div></div>${ib('down','Hide panel')}</div><nav class="tabs">${TABS.map(([i,t])=>`<button class="tab ${t=='Explore'?'on':''}">${ic(i,20)}${t}</button>`).join('')}</nav><div class="scroll" style="padding-top:10px">${searchRow('Search places…')}<ul class="list" style="margin-top:6px">${PL.slice(0,3).map(row).join('')}</ul></div></div>`);
phone('s100','94 · Phone: panel hidden, only the handle tab and the Time button stay',`<span class="tg2 on" style="position:absolute;right:14px;bottom:70px;height:34px;line-height:34px;padding:0 14px;box-shadow:var(--shadow)">${ic('timetravel',14)}</span><div style="position:absolute;left:50%;margin-left:-28px;bottom:0;width:56px;height:24px;border-radius:12px 12px 0 0;background:var(--surface);box-shadow:var(--shadow);display:grid;place-items:center;color:var(--blue)">${ic('up',18)}</div>`);

/* ======== v7: layers, borders, routes, add panels in the preferred style ======== */
Object.assign(P,{only:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',checklist:'<path d="M4 7l2 2 3-3M4 16l2 2 3-3M13 8h7M13 17h7"/>'});
const layerChips2=`<div class="chips"><span class="chip" style="background:var(--surface)"><i style="width:8px;height:8px;border-radius:50%;background:#5d7a3a;display:block"></i>Artaxiad capitals</span>${dchip('Add to a layer')}</div>`;
const seg3=(st)=>`<div class="seg3"><button class="${st==''?'on':''}" title="Show with everything else">${ic('eye',18)}</button><button class="${st=='only'?'on':''}" title="Show only this layer">${ic('only',18)}</button><button class="${st=='hide'?'on':''}" title="Hide this layer">${ic('eyeoff',18)}</button></div>`;
const lyc=(c,n,cat,cn,st,open,body)=>`<li style="list-style:none"><div class="lyc ${st=='hide'?'hide':''}" style="--lc:${c}"><div class="lh"><div class="tx"><div class="nm">${n}</div><div class="cat">${cat}</div><div class="cn">${cn}</div></div>${seg3(st)}</div>${open?`<div class="lb">${body}</div>`:''}</div></li>`;
const addFoot=(t)=>`<footer class="foot add"><button class="btn primary">${ic('plus',16)}${t}</button></footer>`;
const tbar=(a,del)=>`<div class="tools">${a.map(x=>ib(x[0],x[1],'sm')).join('')}<span class="sp"></span>${del?ib('trash',del,'sm danger'):''}</div>`;
const catRow=(ph_)=>`<div class="srow2"><div class="search">${ic('search')}<div class="in" style="color:var(--muted)">${ph_}</div></div><div class="sel2"><div class="in sel"><span>All categories</span>${ic('down',14)}</div></div></div>`;

F('s85','85 · Layers: three-state buttons, colour edge, Add layer pinned',side('Layers',
 `<div class="introc">${ic('info',16)}<span>A layer is a subset of the main map, for example one campaign. Places stay on the main map; use <b>Only</b> to isolate a layer or <b>Hide</b> to remove it.</span></div>${catRow('Search layers…')}<div class="rbar" style="margin-top:12px"><span class="cnt"><b>3</b> layers</span></div>
 <ul class="list">${lyc('#9a3b2e','Urartian fortresses','State or kingdom','3 places · 1 border','')}${lyc('#2a5f8f','Campaign of Tigranes II','Military campaign','7 places · 2 routes','only')}${lyc('#5d7a3a','Artaxiad capitals','State or kingdom','4 places','hide')}</ul>`,addFoot('Add layer')));

const mt=(k,c)=>`<span class="tile"><i class="${k}" style="display:block;width:12px;height:12px;background:${c};${k=='circle'?'border-radius:50%':'border-radius:2px'}"></i></span>`;
const lnTile=(c)=>`<span class="tile" style="color:${c}">${ic('line',18)}</span>`;
F('s86','86 · Layer card: icons on top, places with ✕, borders and routes, Add note',side('Layers',
 `${catRow('Search layers…')}<ul class="list" style="margin-top:10px">${lyc('#2a5f8f','Campaign of Tigranes II','Military campaign','7 places · 2 routes','only',true,
 `${tbar([['edit','Edit layer'],['checklist','Choose places and borders of this layer'],['fit','Fit map']],'Delete this layer')}
 <p class="hint" style="margin:0 0 4px;color:var(--ink);font-size:13px;line-height:1.5">Tigranes the Great's campaigns into Syria and Cappadocia, 83–69 BCE.</p>
 <div class="sec">Places · 7</div>${[['circle','#B3261E','Tigranakert'],['circle','#B3261E','Artashat'],['square','#455A64','Tushpa']].map(r=>`<div class="pr2">${mt(r[0],r[1])}<span class="tx">${r[2]}</span>${ib('x','Take this place out of the layer (it stays on the main map)','sm')}</div>`).join('')}<div class="moreln">+ 4 more</div>
 <div class="sec">Borders and routes · 2</div><div class="pr2">${lnTile('#9a3b2e')}<span class="tx">Campaign of Tigranes II</span></div><div class="pr2">${mt('square','#9a3b2e')}<span class="tx">Kingdom of Sophene</span></div>
 <div class="sec">Notes about this layer · 1</div>${note('Sources','en','','Plutarch, Lucullus 21–29.',false,false)}<button class="btn primary">${ic('plus',14)}Add note</button>
 <div class="lk">${ic('lock',14)}<span>Log in to change layers.</span></div>`)}</ul>`,
 `<footer class="cbar"><span><b>Delete this layer?</b> Places and borders stay on the main map.</span><button class="btn danger">Delete</button><a class="lnk">Cancel</a></footer>`));

F('s73','73 · Borders: list, hidden border, Add border pinned',side('Borders',
 `${intro('Borders of countries, regions and other areas, and lines. Colour them and show their names on the map.',1)}${srch('Search borders…')}${tpc([['#9a3b2e','square','Kingdom',5,0],['#2a5f8f','square','Province',4,0],['#5d7a3a','square','Territory',3,0]])}${bar('<b>12</b> of 12 borders')}
 <ul class="list">${srow(mkS('#9a3b2e','area'),'Kingdom of Urartu','Kingdom · area · 860 – 590 BCE',{aka:'Biainili'})}${srow(mkS('#9a3b2e','area'),'Artaxiad Armenia','Kingdom · area · 190 BCE – 12 CE')}${srow(mkS('#2a5f8f','area'),'Syunik','Province · area · 1st c. CE – present',{eye:false})}${srow(mkS('#5d7a3a','line'),'Limes of Kommagene','Border line · line · no dates')}</ul>`,addFoot('Add border')));
F('s74','74 · Border card: actions are icons on top of the card',side('Borders',
 `${srch('Search borders…')}<ul class="list" style="margin-top:8px">${shAcc(mkS('#9a3b2e','area'),'Kingdom of Urartu','Kingdom · area · 860 – 590 BCE',
 `${tbar([['edit','Edit names, type and dates'],['pen','Edit shape'],['hist','New version…'],['fit','Fit map']],'Delete this border')}
 <div class="names" style="margin-top:2px"><span>Biainili<em>xur</em></span><span>Ուրարտու<em>hy</em></span></div>
 <div class="sec">Versions in time · 3</div>${vers([['860 – 750 BCE',0],['750 – 590 BCE',1],['no dates',0]])}
 <div class="hint" style="margin-top:8px">Certainty: Approximate · Sources: <a style="color:var(--blue)">Piotrovsky, Urartu</a></div>
 <div class="sec">Look</div>${lookB({fill:['Fill opacity',30]})}
 <div class="sec">In layers</div>${layerChips2}
 <div class="sec">Notes · 1</div>${note('Extent under Argishti I','en','c. 780 BCE','Urartu reached Lake Sevan in the north and Lake Urmia in the south.',false,false)}${bt('Add note','primary','plus')}
 <p class="hint" style="margin-top:12px">Outline © OpenStreetMap contributors (ODbL)</p>`)}${srow(mkS('#9a3b2e','area'),'Artaxiad Armenia','Kingdom · area · 190 BCE – 12 CE')}</ul>`,addFoot('Add border')));
F('s75','75 · Add a border: search, results with +, draw or import',side('Borders',
 `<div class="banner" style="padding:14px 16px"><h5 style="font-size:16px">Add a border</h5><div class="hint" style="margin:0 0 12px">Find it on OpenStreetMap, draw it, or import a file.</div><div class="srow3"><div class="search">${ic('search')}<div class="in" style="color:var(--ink)">Lori</div></div><button class="btn primary">Search</button></div></div>
 <div class="sec">Results</div>${[['Lori Province','Province · Armenia'],['Lori, Gegharkunik','District · Armenia']].map(r=>`<div class="resrow">${mkS('#8a949a','area')}<div class="tx" style="flex:1"><div class="nm" style="font-size:15px">${r[0]}</div><div class="dt">${r[1]}</div></div>${ib('plus','Add this border')}</div>`).join('')}
 <p class="hint" style="margin-top:2px">Searching… · Nothing with an outline found. Try another spelling, or draw it. · Adding…</p>
 <div class="sec">Or draw it</div><div class="sg"><button class="on" title="Draw an area">${ic('area',18)}</button><button title="Draw a line">${ic('pen',18)}</button><button title="Import a GeoJSON file">${ic('upload',18)}</button></div>
 <p class="hint" style="margin-top:8px">Draw an area, a line, or import a GeoJSON file.</p>
 <p class="hint">Outlines from OpenStreetMap are © OpenStreetMap contributors (ODbL) and marked as such. Big outlines are simplified. · No areas or lines found in this file. · The file has 140 shapes; the limit is 100 at once. Split it.</p>`,
 `<footer class="foot form"><a style="color:var(--blue);font-weight:600;font-size:14px;padding:8px 0;display:block">Close</a></footer>`));
F('s79','79 · Rivers: find and add',side('Rivers',
 `<div class="banner" style="padding:14px 16px"><h5 style="font-size:16px">Find rivers</h5><div class="hint" style="margin:0 0 12px">Search OpenStreetMap by name. Several rivers can be found; they are only shown (blue), not saved.</div><div class="srow3"><div class="search">${ic('search')}<div class="in" style="color:var(--ink)">Akhurian</div></div><button class="btn primary">Find</button></div></div>
 <div class="sec">Found · 2</div>${[['Akhurian','River · Armenia, Turkey · 186 km'],['Akhurian canal','Canal · Armenia · 24 km']].map(r=>`<div class="resrow"><span class="tile" style="color:var(--ink2)">${ic('water',18)}</span><div class="tx" style="flex:1"><div class="nm" style="font-size:15px">${r[0]}</div><div class="dt">${r[1]}</div></div>${ib('plus','Show this river')}</div>`).join('')}
 <p class="hint" style="margin-top:2px">Searching… · No river line found. Try another spelling. · These rivers are only shown, not saved. Draw a river and follow one to save a section.</p>
 <div class="sec">Or draw it</div><div class="sg"><button class="on" title="Draw a river">${ic('pen',18)}</button><button title="Import a GeoJSON file">${ic('upload',18)}</button></div>
 <div class="swr" style="margin-top:8px;padding-left:0"><div>Follow a river between the points I click</div><span class="sw on"></span></div>`,
 `<footer class="foot form"><button class="btn alt" style="height:44px;color:var(--blue)">Close</button></footer>`));
F('s80','80 · Routes: list and path finder, Add route pinned',side('Routes',
 `${intro('Historical routes: trade routes, marches, migrations, journeys and roads. One-way routes have arrows.',1)}
 ${fold('routes','Find a path between places','Chains routes that share a place',`${fromTo('','')}${findBtns}<p class="hint">Chains the routes that pass a common place, in the direction they allow, for the period chosen in Explore.</p>`)}
 ${srch('Search routes…')}${tpc([['#c9a227','square','Trade',6,0],['#9a3b2e','square','Military',4,0],['#2a5f8f','square','Migration',2,0]])}${bar('<b>12</b> of 12 routes')}
 <ul class="list">${rtRow('#c9a227','Van – Artashat road','Trade · one way · Van → Artashat · 550 BCE – 300 CE')}${rtRow('#9a3b2e','March of Tigranes','Military · 83 – 69 BCE')}</ul>`,addFoot('Add route')));
F('s83','83 · Route card: actions are icons on top of the card',side('Routes',
 `${srch('Search routes…')}<ul class="list" style="margin-top:8px">${shAcc(mkS('#c9a227','line'),'Van – Artashat road','Trade · 455 km · 550 BCE – 300 CE',
 `${tbar([['edit','Edit names, type and dates'],['pen','Edit path'],['hist','New version…'],['reverse','Reverse: run the other way'],['fit','Fit map']],'Delete this route')}
 <div class="names" style="margin-top:2px"><span>Վան – Արտաշատ ճանապարհ<em>hy</em></span></div>
 <div class="sec">Versions in time · 2</div>${vers([['550 – 300 BCE',1],['300 BCE – 300 CE',0]])}
 <div class="sec">Places on the way</div><div class="chips"><span class="chip">Van</span><span style="color:var(--muted);display:grid">${ic('right',14)}</span><span class="chip">Tushpa</span><span style="color:var(--muted);font-size:11px">62 km</span><span style="color:var(--muted);display:grid">${ic('right',14)}</span><span class="chip">Artashat</span></div><p class="hint">and 4 free waypoints that only give the line its course.</p>
 <div class="sec">Joins</div><div class="chips"><span class="chip">Royal road</span><span class="chip">Lake road</span></div><p class="hint">Routes that pass one of its places: use “Find a path” to chain them.</p>
 <div class="sec">Look</div>${lookB({c:3,fill:['Opacity',85],w:3})}
 <div class="sec">In layers</div>${layerChips2}
 <p class="hint" style="margin-top:12px">The path follows modern roads: © OpenStreetMap contributors (ODbL), via OSRM. Edit the path to match the historical one.</p>`)}</ul>`,addFoot('Add route')));

const LC_ALL=LC;LC=['hy','en','ru','la'];
F('s58','58 · Few languages: everything fits, no “+N” button',side('Explore',`<ul class="list">${placeAcc(PL[1],`<div class="fhd" style="margin-bottom:2px"><h5>Edit place</h5></div><div class="sec" style="margin-top:10px">Names</div>${nameRow('en','Artashat',{x:false})}${nameRow('hy','Արտաշատ')}${ADD}`)}</ul>`,ffoot()));
LC=LC_ALL;
document.getElementById('out').innerHTML=out.join('');
/* fit: show as many items as fit, selected always; "+N" appears only on overflow */
document.querySelectorAll('[data-fit]').forEach(c=>{const it=[...c.querySelectorAll('.fi')],m=c.querySelector('.fmore'),n=m.querySelector('.n');
 it.forEach(i=>i.hidden=false);m.hidden=true;if(c.scrollWidth<=c.clientWidth)return;m.hidden=false;let h=0;
 for(let i=it.length-1;i>=0&&c.scrollWidth>c.clientWidth;i--){if(it[i].classList.contains('on'))continue;it[i].hidden=true;h++;n.textContent='+'+h}});
/* open menus sit 4px under their anchor */
document.querySelectorAll('.menu[data-for]').forEach(m=>{const f=m.closest('.frame'),a=f.querySelector(m.dataset.for),fr=f.getBoundingClientRect(),ar=a.getBoundingClientRect();m.style.top=(ar.bottom-fr.top+4)+'px';m.style.left=(m.dataset.al=='right'?ar.right-fr.left-m.offsetWidth:16)+'px'});
