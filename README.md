# StyrkansHus website

Plain HTML/CSS/JS, no build step or framework. Deploys to Cloudflare Pages.

## Structure
```
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
  functions/api/
    oauth-token.js     Cloudflare Pages Function — the server-side half of admin login (see below)
```
No `.github/workflows` — Cloudflare Pages deploys by connecting straight to
this GitHub repo (see below), and redeploys automatically on every push.

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
Cloudflare Pages only serves static files by default, so it can't run the
server-side half of an OAuth login on its own — but it can run small
serverless **Functions** alongside the site, which is exactly enough for
the one step GitHub requires off-browser: exchanging the login code for an
access token. That's `frontend/functions/api/oauth-token.js` — it deploys
automatically as part of the same Pages build, reachable at
`/api/oauth-token` on your own domain (same-origin, no CORS needed).
Everything else (reading/writing the JSON files and uploaded images) talks
directly to api.github.com from the browser.

1. **Connect this repo to Cloudflare Pages**
   - Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git
   - Pick this repository and branch (`main`)
   - Build settings: framework preset **None**, build command **empty**,
     build output directory **`frontend`**
   - Deploy. You'll get a `*.pages.dev` URL; add a custom domain under the
     project's **Custom domains** tab once you're happy with it (easy since
     your DNS is on Cloudflare too).

2. **Create a GitHub OAuth App**
   - GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
   - Homepage URL: your site's URL (e.g. `https://styrkanshus.pages.dev`,
     or your custom domain once it's set up)
   - Authorization callback URL: the admin page's URL
     (e.g. `https://styrkanshus.pages.dev/admin/`)
   - Save, then copy the **Client ID** and generate a **Client secret**.

3. **Set environment variables on the Pages project**
   - Cloudflare dashboard → Workers & Pages → this project → Settings →
     Environment variables → add for the **Production** environment:
     - `GITHUB_CLIENT_ID` — plain text, from step 2
     - `GITHUB_CLIENT_SECRET` — click **Encrypt**, paste the client secret
       from step 2
   - Redeploy (or it'll pick these up on the next push) so the Function can
     read them.

4. **Fill in `frontend/js/config.js`**
   ```js
   githubOAuthClientId: "<client id from step 2>",
   ```
   This is the only place the client ID needs to be duplicated — it's not
   secret (it's already public in the GitHub login URL).

5. Add any board members who should be able to publish changes as
   collaborators on this GitHub repository.

That's it — visiting `/admin/` now offers a "Logga in med GitHub" button.
The client secret lives only in Cloudflare's encrypted environment
variables, never in this repo.
