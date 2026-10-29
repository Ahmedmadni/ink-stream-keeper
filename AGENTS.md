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
