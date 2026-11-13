import assert from "node:assert/strict";
import { renderCalendar } from "./ical.mjs";

const calendar = renderCalendar(
  {
    name: "Timed event test",
    description: "Synthetic validation fixture.",
    namespace: "3f45bd37-c721-4ee0-8e8d-74683060f0ed",
    generatedAt: "20261022T203039Z"
  },
  [
    {
      id: "synthetic-broadcast",
      summary: "Watch: Synthetic Golf Broadcast",
      startUtc: "2027-01-21T18:00:00Z",
      endUtc: "2027-01-21T21:00:00Z",
      description: "Test coverage window.",
      categories: ["SPORTS", "GOLF", "BROADCAST"],
      alarmMinutes: 15
    }
  ]
);

assert.match(calendar, /DTSTART:20270121T180000Z\r\n/);
assert.match(calendar, /DTEND:20270121T210000Z\r\n/);
assert.match(calendar, /BEGIN:VALARM\r\nTRIGGER:-PT15M\r\nACTION:DISPLAY\r\n/);
assert.doesNotMatch(calendar, /TZID=/);
for (const line of calendar.slice(0, -2).split("\r\n")) {
  assert.ok(Buffer.byteLength(line, "utf8") <= 75, `Line exceeds 75 octets: ${line}`);
}

console.log("Validated synthetic timed broadcast and reminder.");
