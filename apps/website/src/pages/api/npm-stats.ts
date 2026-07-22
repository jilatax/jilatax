import type { APIRoute } from 'astro';
import { getNpmStats } from '@/lib/npm-stats';

export const prerender = false;

export const GET: APIRoute = async () => {
  const stats = await getNpmStats();

  return Response.json(stats, {
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
    },
  });
};
