import { NextResponse } from 'next/server';

// Preview-only comparison; never return the environment value or invoke a provider.
export const dynamic = 'force-dynamic';
export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') return new NextResponse(null, {status: 404});
  return NextResponse.json({matchesSharedPolicy: (process.env.OPENAI_MODEL || 'gpt-5.4-mini') === 'gpt-5.4-mini'}, {headers: {'Cache-Control':'no-store'}});
}
