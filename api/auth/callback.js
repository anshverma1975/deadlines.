// api/auth/callback.js
// Vercel serverless function — receives Google OAuth code, exchanges it for
// a token, then redirects back to the Electron app via deadlines:// protocol

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`deadlines://auth?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.status(400).send('Missing code');
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     '977999849446-j8u796jl68jk0hac49v26oisqs25160h.apps.googleusercontent.com',
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  'https://deadlines-ruby.vercel.app/api/auth/callback',
        grant_type:    'authorization_code',
      }),
    });

    const data = await tokenRes.json();

    if (data.error) {
      return res.redirect(`deadlines://auth?error=${encodeURIComponent(data.error)}`);
    }

    // Send token back to Electron via custom protocol
    // access_token + refresh_token both passed so app can refresh silently
    const params = new URLSearchParams({
      access_token:  data.access_token,
      refresh_token: data.refresh_token || '',
      expires_in:    data.expires_in || 3600,
    });

    return res.redirect(`deadlines://auth?${params}`);

  } catch (err) {
    console.error('Token exchange error:', err);
    return res.redirect(`deadlines://auth?error=server_error`);
  }
}
