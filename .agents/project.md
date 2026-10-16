# bottles (web)

cross-platform bookmarking platform — this repo is the web app + main server +
public api. the expo client lives in the sibling `../app` folder and is built
on the same public api. nothing client-specific exists on the server: every
feature is reachable through `/api/v1`.

> the app was renamed `bottle` → `bottles` (2026-10-15): every string a
> reader sees — titles, meta, prose, the breadcrumb root, the preview
> user agent — says `bottles`. code symbols deliberately keep the old
> shape: `Bottle*` components, `app/services/bottle.ts`, the
> `components/bottle/` directory are structure, not the name. the s3
> bucket value in `.env` is a real resource name and stays as configured.

## facts

- stack: nuxt 4.6 (ssr **off** — private tool app, session bootstraps
  client-side), typescript strict, drizzle orm over neon postgres (pooler →
  `prepare: false`), better-auth (email + password, session cookie cache),
  neon s3 storage via aws4fetch (**path-style** addressing — the endpoint
  certificate does not cover bucket subdomains), `@lucide/vue` icons.
- auth on the api: api key (`authorization: bearer bt_…` / `x-api-key`) or
  session cookie. an invalid key is a hard 401 — no silent session fallback.
  keys are stored as sha-256 + a 12-char lookup prefix; plaintext exists
  only in the creation response.
- the web app consumes its own api through `app/services/bottle.ts` — the
  same surface external clients get.
- routes: `/` is a public minimal landing (layout: false); the whole app
  lives under `/app` — `/app` (browser root), `/app/<folder path>` (catch-all),
  `/app/keys`, `/app/login`, `/app/docs` (the writing space). public pages
  live outside the app shell and render for strangers with no session:
  `/docs` (the api reference), `/privacy`, `/legal`. static routes beat
  the `[...path]` catch-all. `app/middleware/auth.global.ts` guards only
  `/app*`; `app/utils/routing.ts` `bottleRoute(path)` is the single mapper
  from filesystem paths to app routes.
- fixed chrome (bottom footers, top-left `bottle` brand, toasts, overlays)
  never lives inside a transitioned page: footers teleport to `body`
  (`BottleFooter`, keys page), the brand sits in the layout, modals/search
  already teleport. `filter`/`transform` in the blur+fade page transition
  would otherwise re-anchor `position: fixed` children mid-navigation.
- quick capture on browser pages (`useQuickCapture`): drop files anywhere
  (overlay shows target folder), paste files/images to upload, paste a url
  to save a link, paste any other text to save a note. disabled while the
  surface is open or search is up; pasting into a field stays with the
  field. every capture acknowledges instantly: a pending toast
  ('saving link.', 'uploading 42%.') that resolves in place to the
  outcome — actions never work silently.
- the browser surface (`BottleBrowser` + `BottleSurface`): new link,
  upload, new folder and the media view replace the list area on the
  same canvas — no dialogs. escape (or the header close, or saving)
  returns to the list; the swap animates blur+fade like page
  transitions; quick capture is off while a surface is up.
- the writing space (`/app/docs`, `BottleDocs` below the bookmarks
  toggle): tiptap (`StarterKit` + image node views + placeholder +
  tiptap-markdown). `@` opens the block menu (suggestion plugin wrapped
  in `Extension.create`; v3 `addNodeView` is singular; the two
  `@tiptap/core` copies under pnpm need `as unknown as Editor` casts at
  the VueRenderer boundaries). typed markdown converts through
  starter-kit input rules (`# ` at block start); pasted markdown needs
  `transformPastedText: true` — tiptap-markdown defaults it to false.
  pictures are media only (`bottle.upload` with no path — never a
  bookmark item): the node's own form for address/upload, and a paste
  uploads behind a local object-url preview that swaps to
  `/api/v1/media/:id/raw` when the bytes land (a non-rendered
  `uploadId` attr finds the node again; on failure the node is removed
  and the toast says so). autosave: 800ms debounce, a draft is created
  only on first change, flush on close/unmount — the flush hook
  registers before `useEditor` so it runs while the editor is alive.
  the title sits in the masthead above the hairline. escape closes
  chrome in order: menu → link popover → flush + close.
- component resolution: `nuxt.config.ts` registers `~/components` with
  `pathPrefix: false` — subdirectories are namespaces, not name
  fragments (`bottle/BottleBrowser` and `docs/BottleDocs` both resolve
  by filename as written).
- media: clicking a media row opens the media view on the surface
  (`BottleMediaViewer`) — image inline, copy url, download via
  `/api/v1/media/:id/download` (302 to a presigned url with an attachment
  disposition). rows never link straight to the object url. display
  sources (hover thumbnail, viewer image) go through
  `/api/v1/media/:id/raw` — same-origin bytes with
  `private, max-age=31536000, immutable`; presigned urls rotate on every
  listing fetch, which would defeat the browser cache, and uploads are
  immutable (new id per upload) so cache-forever is correct. presigned
  survives only where shareability matters: copy url + the download
  redirect. uploads report progress through xhr (ofetch cannot) — the
  upload form carries a hairline progress bar; bottle.upload takes an
  onProgress callback.
- hover previews (`BottleRow`): media images show a cursor-following
  thumbnail (direct style writes, no per-frame reactivity); link rows
  fetch `/api/v1/items/:id/preview` — server-side og:image resolution
  with a coalesced 6h in-memory cache (`preview.service.ts`). resolved
  link previews also persist to localStorage (`bottle:link-previews`,
  same 6h ttl, capped at 200 entries) so a reloaded hover resolves
  without refetching.
- link previews resolve through providers before the generic scrape
  (`preview.service.ts`): youtube (oembed), x (cdn.syndication
  tweet-result with a fixed public token), reddit (.json), tiktok
  (oembed) serve metadata endpoints that walled html never exposes to
  bots; instagram is login-walled everywhere and degrades to null (an
  honest limitation, not fixable without meta's api). the generic
  scrape cap is 1.5mb — youtube's og tags sit ~773kb into a 1.4mb page.
- untitled links take the page's own title at create time (og:title →
  twitter:title → `<title>`, entities decoded, hostname fallback) —
  same cached fetch as the hover preview.
- row arrows are controls, not decoration: ↗ anchors the link url,
  the folder chevron opens the folder. both carry hit targets.
- rows act inline (`BottleRow`): the pencil turns the row itself into the
  edit form (title, plus url for links — postel-normalized exactly like
  the add-link form), the trash turns it into a delete confirm. links
  carry a copy action (clipboard + toast) and media rows a download
  action (the attachment redirect); mutations emit `changed` and the
  browser refreshes. `UiModal` remains in the kit for the keys page, but
  the browser surfaces never use dialogs.
- path fields are folder pickers (`BottleFolderPicker`): focus lists
  the user's folders (`GET /api/v1/folders` — flat, path-ordered),
  typing filters, arrow keys + enter pick, and a fresh path offers
  itself as a create option (mkdir -p still applies). `UiInput` is
  composable for this — attrs and focus/blur/keydown land on the
  native input so comboboxes can be built on top of it.
- theme: `useTheme()` + `plugins/theme.client.ts` — one choice at
  `bottles:theme` in localStorage, applied as `html[data-theme]` before
  first paint on every boot; `main.css` carries the inverted token set
  (canvas and ink trade places, hairlines stay hairlines). the toggle
  sits fixed top-right in the app shell (moon/sun via the central icon
  registry); the `theme-color` meta follows the choice.
- the public pages (`PublicShell` bar + foot): `/docs` is the api
  reference — ten `ApiSection`s with a sticky side index whose
  scroll-spy rides the reader (`updateActiveSection` on a passive
  scroll listener, rAF-gated; at the document floor the last section
  owns the highlight, because the page can run out of scroll before
  the last head reaches the reading line; the same call at mount covers
  deep links). `/privacy` and `/legal` are plain prose. all
  `layout: false`, all cross-linked through the foot.
- env: `.env` (gitignored) with `DATABASE_URL`, `S3_*` (endpoint, key id,
  secret, region, bucket `bottle`), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.
  runtime config maps them in `nuxt.config.ts`; `NUXT_`-prefixed vars
  override in production.
- schema pushes: `pnpm drizzle-kit push` (drizzle.config.ts reads `.env`
  itself). do not edit `drizzle/` by hand.

## the filesystem model

- the doc store is separate from items by design: `doc` rows (`doc_` ids)
  hold opaque tiptap jsonb (`content`), size-capped at 300 kb serialized;
  the server derives plain-text previews by walking the tree (140 chars).
  the editor owns the schema — the api never interprets content.

- folders: materialized `path` per user (`/design/inspo`), unique index
  `(user_id, path)`, self-referencing `parent_id`.
- items are files inside folders: `type` = `link | note | media`, optional
  `url` / `note` / `media_id`.
- mkdir -p semantics everywhere: creating an item or folder at a path that
  does not exist creates the missing parents (fs.service.ensureFolderPath).
- rename/move rewrite whole subtrees with a single sql prefix update
  (folder.repository.updatePathPrefix).
- media rows reference s3 objects (`media/{userId}/{mediaId}/{filename}`);
  orphaned media (folder deletes, last item deleted) is collected by
  fs.service.collectMediaGarbage, best-effort s3 cleanup.
- presigned GET urls are 1h (X-Amz-Expires before aws4fetch signQuery).

## design system

- look: the home.png inspo — monochrome editorial list, white canvas,
  `#1a1a1a` lowercase helvetica-class rows, hairline `#eaeaea`, ↗ arrows
  flush right, tiny gray footer utilities at the bottom edge.
- mechanics: maya-design (curves: ease-out `(0.19,1,0.22,1)`, spring-bounce
  `(0.34,1.56,0.64,1)`; radii 4/8/12/20; layered shadows; 40px hit targets;
  modal enter 280ms / exit 150ms; toast bottom-right, solid ink chip)
  + userinterface-wiki timing laws (user actions < 300ms, stagger 45ms per
  item, no entrance animation on menus, exits faster than entrances).
- page transitions are blur + fade (enter 280ms blur 8px, leave 150ms
  blur 6px) — no translate, and all fixed chrome lives outside the
  transitioned page (see routing facts above).
- button width stability: `UiButton`'s label stays in flow with
  `visibility: hidden` while the absolute spinner overlays — swapping
  content (text → spinner) must never resize a button.
- motion is segmented on purpose: rows rise at 480ms with a 45ms cascade,
  hover 120ms, arrows translate 1px on hover, notes expand via
  grid-template-rows (no js measuring).
- conflicts resolved as: inspo governs look, maya governs mechanics, wiki
  governs timing. maya's audio feedback was deliberately not implemented
  (the inspo is silent; no sound was requested).
- icon rule: `app/constants/icons.ts` is the only icon import point —
  semantic names, never raw lucide imports in components. icon + text
  pairs get `line-height: 1` (the body's 1.7 inflates the text box and
  puts flex-centered icons off the x-height band); remaining
  glyph-specific mass (copy squares sit high, download tray sits low)
  is corrected per-instance with `UiIcon`'s `nudge` prop (translateY px,
  positive = down).

## conventions

- layers: route (validate → authorize → delegate) → service (rules) →
  repository (sql). no sql in routes, no rules in repositories.
- errors: `server/utils/errors.ts` helpers; user-facing text stays plain
  ("could not save the link." never stack traces).
- heavy data in `shallowRef` (directory payloads, key lists).
- ids: `fld_ / itm_ / med_ / key_` + base62. api tokens: `bt_` + base62 32.
- commits: lowercase, imperative, say the why in the body.
