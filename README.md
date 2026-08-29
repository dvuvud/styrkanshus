# StyrkansHus website

Plain HTML/CSS/JS, no build step or framework. Deploys as a single
Cloudflare Worker: static files served straight from `frontend/`, plus one
small bit of server-side code for the admin login.

## Structure
```
worker.js            Worker entry point — serves frontend/ and handles /api/oauth-token
wrangler.toml         Worker config: name, and the [assets] binding pointing at frontend/
frontend/
  index.html         Hem
  om-oss.html         Om oss (board list reads board.json)
  evenemang.html      Kommande evenemang (reads events.json)
  sponsorer.html      Sponsorer (reads sponsors.json)
  stod-oss.html       Stödj oss
  kontakt.html        Kontakta oss (contact form)
  events.json         Upcoming events shown on the site — edit directly, or via /admin/
  board.json          Board members and their photos — edit directly, or via /admin/
  sponsors.json       Sponsor logos and links — edit directly, or via /admin/
  images/board/       Board member photos uploaded from /admin/
  images/sponsors/    Sponsor logos uploaded from /admin/
  robots.txt          Keeps /admin/ out of search engines
  css/style.css       All styling, colors/fonts as CSS variables at the top
  js/config.js        The one file you edit to activate the form and the admin login
  js/main.js          Nav toggle, contact form, events/board/sponsors rendering
  admin/              Hidden page (not linked anywhere) for editing all of the above in-browser
```
No `.github/workflows` — Cloudflare's own **Workers Builds** connects
straight to this GitHub repo (see below) and redeploys automatically on
every push, both the site and the admin login's server-side piece together.

## Contact form
Wired to Web3Forms and already active — the key lives in
`frontend/js/config.js` (`web3formsAccessKey`). If it's ever removed, the
form falls back to showing "Formuläret aktiveras inom kort" instead of
letting people submit it. Get a new key at https://web3forms.com/ if needed.

## Editing events, the board, and sponsors without touching code
Events, board members, and sponsors each live in their own JSON file
(`events.json`, `board.json`, `sponsors.json`), and the pages that show them
render straight from those files. You can edit them by hand, or use the
admin page so the board can do it themselves from a browser — including
uploading a new board photo or sponsor logo, which lands in
`images/board/` or `images/sponsors/` and is picked automatically.

Board and sponsor entries have a file picker for their photo/logo (5 MB
max) — it uploads as soon as you pick a file, and "Spara" then publishes
the JSON pointing at it. Replacing a photo uploads a new file rather than
overwriting the old one, so an unused image occasionally gets left behind;
harmless, just prune it from GitHub every so often if it bothers you.

`frontend/admin/index.html` isn't linked from the site's navigation, but
it's still a public URL once deployed (e.g. `https://<your-site>/admin/`) —
`robots.txt` just keeps search engines from indexing it. Access is controlled
by GitHub itself, not by hiding the URL: a person can log in with any GitHub
account, but saving only works if that account has write access to this
repository, so add anyone who should be able to publish changes as a
**collaborator on this repo** (Settings → Collaborators).

### One-time setup
A plain static-assets deployment can't run server-side code, so it can't do
the one step GitHub requires off-browser: exchanging the login code for an
access token (GitHub's token endpoint sends no CORS headers, so the browser
can't call it directly either). `worker.js` handles that one route
(`/api/oauth-token`) itself and serves every other request straight from
`frontend/` via the `ASSETS` binding in `wrangler.toml` — same-origin, no
CORS handling needed. This is why the project has to be a **Worker** (with
a static-assets binding), not the older Pages product — a project that's
static assets only, with no attached script, can't have variables/secrets
added to it, which is the error you ran into.

1. **Make sure the Worker has this repo's code**
   - The Worker name in the Cloudflare dashboard must match `name` in
     `wrangler.toml` (currently `styrkanshus`) — rename one or the other so
     they match exactly.
   - That Worker → **Settings → Builds → Connect** → pick this GitHub repo,
     production branch `main`, root directory = repository root (where
     `wrangler.toml` lives). Cloudflare will detect `wrangler.toml`
     automatically and use `wrangler deploy`.
   - Push to `main` (or trigger a manual deploy) once to confirm it builds.

2. **Create a GitHub OAuth App**
   - GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
   - Homepage URL: your Worker's URL (e.g. `https://styrkanshus.<your-subdomain>.workers.dev`,
     or your custom domain once you've added one under the Worker's
     **Settings → Domains & Routes**)
   - Authorization callback URL: the admin page's URL
     (e.g. `https://styrkanshus.<your-subdomain>.workers.dev/admin/`)
   - Save, then copy the **Client ID** and generate a **Client secret**.

3. **Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`** — these go in two
   different places, not both in the dashboard:
   - `GITHUB_CLIENT_ID` (from step 2) goes in **`wrangler.toml`**, in the
     `[vars]` block, committed to git. It's not secret — it's already
     public in the GitHub login URL. This matters because Workers Builds
     runs `wrangler deploy` on every push, which treats `wrangler.toml` as
     the *complete* set of plain variables — anything added only through
     the dashboard gets wiped on the next deploy. (If you added it via the
     dashboard and it kept disappearing, this is why.)
   - `GITHUB_CLIENT_SECRET` (from step 2) goes in the **Cloudflare
     dashboard**: Workers & Pages → this Worker → Settings → Variables and
     Secrets → add it with type **Secret**. Secrets aren't touched by
     future deploys, so this one really does only need setting once.

4. **Fill in `frontend/js/config.js`**
   ```js
   githubOAuthClientId: "<client id from step 2>",
   ```
   Same value as `GITHUB_CLIENT_ID` in `wrangler.toml` — both need it
   (the frontend uses it to build the GitHub login URL; the Worker uses it
   again server-side to complete the token exchange).

5. Add any board members who should be able to publish changes as
   collaborators on this GitHub repository.

That's it — visiting `/admin/` now offers a "Logga in med GitHub" button.
The client secret lives only in the Worker's encrypted variables, never in
this repo.
