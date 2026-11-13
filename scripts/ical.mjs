import { createHash } from "node:crypto";

export function escapeText(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

export function compactDate(value) {
  return value.replaceAll("-", "");
}

export function nextDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function compactUtc(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) {
    throw new Error(`Expected a UTC timestamp in YYYY-MM-DDTHH:MM:SSZ form; received ${value}.`);
  }
  return value.replaceAll("-", "").replaceAll(":", "");
}

export function uuidV5(name, namespace) {
  const namespaceBytes = Buffer.from(namespace.replaceAll("-", ""), "hex");
  const digest = createHash("sha1")
    .update(namespaceBytes)
    .update(Buffer.from(name, "utf8"))
    .digest()
    .subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function foldLine(line) {
  const segments = [];
  let current = "";
  let limit = 75;

  for (const character of line) {
    if (Buffer.byteLength(current + character, "utf8") > limit && current) {
      segments.push(current);
      current = character;
      limit = 74;
    } else {
      current += character;
    }
  }

  segments.push(current);
  return segments.join("\r\n ");
}

export function renderCalendar(calendar, events, options = {}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Michael Pancoast//Golf iCal Subscriptions//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `UID:urn:uuid:${calendar.namespace}`,
    `NAME:${escapeText(calendar.name)}`,
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
    `DESCRIPTION:${escapeText(calendar.description)}`,
    `X-WR-CALDESC:${escapeText(calendar.description)}`,
    `LAST-MODIFIED:${calendar.generatedAt}`,
    "REFRESH-INTERVAL;VALUE=DURATION:P1D",
    "X-PUBLISHED-TTL:P1D"
  ];

  if (options.subscriptionUrl) {
    lines.push(`SOURCE;VALUE=URI:${options.subscriptionUrl}`);
  }
  if (calendar.sourceUrl) {
    lines.push(`URL:${calendar.sourceUrl}`);
  }

  for (const event of events) {
    const lastModified = event.lastModified ?? calendar.generatedAt;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid ?? `urn:uuid:${uuidV5(event.id, calendar.namespace)}`}`,
      `DTSTAMP:${lastModified}`,
      `LAST-MODIFIED:${lastModified}`,
      `SEQUENCE:${event.sequence ?? 0}`
    );

    if (event.startUtc || event.endUtc) {
      if (!event.startUtc || !event.endUtc) {
        throw new Error(`Timed event ${event.id} must have both startUtc and endUtc.`);
      }
      lines.push(`DTSTART:${compactUtc(event.startUtc)}`, `DTEND:${compactUtc(event.endUtc)}`);
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${compactDate(event.start)}`,
        `DTEND;VALUE=DATE:${compactDate(nextDate(event.end))}`
      );
    }

    lines.push(`SUMMARY:${escapeText(event.summary)}`);

    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    if (event.categories?.length) {
      lines.push(`CATEGORIES:${event.categories.map(escapeText).join(",")}`);
    }

    lines.push(
      "CLASS:PUBLIC",
      `TRANSP:${event.transparency ?? "TRANSPARENT"}`,
      `STATUS:${event.status ?? "CONFIRMED"}`
    );

    if (Number.isInteger(event.alarmMinutes) && event.alarmMinutes > 0) {
      lines.push(
        "BEGIN:VALARM",
        `TRIGGER:-PT${event.alarmMinutes}M`,
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(event.alarmDescription ?? event.summary)}`,
        "END:VALARM"
      );
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
