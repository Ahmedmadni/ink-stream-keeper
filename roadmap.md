# Native application updates

## Interface polish
- [ ] Simplify the home page: primary sections first, recent notes and upcoming tasks, one compact summary.
- [ ] Unify branding, note/task cards, surface styling and connection/save indicators.
- [ ] Verify authenticated navigation, cards and layout on desktop and mobile; run regressions.
- [ ] Apply current interface to installed apps — requires new native releases, same blocker as below.

- [x] Audit Android and desktop UI loading and release scripts.
- [x] Run shared regression tests.
- [x] Add a standalone current-source release workflow for Android, Windows and both Mac architectures; syntax and target matrix validated.
- [x] Verify authenticated home navigation in the preview; all six section links visible, Settings opens, and mobile has no horizontal overflow.
- [ ] Deliver new installable releases — blocked by no local native build artifacts/toolchain and no connected release runner; production signing credentials are required for signed distribution.
- [x] Complete deep security review — findings reviewed and unsafe note preview sanitization addressed.