import { NextRequest, NextResponse } from 'next/server';

// Allowed domains — only proxy PDFs from trusted open-access sources
const ALLOWED_HOSTS = [
  'arxiv.org',
  'export.arxiv.org',
  'core.ac.uk',
  'europepmc.org',
  'ncbi.nlm.nih.gov',
  'pmc.ncbi.nlm.nih.gov',
  'semanticscholar.org',
  'pdfs.semanticscholar.org',
  'unpaywall.org',
  'biorxiv.org',
  'medrxiv.org',
  'psyarxiv.com',
  'osf.io',
  'eprints.soton.ac.uk',
  'ora.ox.ac.uk',
  'pure.rug.nl',
  'research.manchester.ac.uk',
];

function isAllowed(urlStr: string): boolean {
  try {
    const { hostname } = new URL(urlStr);
    return ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  const pdfUrl = req.nextUrl.searchParams.get('url');

  if (!pdfUrl || !isAllowed(pdfUrl)) {
    return new NextResponse('Forbidden or missing URL', { status: 403 });
  }

  try {
    const upstream = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Cognify/1.0; educational platform)',
        'Accept': 'application/pdf,*/*',
      },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return new NextResponse(`Upstream error: ${upstream.status}`, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') ?? 'application/pdf';
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        // Remove any X-Frame-Options from upstream so our iframe can display it
        'X-Frame-Options': 'SAMEORIGIN',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('PDF proxy error:', err);
    return new NextResponse('Failed to fetch PDF', { status: 502 });
  }
}
