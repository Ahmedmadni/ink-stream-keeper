# Native application updates

## Interface polish
- [x] Simplify the home page: primary sections first, recent notes and upcoming tasks, one compact summary.
- [x] Unify branding, note/task cards, surface styling and connection/save indicators; remove duplicated create actions and distinguish sending activity from authoritative draft saving.
- [x] Verify authenticated navigation, cards and layout at desktop, 547px and 393px widths; note/task details open, Settings works, offline indicator recovers, no horizontal overflow or browser errors. All 126 regression tests passed.
- [ ] Apply current interface to installed apps — requires new native releases, same blocker as below.

- [x] Audit Android and desktop UI loading and release scripts.
- [x] Run shared regression tests.
- [x] Add a standalone current-source release workflow for Android, Windows and both Mac architectures; syntax and target matrix validated.
- [x] Verify authenticated home navigation in the preview; all six section links visible, Settings opens, and mobile has no horizontal overflow.
- [ ] Deliver new installable releases — blocked by no local native build artifacts/toolchain and no connected release runner; production signing credentials are required for signed distribution.
- [x] Complete deep security review — findings reviewed and unsafe note preview sanitization addressed.
- [x] Complete generic titles, descriptions and social metadata for every content page without private item content.