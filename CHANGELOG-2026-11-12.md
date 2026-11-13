# Calendar update — November 12, 2026

Implemented and validated locally; publication still requires authenticated upload. The daily automation was updated.

One all-day entry per approved event, enriched with viewing information when published. Existing subscription address is preserved. Senior, women’s/mixed and Mid-Amateur events are excluded from personal feeds. Historical standalone alternatives are unchanged in scope.

## Changed files

- [README.md](README.md)
- [AUTOMATION.md](AUTOMATION.md)
- [PUBLISHING.md](PUBLISHING.md)
- [.github/workflows/pages.yml](.github/workflows/pages.yml)
- [package.json](package.json)
- [scripts/build.mjs](scripts/build.mjs)
- [scripts/ical.mjs](scripts/ical.mjs)
- [scripts/subscription.mjs](scripts/subscription.mjs)
- [scripts/test-subscription.mjs](scripts/test-subscription.mjs)
- [sources/amateur-golf-2027-2028.json](sources/amateur-golf-2027-2028.json)
- [sources/subscription-state-golf-broadcasts.json](sources/subscription-state-golf-broadcasts.json)
- [sources/subscription-state-golf-2027-pga-dp-world.json](sources/subscription-state-golf-2027-pga-dp-world.json)
- [dist/amateur-golf-2027-2028.ics](dist/amateur-golf-2027-2028.ics)
- [dist/golf-broadcasts.ics](dist/golf-broadcasts.ics)
- [dist/golf-2027-pga-dp-world.ics](dist/golf-2027-pga-dp-world.ics)
- [dist/index.html](dist/index.html)
- [dist/manifest.json](dist/manifest.json)

This change record is also newly created.

## New schedule evidence

- [Eisenhower Trophy: October 6–9, 2027](https://igfgolf.org/world-amateur-team-championships/morocco-2027)
- [Men’s Olympic golf: July 19–22, 2028](https://igfgolf.org/)

## Validation

Calendar structure, hashes, stable event identity when viewing is added, repeat-build revision stability, corrected event names with explicit tournament matching, and exclusion of unwanted categories passed.

## Corrected timed-viewing behavior

Michael confirmed that placeholders should become actual timed viewing blocks. The earlier all-day-description implementation is superseded. The first confirmed window inherits the placeholder UID; later windows receive stable identities. Eligible broadcasts are active again. Previously published migration cancellations are archived. The revised feed contains 75 all-day placeholders, 42 timed entries and zero cancelled entries. Existing TGL/Skins duration estimates remain explicitly labeled.

Validation passed for all-day-to-timed identity, multiple windows, cancellation recovery, stable repeated generation, corrected times/names and exclusions, plus standard calendar/timed-event validation. Daily automation instructions were updated. Upload remains pending until GitHub authentication succeeds or Push origin is used in Desktop.

Files changed for this correction:

- [Subscription builder](scripts/subscription.mjs)
- [Subscription tests](scripts/test-subscription.mjs)
- [Broadcast state](sources/subscription-state-golf-broadcasts.json)
- [Combined state](sources/subscription-state-golf-2027-pga-dp-world.json)
- [Broadcast feed](dist/golf-broadcasts.ics)
- [Combined feed](dist/golf-2027-pga-dp-world.ics)
- [Subscription page](dist/index.html)
- [Manifest](dist/manifest.json)
- [Local README](README.md)
- [Local automation instructions](AUTOMATION.md)
- [Local publication record](PUBLISHING.md)
- This change record.

## November 13: ESPN+ access correction

Exclude ESPN+-only coverage, retain ESPN/ESPN2 television and other simulcast platforms, and keep all-day placeholders if no accessible window is confirmed. Austin Championship now uses Golf Channel's 1–4 p.m. Central TV window, not ESPN+'s earlier streaming start. Source evidence is retained. Tests and calendar validation passed. Automation updated; publication pending.

Affected files: [builder](scripts/subscription.mjs), [tests](scripts/test-subscription.mjs), [broadcast state](sources/subscription-state-golf-broadcasts.json), [combined state](sources/subscription-state-golf-2027-pga-dp-world.json), [broadcast feed](dist/golf-broadcasts.ics), [combined feed](dist/golf-2027-pga-dp-world.ics), [index](dist/index.html), [manifest](dist/manifest.json), [README](README.md), [automation instructions](AUTOMATION.md), [publishing status](PUBLISHING.md), and this change record.
