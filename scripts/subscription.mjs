import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {uuidV5} from './ical.mjs';
export const allowed=e=>!/\bchampions\b|senior|lpga|women|mid.amateur|pnc championship|q-school/i.test([e.summary,e.tour,...(e.categories??[])].join(' '));
const norm=s=>s.toLowerCase().replace(/^watch: /,'').replace(/^20\d\d /,'').replace(/, dubai$/,'').replace(/[^a-z0-9]/g,'');
const day=s=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
const stamp=()=>new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
function legacy(raw){return raw.replace(/\r\n /g,'').split('BEGIN:VEVENT\r\n').slice(1).map(b=>{
 const get=k=>b.split('\r\n').find(l=>l.startsWith(k+':'))?.slice(k.length+1);
 const date=v=>`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`;
 const utc=v=>`${date(v)}T${v.slice(9,11)}:${v.slice(11,13)}:${v.slice(13,15)}Z`;
 const e={uid:get('UID'),summary:get('SUMMARY')?.replace(/\\,/g,','),status:'CANCELLED',sequence:Number(get('SEQUENCE')??0)+1,lastModified:stamp()};
 if(get('DTSTART')){e.startUtc=utc(get('DTSTART'));e.endUtc=utc(get('DTEND'));}else{e.start=date(get('DTSTART;VALUE=DATE'));let d=new Date(date(get('DTEND;VALUE=DATE'))+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-1);e.end=d.toISOString().slice(0,10);}return e;
});}
export async function subscriptionFeed(feed,combined,broadcast,root){
 const path=join(root,'sources',`subscription-state-${feed.id}.json`);
 let state;try{state=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state={events:{},retired:[]};}
 const calendar={...(feed.kind==='broadcasts'?broadcast.calendar:combined.calendar),name:'Men’s Golf — Tournaments & Viewing',description:'PGA TOUR, DP World Tour, men’s majors and team cups, U.S. Amateur, Walker Cup, Eisenhower Trophy, men’s exhibitions, TGL and men’s Olympic golf. All-day events updated with U.S. viewing details.'};
 const windows=broadcast.events.filter(allowed);
 const candidates=combined.events.filter(e=>allowed(e)&&!e.id.startsWith('broadcast:'));
 for(const w of windows) {
  const existing=candidates.find(e=>w.tournamentId===e.id||(norm(e.summary)===norm(w.tournament)&&(e.start??e.startUtc).slice(0,4)===w.startUtc.slice(0,4)));
  if(existing?.broadcastOnly) { existing.start=[existing.start,day(w.startUtc)].sort()[0]; existing.end=[existing.end,day(w.endUtc)].sort().at(-1); }
  else if(!existing)candidates.push({id:`event:${w.id}`,broadcastOnly:true,summary:w.tournament,start:day(w.startUtc),end:day(w.endUtc),location:w.location,url:w.sourceUrl,description:`Dates reflect confirmed coverage windows. Official source: ${w.sourceUrl}`});
 }
 const events=[],seen=new Set();
 for(const candidate of candidates){
 const e={...candidate};e.start=e.start??day(e.startUtc);e.end=e.end??day(e.endUtc);delete e.startUtc;delete e.endUtc;delete e.alarmMinutes;
 const duplicateKey=`${norm(e.summary)}:${e.start.slice(0,4)}`;if(seen.has(duplicateKey))continue;seen.add(duplicateKey);
 const key=e.id;
 e.id=state.events[key]?.id??e.id;e.uid=`urn:uuid:${uuidV5(e.id,calendar.namespace)}`;
 const matches=windows.filter(w=>(w.tournamentId===e.id||norm(w.tournament)===norm(e.summary))&&day(w.startUtc)>=e.start&&day(w.startUtc)<=e.end).sort((a,b)=>a.startUtc.localeCompare(b.startUtc));
 const clean=(e.description??'').split('\n').filter(l=>!/^Viewing:|^Exact U.S. viewing/.test(l)).join('\n');
 const fmt=s=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(s));
 e.description=clean+'\n\n'+(matches.length?'Confirmed U.S. viewing (Central Time):\n'+matches.map(w=>`${fmt(w.startUtc)} – ${fmt(w.endUtc)} | ${w.platforms.join(' + ')} | ${w.coverageType??'Coverage'}\n${w.sourceUrl}`).join('\n'):(candidate.startUtc&&candidate.platforms?.length?`Viewing: ${fmt(candidate.startUtc)} | ${candidate.platforms.join(' + ')}. See official source for final coverage duration.`:'Viewing schedule pending. This entry will be updated when official U.S. broadcast details are available.'));
 const fingerprint=JSON.stringify({...e,sequence:undefined,lastModified:undefined,pga:undefined,dp:undefined});const prior=state.events[key];
 e.sequence=prior?prior.sequence+(prior.fingerprint!==fingerprint?1:0):(e.sequence??0)+1;e.lastModified=prior?.fingerprint===fingerprint?prior.lastModified:stamp();
 state.events[key]={id:e.id,fingerprint,sequence:e.sequence,lastModified:e.lastModified};events.push(e);
 }
 const active=new Set(events.map(e=>e.uid)),retired=new Map(state.retired.map(e=>[e.uid,e]));
 for(const e of legacy(await readFile(join(root,'dist',feed.filename),'utf8')))if(!active.has(e.uid)&&!retired.has(e.uid))retired.set(e.uid,e);
 state.retired=[...retired.values()].filter(e=>!active.has(e.uid));
 const content=JSON.stringify(state,null,2)+'\n';let previous='';try{previous=await readFile(path,'utf8');}catch{}
 if(content!==previous)await writeFile(path,content);
 events.push(...state.retired);calendar.generatedAt=events.map(e=>e.lastModified).sort().at(-1)??calendar.generatedAt;
 return {calendar,events};
}
