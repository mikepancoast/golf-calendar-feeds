import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCalendar } from "./ical.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const registry = JSON.parse(await readFile(join(root, "feeds.json"), "utf8"));
const baseUrlArgument = process.argv.find((value) => value.startsWith("--base-url="));
const baseUrl = baseUrlArgument?.slice("--base-url=".length).replace(/\/$/, "");

if (registry.formatVersion !== 1) {
  throw new Error(`Unsupported feeds.json format version: ${registry.formatVersion}`);
}

await mkdir(dist, { recursive: true });

const sourceByFeed = new Map();
for (const feed of registry.feeds.filter((item) => item.source)) {
  const source = JSON.parse(await readFile(join(root, feed.source), "utf8"));
  sourceByFeed.set(feed.id, source);
}

function joinLocation(event) {
  return [event.course, event.location].filter(Boolean).join(" - ");
}

function pgaEvent(event, data) {
  const description = [
    `PGA TOUR 2027 - ${event.type}.`,
    `Official tournament week: ${event.officialWeek}.`
  ];
  if (event.course) description.push(`Course(s): ${event.course}.`);
  if (event.location) description.push(`Location: ${event.location}.`);
  if (event.points !== null) description.push(`FedExCup points: ${event.points}.`);
  if (event.note) description.push(event.note);
  description.push("Schedule details may change.", `Source: ${data.calendar.sourceArticle}`);

  return {
    ...event,
    location: joinLocation(event),
    description: description.join("\n"),
    url: data.calendar.scheduleUrl,
    categories: ["SPORTS", "GOLF", "PGA TOUR", event.type.toUpperCase()]
  };
}

function dpEvent(event, data) {
  const description = [
    `DP World Tour 2027 season - ${event.type ?? "Tournament"}.`,
    `Swing: ${event.swing}.`,
    `Course: ${event.course}.`,
    `Location: ${event.location}.`,
    `Race to Dubai ranking points: ${event.points.toLocaleString("en-US")}.`
  ];
  if (event.note) description.push(event.note);
  description.push(
    "Viewing: Exact broadcast times and platforms have not yet been published; check the official DP World Tour Watch page closer to the event.",
    "Schedule details may change.",
    `Source: ${data.calendar.scheduleUrl}`
  );

  return {
    ...event,
    location: joinLocation(event),
    description: description.join("\n"),
    url: data.calendar.scheduleUrl,
    categories: ["SPORTS", "GOLF", "DP WORLD TOUR", event.swing.toUpperCase()]
  };
}

function amateurEvent(event) {
  const description = [
    `Championship dates: ${event.start} through ${event.end}.`,
    `Course: ${event.course}.`,
    `Location: ${event.location}.`,
    `Viewing: ${event.viewing}`
  ];
  if (event.note) description.push(event.note);
  description.push("Dates, venues and viewing details may change.", `Event source: ${event.source}`);
  if (event.viewingSource) description.push(`Viewing source: ${event.viewingSource}`);

  return {
    ...event,
    location: joinLocation(event),
    description: description.join("\n"),
    url: event.source,
    categories: ["SPORTS", "GOLF", "AMATEUR GOLF", ...event.categories]
  };
}

function championsEvent(event, data) {
  const description = [
    `PGA TOUR Champions 2027 - ${event.phase}.`,
    `Tournament dates: ${event.start} through ${event.end}.`,
    `Course: ${event.course}.`,
    `Location: ${event.location}.`
  ];
  if (event.note) description.push(event.note);
  description.push(
    "Viewing: PGA TOUR Champions announced national Golf Channel coverage; exact daily windows will be added when published.",
    "Schedule details may change.",
    `Official source: ${data.calendar.scheduleUrl}`
  );

  return {
    ...event,
    location: joinLocation(event),
    description: description.join("\n"),
    url: data.calendar.scheduleUrl,
    categories: ["SPORTS", "GOLF", "PGA TOUR CHAMPIONS", event.phase.toUpperCase()]
  };
}

function broadcastEvent(event) {
  const description = [
    `${event.coverageType ?? "Live coverage"} of ${event.tournament}.`,
    `Tour or organizer: ${event.tour}.`,
    `Watch on: ${event.platforms.join(" + ")}.`
  ];
  if (event.publishedTimeLabel) description.push(`Published time: ${event.publishedTimeLabel}.`);
  if (event.territory) description.push(`Territory: ${event.territory}.`);
  if (event.note) description.push(event.note);
  description.push("Broadcast details may change.", `Official source: ${event.sourceUrl}`);
  if (event.announcementUrl) description.push(`Official announcement: ${event.announcementUrl}`);

  return {
    ...event,
    summary: event.summary ?? `Watch: ${event.tournament} - ${event.platforms.join(" + ")}`,
    description: description.join("\n"),
    url: event.sourceUrl,
    categories: ["SPORTS", "GOLF", "BROADCAST", event.tour.toUpperCase(), ...event.platforms.map((platform) => platform.toUpperCase())],
    alarmMinutes: event.alarmMinutes ?? 15
  };
}

function tglEvent(event, data) {
  const description = [
    `TGL 2027 - ${event.phase}.`,
    `Matchup: ${event.matchup}.`,
    `Published time: ${event.publishedTimeLabel}.`
  ];
  if (event.platforms?.length) description.push(`U.S. network: ${event.platforms.join(" + ")}.`);
  if (event.startUtc) {
    description.push("Calendar end time is set two hours after the official start based on TGL's official approximate match length; actual completion may vary.");
  }
  if (event.note) description.push(event.note);
  description.push(`Official schedule: ${data.calendar.scheduleUrl}`);
  description.push(`Schedule announcement: ${data.calendar.announcementUrl}`);
  if (event.startUtc) description.push(`Duration basis: ${data.calendar.durationBasisUrl}`);

  return {
    ...event,
    location: "SoFi Center - Palm Beach Gardens, Florida, USA",
    description: description.join("\n"),
    url: data.calendar.scheduleUrl,
    categories: ["SPORTS", "GOLF", "TGL", event.phase.toUpperCase(), ...(event.platforms ?? []).map((platform) => platform.toUpperCase())],
    alarmMinutes: event.startUtc ? (event.alarmMinutes ?? 15) : undefined
  };
}

function yearEndEvent(event) {
  const description = [`${event.tour} - ${event.type}.`];
  if (event.start) description.push(`Tournament dates: ${event.start} through ${event.end}.`);
  if (event.publishedTimeLabel) description.push(`Published start: ${event.publishedTimeLabel}.`);
  if (event.platforms?.length) description.push(`Watch on: ${event.platforms.join(" + ")}.`);
  if (event.course) description.push(`Course: ${event.course}.`);
  if (event.location) description.push(`Location: ${event.location}.`);
  if (event.note) description.push(event.note);
  if (event.endTimeNote) description.push(event.endTimeNote);
  if (!event.platforms?.length) description.push("Exact U.S. viewing windows will be added when officially published.");
  description.push("Schedule details may change.", `Official source: ${event.sourceUrl}`);

  return {
    ...event,
    location: joinLocation(event),
    description: description.join("\n"),
    url: event.sourceUrl,
    categories: ["SPORTS", "GOLF", "LATE 2026", event.tour.toUpperCase(), event.type.toUpperCase(), ...(event.platforms ?? []).map((platform) => platform.toUpperCase())],
    alarmMinutes: event.startUtc ? (event.alarmMinutes ?? 15) : undefined
  };
}

function simpleFeed(feed) {
  const data = sourceByFeed.get(feed.id);
  const adapters = {
    "pga-tour": pgaEvent,
    "dp-world-tour": dpEvent,
    "pga-tour-champions": championsEvent,
    amateur: amateurEvent,
    broadcasts: broadcastEvent,
    tgl: tglEvent,
    "year-end": yearEndEvent
  };
  const adapt = adapters[feed.kind];
  if (!adapt) throw new Error(`Unsupported feed kind: ${feed.kind}`);

  const sourceUrl = data.calendar.sourceArticle ?? data.calendar.scheduleUrl ?? data.calendar.sourceUrls?.[0];
  return {
    calendar: { ...data.calendar, sourceUrl },
    events: data.events.map((event) => adapt(event, data))
  };
}

function eventDate(event) {
  return event.start ?? event.startUtc?.slice(0, 10);
}

function yearEndFeed(feed) {
  const data = sourceByFeed.get(feed.id);
  const events = data.events.map((event) => ({
    ...yearEndEvent(event, data),
    id: `year-end:${event.id}`
  }));

  for (const sourceId of feed.includeSources ?? []) {
    const sourceFeed = registry.feeds.find((item) => item.id === sourceId);
    const sourceData = sourceByFeed.get(sourceId);
    if (!sourceFeed || !sourceData) throw new Error(`Year-end feed ${feed.id} has an unknown source: ${sourceId}`);

    const adapters = {
      "dp-world-tour": dpEvent,
      tgl: tglEvent,
      broadcasts: broadcastEvent
    };
    const adapt = adapters[sourceFeed.kind];
    if (!adapt) throw new Error(`Year-end feed ${feed.id} cannot include source kind: ${sourceFeed.kind}`);

    for (const event of sourceData.events) {
      const date = eventDate(event);
      if (!date || date < feed.from || date > feed.through) continue;
      events.push({ ...adapt(event, sourceData), id: `${sourceId}:${event.id}` });
    }
  }

  events.sort((a, b) => eventDate(a).localeCompare(eventDate(b)) || a.summary.localeCompare(b.summary));
  const generatedAt = [data.calendar.generatedAt, ...(feed.includeSources ?? []).map((sourceId) => sourceByFeed.get(sourceId)?.calendar.generatedAt)]
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    calendar: { ...data.calendar, generatedAt },
    events,
    yearEndEventCount: events.length
  };
}

function combinedFeed(feed) {
  const [pgaData, dpData] = feed.members.map((id) => sourceByFeed.get(id));
  if (!pgaData || !dpData) throw new Error(`Combined feed ${feed.id} has an unknown member.`);

  const byKey = new Map();
  for (const event of pgaData.events) {
    const key = `${event.start}|${event.summary.toLowerCase()}`;
    byKey.set(key, { ...event, tours: ["PGA TOUR"], pga: event });
  }
  for (const event of dpData.events) {
    const key = `${event.start}|${event.summary.toLowerCase()}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.tours.push("DP World Tour");
      existing.dp = event;
    } else {
      byKey.set(key, { ...event, tours: ["DP World Tour"], dp: event });
    }
  }

  const tournamentEvents = [...byKey.values()]
    .sort((a, b) => a.start.localeCompare(b.start) || a.summary.localeCompare(b.summary))
    .map((event) => {
      const description = [`Tours: ${event.tours.join(" + ")}.`];
      if (event.pga) {
        description.push(`PGA TOUR classification: ${event.pga.type}.`);
        description.push(`Official tournament week: ${event.pga.officialWeek}.`);
        if (event.pga.points !== null) description.push(`FedExCup points: ${event.pga.points}.`);
      }
      if (event.dp) {
        description.push(`DP World Tour swing: ${event.dp.swing}.`);
        description.push(`Race to Dubai ranking points: ${event.dp.points.toLocaleString("en-US")}.`);
      }
      if (event.course) description.push(`Course(s): ${event.course}.`);
      if (event.location) description.push(`Location: ${event.location}.`);
      if (event.note) description.push(event.note);
      description.push(
        "Viewing: Exact 2027 broadcast times and platforms have not yet been published; check the tours' official viewing pages closer to the event.",
        "Schedule details may change.",
        `PGA TOUR source: ${pgaData.calendar.sourceArticle}`,
        `DP World Tour source: ${dpData.calendar.scheduleUrl}`
      );

      return {
        ...event,
        id: [event.pga?.id, event.dp?.id].filter(Boolean).join("+"),
        location: joinLocation(event),
        description: description.join("\n"),
        url: event.dp ? dpData.calendar.scheduleUrl : pgaData.calendar.scheduleUrl,
        categories: ["SPORTS", "GOLF", ...event.tours.map((tour) => tour.toUpperCase())]
      };
    });

  const broadcastData = sourceByFeed.get(feed.broadcastSource);
  const broadcastEvents = (broadcastData?.events ?? []).map((event) => ({
    ...broadcastEvent(event, broadcastData),
    id: `broadcast:${event.id}`
  }));
  const tglData = sourceByFeed.get(feed.tglSource);
  const tglEvents = (tglData?.events ?? []).map((event) => ({
    ...tglEvent(event, tglData),
    id: `tgl:${event.id}`
  }));
  const championsData = sourceByFeed.get(feed.championsSource);
  const championsEvents = (championsData?.events ?? []).map((event) => ({
    ...championsEvent(event, championsData),
    id: `champions:${event.id}`
  }));
  const amateurData = sourceByFeed.get(feed.amateurSource);
  const amateurEvents = (amateurData?.events ?? [])
    .filter((event) => event.start.startsWith("2027-"))
    .map((event) => ({
      ...amateurEvent(event, amateurData),
      id: `amateur:${event.id}`
    }));
  const yearEndData = sourceByFeed.get(feed.yearEndSource);
  const yearEndEvents = (yearEndData?.events ?? []).map((event) => ({
    ...yearEndEvent(event, yearEndData),
    id: `year-end:${event.id}`
  }));
  const events = [...tournamentEvents, ...championsEvents, ...amateurEvents, ...yearEndEvents, ...tglEvents, ...broadcastEvents]
    .sort((a, b) => (a.start ?? a.startUtc).localeCompare(b.start ?? b.startUtc) || a.summary.localeCompare(b.summary));

  const generatedAt = [feed.calendar.generatedAt, championsData?.calendar.generatedAt, amateurData?.calendar.generatedAt, yearEndData?.calendar.generatedAt, broadcastData?.calendar.generatedAt, tglData?.calendar.generatedAt]
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    calendar: { ...feed.calendar, generatedAt },
    events,
    sharedEventCount: tournamentEvents.filter((event) => event.tours.length > 1).length,
    broadcastEventCount: broadcastEvents.length,
    tglEventCount: tglEvents.length,
    yearEndEventCount: yearEndEvents.length,
    championsEventCount: championsEvents.length,
    amateurEventCount: amateurEvents.length
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const manifest = {
  formatVersion: 1,
  rebuiltAt: new Date().toISOString().slice(0, 10),
  feeds: []
};

for (const feed of registry.feeds) {
  const built = feed.kind === "combined" ? combinedFeed(feed) : feed.kind === "year-end" ? yearEndFeed(feed) : simpleFeed(feed);
  const subscriptionUrl = baseUrl ? `${baseUrl}/${feed.filename}` : undefined;
  const output = renderCalendar(built.calendar, built.events, { subscriptionUrl });
  await writeFile(join(dist, feed.filename), output, "utf8");
  manifest.feeds.push({
    id: feed.id,
    filename: feed.filename,
    name: built.calendar.name,
    eventCount: built.events.length,
    allDayEventCount: built.events.filter((event) => !event.startUtc).length,
    timedEventCount: built.events.filter((event) => Boolean(event.startUtc)).length,
    sharedEventCount: built.sharedEventCount ?? 0,
    broadcastEventCount: built.broadcastEventCount ?? (feed.kind === "broadcasts" ? built.events.length : 0),
    tglEventCount: built.tglEventCount ?? (feed.kind === "tgl" ? built.events.length : 0),
    yearEndEventCount: built.yearEndEventCount ?? 0,
    championsEventCount: built.championsEventCount ?? (feed.kind === "pga-tour-champions" ? built.events.length : 0),
    amateurEventCount: built.amateurEventCount ?? (feed.kind === "amateur" ? built.events.length : 0),
    generatedAt: built.calendar.generatedAt,
    sha256: sha256(output),
    source: feed.source ?? feed.members
  });
}

await writeFile(join(dist, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(join(dist, "_headers"), "/*.ics\n  Content-Type: text/calendar; charset=utf-8\n  Cache-Control: public, max-age=300\n", "utf8");
await writeFile(join(dist, ".nojekyll"), "", "utf8");

const listItems = manifest.feeds.map((feed) => `
      <li data-file="${feed.filename}">
        <strong>${feed.name}</strong>
        <span>${feed.eventCount} events</span>
        <a class="subscribe" href="${feed.filename}">Subscribe</a>
        <a href="${feed.filename}" download>Download snapshot</a>
      </li>`).join("");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Golf calendar subscriptions</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { max-width: 50rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.5; }
    ul { display: grid; gap: 1rem; padding: 0; list-style: none; }
    li { display: grid; gap: .35rem; padding: 1rem; border: 1px solid #8886; border-radius: .75rem; }
    li span { opacity: .7; }
    a { width: fit-content; }
  </style>
</head>
<body>
  <h1>Golf calendar subscriptions</h1>
  <p>Choose Subscribe for an updating calendar feed, or Download snapshot for a one-time import.</p>
  <ul>${listItems}
  </ul>
  <p>Unofficial calendars. Dates and viewing details may change.</p>
  <script>
    for (const link of document.querySelectorAll("a.subscribe")) {
      const url = new URL(link.getAttribute("href"), location.href);
      url.protocol = "webcal:";
      link.href = url.href;
    }
  </script>
</body>
</html>
`;
await writeFile(join(dist, "index.html"), html, "utf8");

for (const feed of manifest.feeds) {
  const details = [
    feed.sharedEventCount ? `${feed.sharedEventCount} shared events` : null,
    feed.broadcastEventCount ? `${feed.broadcastEventCount} special-event broadcasts` : null,
    feed.tglEventCount ? `${feed.tglEventCount} TGL entries` : null,
    feed.yearEndEventCount ? `${feed.yearEndEventCount} late-2026 entries` : null,
    feed.championsEventCount ? `${feed.championsEventCount} PGA TOUR Champions entries` : null,
    feed.amateurEventCount ? `${feed.amateurEventCount} amateur entries` : null
  ].filter(Boolean);
  console.log(`Built ${feed.filename}: ${feed.eventCount} events${details.length ? ` (${details.join("; ")})` : ""}.`);
}
