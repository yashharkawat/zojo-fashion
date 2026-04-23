const FALLBACK = {
  instagramUrl: 'https://www.instagram.com/100days.fashion',
  youtubeUrl: 'https://www.youtube.com/@yashharkawat6147',
} as const;

export type SiteSettingsPublic = typeof FALLBACK;

export async function fetchSiteSettings(): Promise<SiteSettingsPublic> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return { ...FALLBACK };
  try {
    const res = await fetch(`${base}/settings/public`, { next: { revalidate: 300 } });
    if (!res.ok) return { ...FALLBACK };
    const body = (await res.json()) as { data: SiteSettingsPublic | null; error: unknown };
    if (body.error || !body.data) return { ...FALLBACK };
    const d = body.data;
    if (!d.instagramUrl || !d.youtubeUrl) return { ...FALLBACK };
    return d;
  } catch {
    return { ...FALLBACK };
  }
}
