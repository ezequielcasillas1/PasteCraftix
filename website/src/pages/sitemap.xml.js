import { renderSitemapXml } from '../data/seo.js';

export function GET() {
  return new Response(renderSitemapXml(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
