import { NextRequest, NextResponse } from "next/server";
import FirecrawlApp from '@mendable/firecrawl-js';

function extractMetadataFromMarkdown(markdown: string) {
  const lines = markdown.split('\n').map((line) => line.trim()).filter(Boolean);
  const titleLine = lines.find((line) => line.startsWith('# '));
  const title = titleLine ? titleLine.replace(/^#\s+/, '') : 'Untitled';
  const description = lines.find((line) => !line.startsWith('#')) || '';
  return { title, description };
}

async function scrapeWithJina(url: string) {
  const readerUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`;
  const response = await fetch(readerUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; OpenLovable/1.0; +https://github.com/firecrawl/open-lovable)'
    },
    next: { revalidate: 3600 }
  });

  if (!response.ok) {
    throw new Error(`Jina Reader error: ${response.status}`);
  }

  const markdown = await response.text();
  const { title, description } = extractMetadataFromMarkdown(markdown);

  return {
    title,
    content: markdown,
    description,
    markdown,
    html: '',
    metadata: {
      title,
      description,
      sourceURL: url,
      statusCode: 200,
      scraper: 'jina-reader-fallback',
      timestamp: new Date().toISOString()
    },
    screenshot: `https://image.thum.io/get/width/1280/noanimate/${url}`,
    links: []
  };
}

export async function POST(request: NextRequest) {
  try {
    const { url, formats = ['markdown', 'html'], options = {} } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;

    if (!apiKey) {
      console.log('[scrape-website] FIRECRAWL_API_KEY missing, using Jina Reader fallback');
      const data = await scrapeWithJina(url);
      return NextResponse.json({ success: true, data });
    }

    const app = new FirecrawlApp({ apiKey });

    const scrapeResult = await app.scrape(url, {
      formats: formats,
      onlyMainContent: options.onlyMainContent !== false,
      waitFor: options.waitFor || 2000,
      timeout: options.timeout || 30000,
      ...options
    });

    const result = scrapeResult as any;
    if (result.success === false) {
      throw new Error(result.error || "Failed to scrape website");
    }

    const data = result.data || result;

    return NextResponse.json({
      success: true,
      data: {
        title: data?.metadata?.title || "Untitled",
        content: data?.markdown || data?.html || "",
        description: data?.metadata?.description || "",
        markdown: data?.markdown || "",
        html: data?.html || "",
        metadata: data?.metadata || {},
        screenshot: data?.screenshot || null,
        links: data?.links || [],
        raw: data
      }
    });

  } catch (error) {
    console.error("Error scraping website:", error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to scrape website",
      data: {
        title: "Error",
        content: "Unable to scrape website",
        description: "Error occurred while scraping",
        markdown: `# Error\n\n${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        html: `<h1>Error</h1><p>${error instanceof Error ? error.message : 'Unknown error occurred'}</p>`,
        metadata: {
          title: "Error",
          description: "Failed to scrape website",
          statusCode: 500
        }
      }
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
