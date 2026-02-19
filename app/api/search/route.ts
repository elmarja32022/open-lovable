import { NextRequest, NextResponse } from 'next/server';

function parseDuckDuckGoResults(html: string) {
  const results: Array<{ url: string; title: string; description: string; screenshot: string | null; markdown: string; }> = [];
  const itemRegex = /<div class="result__body">([\s\S]*?)<\/div>\s*<\/div>/g;

  let match;
  while ((match = itemRegex.exec(html)) !== null && results.length < 10) {
    const block = match[1];
    const linkMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const rawUrl = linkMatch[1];
    const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);
    const description = (snippetMatch?.[1] || snippetMatch?.[2] || '').replace(/<[^>]+>/g, '').trim();

    let url = rawUrl;
    try {
      const parsed = new URL(rawUrl, 'https://duckduckgo.com');
      if (parsed.searchParams.get('uddg')) {
        url = decodeURIComponent(parsed.searchParams.get('uddg') || rawUrl);
      }
    } catch {
      // keep raw URL
    }

    results.push({
      url,
      title: title || url,
      description,
      screenshot: `https://image.thum.io/get/width/1280/noanimate/${url}`,
      markdown: ''
    });
  }

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;

    if (apiKey) {
      const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          limit: 10,
          scrapeOptions: {
            formats: ['markdown', 'screenshot'],
            onlyMainContent: true,
          },
        }),
      });

      if (!searchResponse.ok) {
        throw new Error('Search failed');
      }

      const searchData = await searchResponse.json();

      const results = searchData.data?.map((result: any) => ({
        url: result.url,
        title: result.title || result.url,
        description: result.description || '',
        screenshot: result.screenshot || null,
        markdown: result.markdown || '',
      })) || [];

      return NextResponse.json({ results });
    }

    console.log('[search] FIRECRAWL_API_KEY missing, using DuckDuckGo fallback');
    const ddgResponse = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OpenLovable/1.0; +https://github.com/firecrawl/open-lovable)'
      }
    });

    if (!ddgResponse.ok) {
      throw new Error(`DuckDuckGo fallback failed with status ${ddgResponse.status}`);
    }

    const html = await ddgResponse.text();
    const results = parseDuckDuckGoResults(html);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
}
