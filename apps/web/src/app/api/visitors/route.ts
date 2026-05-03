import { NextResponse } from 'next/server';

export async function GET() {
  const site = process.env.NEXT_PUBLIC_GOATCOUNTER_URL ?? 'https://zojo.goatcounter.com';
  try {
    const res = await fetch(`${site}/counter/%2F.json`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json({ count: null });
    const data = (await res.json()) as { count?: string; count_unique?: string };
    return NextResponse.json({ count: data.count, count_unique: data.count_unique });
  } catch {
    return NextResponse.json({ count: null });
  }
}
