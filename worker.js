// Cloudflare Worker for cockpile.com
// Serves the static site, plus a tiny leaderboard API for COOM:
//   GET  /api/scores  -> { scores: [ {name, score, level, kills, at}, ... ] } (top 10)
//   POST /api/scores  <- { name, score, level, kills }
// Scores live in a KV namespace bound as SCORES. Until that binding exists the
// API answers 503 and the game falls back to a scoreboard kept on each device.

const KEY = 'coom-top';
const KEEP = 50;
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

async function scores(request, env) {
  if (!env.SCORES) return json({ error: 'leaderboard not set up yet' }, 503);
  let list = [];
  try { list = JSON.parse((await env.SCORES.get(KEY)) || '[]'); } catch (e) { list = []; }

  if (request.method === 'GET') return json({ scores: list.slice(0, 10) });

  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
    const name = String(body.name || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim().slice(0, 12) || 'ANON';
    const score = Math.floor(Number(body.score));
    const level = Math.floor(Number(body.level)) || 1;
    const kills = Math.floor(Number(body.kills)) || 0;
    // basic sanity limits (it's a joke game, not a bank)
    if (!Number.isFinite(score) || score < 0 || score > 5000000 || level < 1 || level > 500 || kills < 0 || kills > 20000) {
      return json({ error: 'nice try' }, 400);
    }
    list.push({ name, score, level, kills, at: Date.now() });
    list.sort((a, b) => b.score - a.score);
    list = list.slice(0, KEEP);
    await env.SCORES.put(KEY, JSON.stringify(list));
    const rank = list.findIndex(s => s.name === name && s.score === score) + 1;
    return json({ ok: true, rank, scores: list.slice(0, 10) });
  }

  return json({ error: 'method not allowed' }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/scores') return scores(request, env);
    return env.ASSETS.fetch(request);
  },
};
