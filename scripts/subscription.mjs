import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {uuidV5} from './ical.mjs';

export const allowed = e => !/\bchampions\b|senior|lpga|women|mid.amateur|pnc championship|q-school/i.test([e.summary,e.tour,...(e.categories ?? [])].join(' '));
const norm = s => s.toLowerCase().replace(/^watch: /,'').replace(/^20\d\d /,'').replace(/, dubai$/,'').replace(/[^a-z0-9]/g,'');
const day = s => new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
const stamp = () => new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
const fmt = s => new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(s));

export async function subscriptionFeed(feed, combined, broadcast, root) {
  const path = join(root,'sources',`subscription-state-${feed.id}.json`);
  let state;
  try { state = JSON.parse(await readFile(path,'utf8')); }
  catch(e) { if(e.code !== 'ENOENT') throw e; state = {events:{},retired:[]}; }
  state.primaryWindows ??= {};
  const calendar = {...(feed.kind === 'broadcasts' ? broadcast.calendar : combined.calendar),
    name:'Men’s Golf — Tournaments & Viewing',
    description:'All-day tournament placeholders become timed U.S. viewing windows when announced. Men’s PGA TOUR, DP World Tour, majors, team cups, selected amateur championships, exhibitions, TGL and Olympic golf.'};
  const windows = broadcast.events.filter(allowed);
  const candidates = combined.events.filter(e => allowed(e) && !e.id.startsWith('broadcast:'));
  for (const w of windows) {
    const existing = candidates.find(e => w.tournamentId === e.id || (norm(e.summary) === norm(w.tournament) && (e.start ?? e.startUtc).slice(0,4) === w.startUtc.slice(0,4)));
    if (existing?.broadcastOnly) {
      existing.start = [existing.start,day(w.startUtc)].sort()[0];
      existing.end = [existing.end,day(w.endUtc)].sort().at(-1);
    } else if (!existing) candidates.push({id:`event:${w.id}`,broadcastOnly:true,summary:w.tournament,start:day(w.startUtc),end:day(w.endUtc),location:w.location,url:w.sourceUrl,description:`Official source: ${w.sourceUrl}`});
  }
  const events = [], seen = new Set();
  const revise = event => {
    const e = {...event, uid:`urn:uuid:${uuidV5(event.id,calendar.namespace)}`};
    const fingerprint = JSON.stringify({...e,sequence:undefined,lastModified:undefined,pga:undefined,dp:undefined});
    const prior = state.events[e.id];
    const retired = (state.retired ?? []).find(r => r.uid === e.uid);
    const base = Math.max(prior?.sequence ?? -1, retired?.sequence ?? -1, e.sequence ?? 0);
    e.sequence = prior?.fingerprint === fingerprint && !retired ? prior.sequence : base + 1;
    e.lastModified = prior?.fingerprint === fingerprint && !retired ? prior.lastModified : stamp();
    state.events[e.id] = {id:e.id,fingerprint,sequence:e.sequence,lastModified:e.lastModified};
    events.push(e);
  };
  for (const candidate of candidates) {
    const start = candidate.start ?? day(candidate.startUtc);
    const end = candidate.end ?? day(candidate.endUtc);
    const key = `${norm(candidate.summary)}:${start.slice(0,4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const matches = windows.filter(w => (w.tournamentId === candidate.id || norm(w.tournament) === norm(candidate.summary)) && day(w.startUtc) >= start && day(w.startUtc) <= end).sort((a,b) => a.startUtc.localeCompare(b.startUtc) || a.id.localeCompare(b.id));
    const clean = (candidate.description ?? '').split('\n').filter(l => !/^Viewing:|^Exact U.S. viewing/.test(l)).join('\n');
    if (matches.length) {
      // The first published window inherits the placeholder identity. Keep that
      // assignment if a later update inserts an earlier window or changes times.
      state.primaryWindows[candidate.id] ??= matches[0].id;
      for (const w of matches) {
        const id = w.id === state.primaryWindows[candidate.id] ? candidate.id : (feed.kind === 'broadcasts' ? w.id : `broadcast:${w.id}`);
        revise({id,summary:`Watch: ${candidate.summary.replace(/^Watch: /,'')} — ${w.platforms.join(' + ')}`,
          startUtc:w.startUtc,endUtc:w.endUtc,status:w.status ?? 'CONFIRMED',
          location:candidate.location ?? w.location,url:w.sourceUrl,
          description:`${clean}\n\n${w.coverageType ?? 'Live coverage'}\nWatch on: ${w.platforms.join(' + ')}\n${fmt(w.startUtc)} – ${fmt(w.endUtc)}\nTerritory: ${w.territory ?? 'United States'}\nOfficial source: ${w.sourceUrl}${w.note ? '\n'+w.note : ''}`,
          categories: ['SPORTS','GOLF','BROADCAST'],alarmMinutes:w.status === 'CANCELLED' ? undefined : (w.alarmMinutes ?? 15)});
      }
    } else if (candidate.startUtc && candidate.endUtc && candidate.platforms?.length) {
      // Preserve already researched TGL/skins windows, including their explicit
      // estimated-duration labels. Never invent a new end time here.
      revise({...candidate,description:clean,status:candidate.status ?? 'CONFIRMED'});
    } else {
      const e = {...candidate,start,end,description:`${clean}\n\nViewing schedule pending. This placeholder will become timed viewing entries when confirmed coverage is announced.`};
      delete e.startUtc; delete e.endUtc; delete e.alarmMinutes;
      revise(e);
    }
  }
  // Prior migration tombstones have already been published. Archive them instead
  // of indefinitely displaying cancelled broadcasts that are still happening.
  state.retiredHistory ??= [];
  const archived = new Set(state.retiredHistory.map(e => e.uid));
  for (const e of state.retired ?? []) if (!archived.has(e.uid)) {state.retiredHistory.push(e);archived.add(e.uid);}
  state.retired = [];
  const content = JSON.stringify(state,null,2)+'\n';
  let previous = ''; try {previous = await readFile(path,'utf8');} catch(e) {if(e.code !== 'ENOENT') throw e;}
  if (content !== previous) await writeFile(path,content);
  calendar.generatedAt = events.map(e => e.lastModified).sort().at(-1) ?? calendar.generatedAt;
  return {calendar,events};
}
