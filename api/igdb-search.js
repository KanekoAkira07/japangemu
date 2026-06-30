// api/igdb-search.js
// Función de servidor (Vercel Function) que consulta IGDB de forma segura.
// El Client Secret nunca llega al navegador del usuario — solo vive aquí.

const IGDB_CLIENT_ID = 'dx3c0xf70g5akuwc5bzdfulcajh4za';
const IGDB_CLIENT_SECRET = 'ymwmq78s9khjv5l8518m4bhtgc8q0k';

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${IGDB_CLIENT_ID}&client_secret=${IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  // Permitir llamadas desde cualquier origen (tu propia web)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Escribe al menos 2 caracteres' });
  }

  try {
    const token = await getToken();

    const body = `search "${q}"; fields id,name,platforms.name,cover.url,first_release_date,category; where category = (0,4,8,9); limit 15;`;

    const igdbRes = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': IGDB_CLIENT_ID,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body
    });

    const games = await igdbRes.json();

    const results = (Array.isArray(games) ? games : [])
      .filter(g => g.name)
      .map(g => ({
        id: 'igdb:' + g.id,
        name: g.name,
        platform: g.platforms?.[0]?.name || 'Desconocida',
        type: 'game',
        year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
        img: g.cover?.url ? g.cover.url.replace('t_thumb', 't_cover_big').replace('//', 'https://') : null
      }));

    return res.status(200).json({ results });

  } catch (err) {
    console.error('IGDB error:', err);
    return res.status(500).json({ error: 'Error al consultar IGDB', results: [] });
  }
}
