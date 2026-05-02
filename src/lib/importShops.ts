import { supabase } from './supabase';

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
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
  // AI classification (filled later)
  category?: string;
  subcategory?: string;
  specialty?: string;
  description?: string;
}

function translateHours(hours: string[]): string[] {
  const dayMap: Record<string, string> = {
    '月曜日': '週一', '火曜日': '週二', '水曜日': '週三', '木曜日': '週四',
    '金曜日': '週五', '土曜日': '週六', '日曜日': '週日',
  };
  return hours.map((h) => {
    for (const [jp, zh] of Object.entries(dayMap)) h = h.replace(jp, zh);
    h = h.replace('定休日', '公休').replace('24 時間営業', '24 小時營業');
    h = h.replace(/(\d+)時(\d+)分/g, '$1:$2');
    return h;
  });
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function similarity(a: string, b: string): number {
  const bigrams = (s: string) => {
    const result = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) result.add(s.substring(i, i + 2));
    return result;
  };
  const ba = bigrams(a.toLowerCase());
  const bb = bigrams(b.toLowerCase());
  let intersection = 0;
  for (const bg of ba) if (bb.has(bg)) intersection++;
  return (2 * intersection) / (ba.size + bb.size) || 0;
}

function extractCid(url: string): string | null {
  const m = url.match(/[?&]cid=(\d+)/);
  return m ? m[1] : null;
}

async function searchPlace(query: string): Promise<ImportPreview | null> {
  const fields = [
    'places.displayName', 'places.location', 'places.formattedAddress',
    'places.rating', 'places.userRatingCount', 'places.websiteUri',
    'places.googleMapsUri', 'places.regularOpeningHours', 'places.photos',
    'places.primaryType',
  ].join(',');

  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': fields,
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'ja', maxResultCount: 1 }),
  });

  const data = await res.json();
  if (!data.places?.length) return null;

  const p = data.places[0];
  const loc = p.location || {};
  const hours = p.regularOpeningHours?.weekdayDescriptions || [];

  // Upload photos to Supabase Storage
  const photoUrls: string[] = [];
  const apiPhotos = p.photos || [];
  for (let i = 0; i < Math.min(5, apiPhotos.length); i++) {
    const photoName = apiPhotos[i].name;
    const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&maxHeightPx=600&key=${GOOGLE_API_KEY}`;
    try {
      const imgRes = await fetch(photoUrl);
      if (imgRes.ok) {
        const blob = await imgRes.blob();
        const filename = `import_${Date.now()}_${i}.jpg`;
        const { error } = await supabase.storage
          .from('shop-images')
          .upload(filename, blob, { contentType: 'image/jpeg' });
        if (!error) {
          photoUrls.push(`${SUPABASE_URL}/storage/v1/object/public/shop-images/${filename}`);
        }
      }
    } catch { /* skip */ }
  }

  return {
    name: p.displayName?.text || '',
    address: p.formattedAddress || '',
    lat: loc.latitude || 0,
    lng: loc.longitude || 0,
    rating: p.rating || 0,
    reviewCount: p.userRatingCount || 0,
    website: p.websiteUri || '',
    googleMapsUrl: p.googleMapsUri || '',
    hours: translateHours(hours),
    photos: photoUrls,
    primaryType: p.primaryType || '',
    status: 'new',
  };
}

export async function resolveUrls(
  urls: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<ImportPreview[]> {
  // Get existing shops for duplicate check
  const { data: existingShops } = await supabase
    .from('shops')
    .select('id, name, lat, lng, google_maps_url');

  const results: ImportPreview[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i].trim();
    if (!url) continue;

    // Extract query from URL
    let query = url;
    const placeMatch = url.match(/\/place\/([^/@]+)/);
    if (placeMatch) {
      query = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    }

    const place = await searchPlace(query);
    if (place) {
      // Duplicate check
      const placeCid = extractCid(place.googleMapsUrl);
      let matched = false;

      if (placeCid && existingShops) {
        for (const shop of existingShops) {
          const shopCid = extractCid(shop.google_maps_url);
          if (shopCid && shopCid === placeCid) {
            place.status = 'duplicate';
            place.existingShopName = shop.name;
            matched = true;
            break;
          }
        }
      }

      if (!matched && existingShops) {
        for (const shop of existingShops) {
          const nameSim = similarity(place.name, shop.name);
          const dist = haversine(place.lat, place.lng, shop.lat, shop.lng);
          if (nameSim > 0.8 && dist < 100) {
            place.status = 'duplicate';
            place.existingShopName = shop.name;
            break;
          }
          if (nameSim > 0.6 && dist > 500) {
            place.status = 'chain_exists';
            place.existingShopName = shop.name;
            break;
          }
        }
      }

      results.push(place);
    }

    onProgress?.(i + 1, urls.length);
    // Rate limit
    await new Promise((r) => setTimeout(r, 200));
  }

  return results;
}

export async function saveImportedShops(
  shops: ImportPreview[],
  categoryMap: Map<string, number>, // category name -> id
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
