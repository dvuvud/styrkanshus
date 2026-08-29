// Cloudflare Pages Function: exchanges a GitHub OAuth "code" for an access
// token. GitHub's token endpoint (github.com/login/oauth/access_token)
// doesn't send CORS headers, so the browser can't call it directly — this
// runs server-side instead. It's same-origin with the rest of the site
// (served at /api/oauth-token), so no CORS handling is needed here.
//
// Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET as environment variables
// on this Pages project: Cloudflare dashboard → Workers & Pages → this
// project → Settings → Environment variables. Add GITHUB_CLIENT_SECRET as
// a "Secret" (encrypted); GITHUB_CLIENT_ID can be plain text.

export async function onRequestPost({ request, env }) {
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
