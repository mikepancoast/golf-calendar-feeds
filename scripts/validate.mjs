import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const manifest = JSON.parse(await readFile(join(dist, "manifest.json"), "utf8"));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

function unfold(text) {
  return text.slice(0, -2).split("\r\n").reduce((lines, line) => {
    if (/^[ \t]/.test(line)) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
    return lines;
  }, []);
}

for (const feed of manifest.feeds) {
  const path = join(dist, feed.filename);
  const raw = await readFile(path);
  const text = raw.toString("utf8");
  const label = feed.filename;

  check(text.endsWith("\r\n"), `${label}: file must end with CRLF.`);
  check(!/(?<!\r)\n/.test(text), `${label}: file contains a bare LF.`);
  check(!/\r(?!\n)/.test(text), `${label}: file contains a bare CR.`);
  const physical = text.endsWith("\r\n") ? text.slice(0, -2).split("\r\n") : [];
  physical.forEach((line, index) => {
    check(Buffer.byteLength(line, "utf8") <= 75, `${label}: physical line ${index + 1} exceeds 75 octets.`);
  });

  const logical = unfold(text);
  check(logical[0] === "BEGIN:VCALENDAR", `${label}: missing VCALENDAR start.`);
  check(logical.at(-1) === "END:VCALENDAR", `${label}: missing VCALENDAR end.`);
  check(logical.includes("VERSION:2.0"), `${label}: missing VERSION:2.0.`);
  check(logical.includes("METHOD:PUBLISH"), `${label}: missing METHOD:PUBLISH.`);
  check(logical.includes("REFRESH-INTERVAL;VALUE=DURATION:P1D"), `${label}: missing refresh interval.`);
  check(logical.includes("X-PUBLISHED-TTL:P1D"), `${label}: missing published TTL.`);

  const stack = [];
  for (const [index, line] of logical.entries()) {
    if (line.startsWith("BEGIN:")) stack.push(line.slice(6));
    if (line.startsWith("END:")) {
      const expected = stack.pop();
      check(expected === line.slice(4), `${label}: component mismatch at logical line ${index + 1}.`);
    }
  }
  check(stack.length === 0, `${label}: one or more components are unclosed.`);

  const eventCount = logical.filter((line) => line === "BEGIN:VEVENT").length;
  check(eventCount === feed.eventCount, `${label}: expected ${feed.eventCount} events; found ${eventCount}.`);
  check(logical.filter((line) => line === "END:VEVENT").length === eventCount, `${label}: VEVENT components are unbalanced.`);
  check(logical.filter((line) => line === "TRANSP:TRANSPARENT").length === eventCount, `${label}: every event must be transparent.`);
  const allDayStarts = logical.filter((line) => line.startsWith("DTSTART;VALUE=DATE:"));
  const allDayEnds = logical.filter((line) => line.startsWith("DTEND;VALUE=DATE:"));
  const timedStarts = logical.filter((line) => /^DTSTART:\d{8}T\d{6}Z$/.test(line));
  const timedEnds = logical.filter((line) => /^DTEND:\d{8}T\d{6}Z$/.test(line));
  check(allDayStarts.length === feed.allDayEventCount, `${label}: expected ${feed.allDayEventCount} all-day starts; found ${allDayStarts.length}.`);
  check(allDayEnds.length === feed.allDayEventCount, `${label}: expected ${feed.allDayEventCount} all-day ends; found ${allDayEnds.length}.`);
  check(timedStarts.length === feed.timedEventCount, `${label}: expected ${feed.timedEventCount} timed starts; found ${timedStarts.length}.`);
  check(timedEnds.length === feed.timedEventCount, `${label}: expected ${feed.timedEventCount} timed ends; found ${timedEnds.length}.`);
  check(allDayStarts.length + timedStarts.length === eventCount, `${label}: every event needs a start.`);
  check(!logical.some((line) => line.includes("TZID=")), `${label}: feed must store timed events in UTC rather than TZID-local form.`);

  const uids = logical.filter((line) => line.startsWith("UID:urn:uuid:"));
  check(uids.length === eventCount + 1, `${label}: calendar or event UID is missing.`);
  check(new Set(uids).size === uids.length, `${label}: duplicate UID found.`);

  allDayStarts.map((line) => line.slice(-8)).forEach((start, index) => {
    check(allDayEnds[index].slice(-8) > start, `${label}: all-day event ${index + 1} has a non-exclusive DTEND.`);
  });
  timedStarts.map((line) => line.slice(8)).forEach((start, index) => {
    check(timedEnds[index].slice(6) > start, `${label}: timed event ${index + 1} has an invalid DTEND.`);
  });

  const digest = createHash("sha256").update(text).digest("hex");
  check(digest === feed.sha256, `${label}: SHA-256 does not match manifest.`);
}

if (errors.length) {
  console.error(`Validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Validated ${manifest.feeds.length} feeds and ${manifest.feeds.reduce((sum, feed) => sum + feed.eventCount, 0)} total events.`);
  console.log("Structure, CRLF, folding, UIDs, all-day and timed UTC dates, refresh metadata, transparency, and hashes are valid.");
}
