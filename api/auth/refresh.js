export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'missing refresh_token' });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token,
      client_id:     '977999849446-j8u796jl68jk0hac49v26oisqs25160h.apps.googleusercontent.com',
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  });

  const data = await tokenRes.json();
  if (data.error) return res.status(400).json({ error: data.error });

  return res.json({ access_token: data.access_token });
}