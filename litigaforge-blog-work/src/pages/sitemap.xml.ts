import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL('https://litigaforge.com')).toString().replace(/\/$/, '');
  const posts = await getCollection('blog', ({ data }) => data.country === 'India');
  const urls = [
    `${base}/`,
    `${base}/blog`,
    ...posts.map((post) => `${base}/blog/${post.slug}`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')
  }\n</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};