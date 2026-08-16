import { renderRobotsTxt } from '../data/seo.js';

export function GET() {
  return new Response(renderRobotsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
