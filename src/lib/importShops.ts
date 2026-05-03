import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

export interface ImportPreview {
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  website: string;
  googleMapsUrl: string;
  hours: string[];
  photos: string[];
  primaryType: string;
  status: 'new' | 'duplicate' | 'chain_exists';
  existingShopName?: string;
  category?: string;
  subcategory?: string;
  specialty?: string;
  description?: string;
  visitDuration?: number;
}

export async function resolveUrls(
  urls: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<ImportPreview[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not logged in');

  onProgress?.(0, urls.length);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/import-shops`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ urls }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Import failed');
  }

  const data = await res.json();
  onProgress?.(urls.length, urls.length);
  return data.shops as ImportPreview[];
}

export async function classifyShops(
  shops: ImportPreview[],
): Promise<ImportPreview[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not logged in');

  const input = shops.map((s) => ({
    name: s.name,
    address: s.address,
    primaryType: s.primaryType,
  }));

  const res = await fetch(`${SUPABASE_URL}/functions/v1/classify-shops`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ shops: input }),
  });

  if (!res.ok) return shops;

  const data = await res.json();
  const classifications = data.classifications || [];

  return shops.map((shop) => {
    const cls = classifications.find(
      (c: { name: string }) => c.name === shop.name,
    );
    if (cls) {
      return {
        ...shop,
        category: cls.category,
        subcategory: cls.subcategory,
        specialty: cls.specialty,
        description: cls.description,
        visitDuration: cls.visitDuration || 30,
      };
    }
    return shop;
  });
}

export async function saveImportedShops(
  shops: ImportPreview[],
  categoryMap: Map<string, number>,
): Promise<void> {
  for (const shop of shops) {
    if (!shop.category) continue;

    const slug = shop.name.replace(/[^\w]/g, '_').substring(0, 40);

    const { data, error } = await supabase.from('shops').insert({
      name: shop.name,
      subcategory: shop.subcategory || '',
      specialty: shop.specialty || '',
      description: shop.description || '',
      location: shop.address?.match(/東京都(.+?区)/)?.[1] || '',
      price: '',
      lat: shop.lat,
      lng: shop.lng,
      photo_url: shop.photos[0] || '',
      photos: shop.photos,
      slug,
      rating: shop.rating,
      review_count: shop.reviewCount,
      address: shop.address,
      website: shop.website,
      google_maps_url: shop.googleMapsUrl,
      hours: shop.hours,
      visit_duration: shop.visitDuration || 30,
    }).select('id').single();

    if (error || !data) continue;

    const catId = categoryMap.get(shop.category);
    if (catId) {
      await supabase.from('shop_categories').insert({
        shop_id: data.id,
        category_id: catId,
      });
    }
  }
}
