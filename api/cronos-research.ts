export const config = {
  runtime: 'nodejs',
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-max-age': '86400',
};

const withTimeout = async (url: string, init: RequestInit = {}, timeoutMs = 4500) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export default async function handler(req: any, res: any) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) : {};
    const queryRaw = (req.query?.q || body.query || 'acoustic resonance cymatics frequency entrainment').toString().trim();
    const safeQuery = queryRaw.slice(0, 160);
    const encoded = encodeURIComponent(safeQuery);

    const [openAlexRes, europePmcRes, wikiEsRes, newsRssRes, starseedRes] = await Promise.allSettled([
      withTimeout(
        `https://api.openalex.org/works?search=${encoded}&per-page=5&sort=publication_year:desc`,
        { headers: { 'User-Agent': 'Cronos-Astraura/1.0 (https://omnifrecuencias.vercel.app)' } }
      ),
      withTimeout(
        `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encoded}&format=json&pageSize=5&sort=CITED%20desc`
      ),
      withTimeout(
        `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&utf8=&format=json&srlimit=4`
      ),
      withTimeout(
        `https://news.google.com/rss/search?q=${encoded}+frequency+OR+acoustic+OR+resonance&hl=es-419&gl=MX&ceid=MX:es-419`
      ),
      withTimeout('https://starseed-os.vercel.app/api/library/actualizaciones', {
        headers: { 'User-Agent': 'OmniFrecuencias-Cronos/1.0' },
      }),
    ]);

    const papers: { title: string; year?: number; source: string; url?: string; snippet?: string }[] = [];

    if (openAlexRes.status === 'fulfilled' && openAlexRes.value.ok) {
      const json = await openAlexRes.value.json().catch(() => null);
      for (const work of json?.results || []) {
        if (work?.title) {
          papers.push({
            title: String(work.title),
            year: typeof work.publication_year === 'number' ? work.publication_year : undefined,
            source: 'OpenAlex',
            url: work.doi ? `https://doi.org/${String(work.doi).replace(/^https?:\/\/doi\.org\//, '')}` : work.id,
          });
        }
      }
    }

    if (europePmcRes.status === 'fulfilled' && europePmcRes.value.ok) {
      const json = await europePmcRes.value.json().catch(() => null);
      for (const item of json?.resultList?.result || []) {
        if (item?.title) {
          papers.push({
            title: String(item.title),
            year: item.pubYear ? Number(item.pubYear) : undefined,
            source: 'EuropePMC',
            url: item.pmcid
              ? `https://europepmc.org/article/PMC/${item.pmcid}`
              : item.pmid
              ? `https://europepmc.org/article/MED/${item.pmid}`
              : undefined,
          });
        }
      }
    }

    const wiki: { title: string; snippet: string; url: string }[] = [];
    if (wikiEsRes.status === 'fulfilled' && wikiEsRes.value.ok) {
      const json = await wikiEsRes.value.json().catch(() => null);
      for (const w of json?.query?.search || []) {
        wiki.push({
          title: String(w.title || ''),
          snippet: String(w.snippet || '').replace(/<[^>]+>/g, ''),
          url: `https://es.wikipedia.org/wiki/${encodeURIComponent(String(w.title || '').replace(/\s+/g, '_'))}`,
        });
      }
    }

    const news: { title: string; link: string; pubDate?: string }[] = [];
    if (newsRssRes.status === 'fulfilled' && newsRssRes.value.ok) {
      const xml = await newsRssRes.value.text().catch(() => '');
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const itemXml of items.slice(0, 5)) {
        const title = (itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/)?.[1] ||
          itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1] ||
          '').trim();
        const link = (itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '').trim();
        const pubDate = (itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '').trim();
        if (title && link) news.push({ title, link, pubDate });
      }
    }

    let starseedUpdates: { total?: number; latestNames?: string[] } | null = null;
    if (starseedRes.status === 'fulfilled' && starseedRes.value.ok) {
      const json = await starseedRes.value.json().catch(() => null);
      const fuentes = Array.isArray(json?.fuentes) ? json.fuentes : [];
      starseedUpdates = {
        total: fuentes.length,
        latestNames: fuentes.slice(0, 6).map((f: any) => String(f.id || '')).filter(Boolean),
      };
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      query: safeQuery,
      fetchedAt: Date.now(),
      papers: papers.slice(0, 8),
      news,
      wiki,
      starseedUpdates,
    });
  } catch (err: any) {
    res.status(200).json({
      query: '',
      fetchedAt: Date.now(),
      papers: [],
      news: [],
      wiki: [],
      starseedUpdates: null,
      warning: err?.message || 'partial_research',
    });
  }
}
