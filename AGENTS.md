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
