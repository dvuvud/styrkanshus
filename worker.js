// Cloudflare Worker entry point. Serves the static site from frontend/
// (via the `ASSETS` binding configured in wrangler.toml) and handles one
// route itself: POST /api/oauth-token, the server-side half of the admin
// page's GitHub login.
//
// GitHub's token endpoint (github.com/login/oauth/access_token) doesn't
// send CORS headers, so the browser can't call it directly — this runs
// server-side instead. It's same-origin with the rest of the site, so no
// CORS handling is needed here.
//
// Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET as variables on this
// Worker: Cloudflare dashboard → Workers & Pages → this Worker →
// Settings → Variables and Secrets. Add GITHUB_CLIENT_SECRET as a
// "Secret" (encrypted); GITHUB_CLIENT_ID can be plain text.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/oauth-token" && request.method === "POST") {
      return handleOAuthToken(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleOAuthToken(request, env) {
  let code;
  try {
    ({ code } = await request.json());
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!code) {
    return Response.json({ error: "missing_code" }, { status: 400 });
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const data = await tokenResponse.json();

  return Response.json(data);
}
