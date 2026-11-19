export const config = {
  runtime: 'nodejs',
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-max-age': '86400',
};

const extractJson = (raw: string): any | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

export default async function handler(req: any, res: any) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const customOpenRouterKey = typeof body.openRouterKey === 'string' ? body.openRouterKey.trim() : '';
    const customGeminiKey = typeof body.geminiKey === 'string' ? body.geminiKey.trim() : '';
    const customGroqKey = typeof body.groqKey === 'string' ? body.groqKey.trim() : '';

    // 1. Try OpenRouter (:free models only on shared key)
    const openRouterKey = customOpenRouterKey || process.env.OPENROUTER_SHARED_KEY || process.env.OPENROUTER_API_KEY || '';
    if (openRouterKey) {
      try {
        const model = body.preferredModel && String(body.preferredModel).endsWith(':free')
          ? String(body.preferredModel)
          : 'openrouter/free';
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openRouterKey}`,
            'HTTP-Referer': 'https://omnifrecuencias.vercel.app',
            'X-Title': 'Omni-Frecuencias Cronos Astraura',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.55,
            max_tokens: 1800,
          }),
        });
        if (r.ok) {
          const data = await r.json();
          const content = data?.choices?.[0]?.message?.content || '';
          const parsed = extractJson(content);
          if (parsed || content) {
            res.status(200).json({
              ok: true,
              provider: 'openrouter-free',
              model: data?.model || model,
              parsed,
              rawText: content,
            });
            return;
          }
        }
      } catch {
        // fallback to next lane
      }
    }

    // 2. Try Groq API if configured
    const groqKey = customGroqKey || process.env.GROQ_API_KEY || '';
    if (groqKey) {
      try {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.5,
            max_tokens: 1800,
          }),
        });
        if (r.ok) {
          const data = await r.json();
          const content = data?.choices?.[0]?.message?.content || '';
          const parsed = extractJson(content);
          if (parsed || content) {
            res.status(200).json({
              ok: true,
              provider: 'groq',
              model: 'llama-3.3-70b-versatile',
              parsed,
              rawText: content,
            });
            return;
          }
        }
      } catch {
        // fallback to Gemini
      }
    }

    // 3. Try Gemini API if configured
    const geminiKey = customGeminiKey || process.env.GEMINI_API_KEY || '';
    if (geminiKey) {
      try {
        const combinedPrompt = messages.map((m: any) => `[${m.role}]: ${m.content}`).join('\n\n');
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: combinedPrompt }] }],
              generationConfig: { temperature: 0.5, responseMimeType: 'application/json' },
            }),
          }
        );
        if (r.ok) {
          const data = await r.json();
          const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const parsed = extractJson(content);
          if (parsed || content) {
            res.status(200).json({
              ok: true,
              provider: 'gemini',
              model: 'gemini-2.0-flash',
              parsed,
              rawText: content,
            });
            return;
          }
        }
      } catch {
        // fallback
      }
    }

    res.status(200).json({
      ok: false,
      fallbackRequired: true,
      reason: 'no_server_llm_key_configured',
    });
  } catch (err: any) {
    res.status(200).json({
      ok: false,
      fallbackRequired: true,
      reason: err?.message || 'cronos_chat_error',
    });
  }
}
