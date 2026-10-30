import { notFound } from 'next/navigation';
import GuardQa from './guard-qa';
export const dynamic = 'force-dynamic';
export default function Page() {
  if (process.env.VERCEL_ENV !== 'preview') notFound();
  return <GuardQa/>;
}
