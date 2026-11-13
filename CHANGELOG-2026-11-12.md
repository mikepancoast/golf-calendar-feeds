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
