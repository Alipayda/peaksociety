export default function handler(req, res) {
  const config = `window.__CONFIG__ = ${JSON.stringify({
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  })};`;
  res.setHeader('Content-Type', 'application/javascript');
  res.status(200).send(config);
}
