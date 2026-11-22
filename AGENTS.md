<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Mobile: Capacitor ships a local SPA bundle (`build:native` promotes TanStack Start's `_shell.html` to `index.html`). Keep `server.url` unset so installed builds cannot silently load an older published UI. Remote-only features must call explicit HTTPS endpoints; native APIs load lazily behind `isNative()`.
- Desktop: Electron packages the same locally built SPA; publishing never updates an installed bundle. Use the standalone native-apps workflow to rebuild Android, Windows and both Mac architectures from one source revision, and require packaged desktop smoke checks before delivering archives so releases cannot silently carry stale UI.
- Shared interface: use BrandMark for the in-app identity and keep its paths aligned with public/icon.svg; ConnectionStatus reports network activity, while the note editor's autosave status remains authoritative for saved drafts.
- Page metadata: use pageHead for generic leaf-page metadata without private item content, so titles and social descriptions remain complete without exposing user data.
- Writing workspace: use ToolButton for labelled icon controls and a compact AppShell rail on note-detail pages; keep page previews collapsible and in document flow so they never cover the paper.
- Ink cursor: bundle the pen cursor through CSS with its hotspot at the nib so web and local native bundles share accurate pointer feedback without remote assets.
