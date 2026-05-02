import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlaceResult {
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
  status: "new" | "duplicate" | "chain_exists";
  existingShopId?: number;
}

// Extract CID from Google Maps URL
function extractCid(url: string): string | null {
  const m = url.match(/[?&]cid=(\d+)/);
  return m ? m[1] : null;
}

// Haversine distance in meters
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Simple string similarity (Dice coefficient)
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

// Translate hours to Chinese
function translateHours(hours: string[]): string[] {
  const dayMap: Record<string, string> = {
    "月曜日": "週一", "火曜日": "週二", "水曜日": "週三", "木曜日": "週四",
    "金曜日": "週五", "土曜日": "週六", "日曜日": "週日",
  };
  return hours.map((h) => {
    for (const [jp, zh] of Object.entries(dayMap)) h = h.replace(jp, zh);
    h = h.replace("定休日", "公休").replace("24 時間営業", "24 小時營業");
    h = h.replace(/(\d+)時(\d+)分/g, "$1:$2");
    return h;
  });
}

async function searchPlace(query: string): Promise<PlaceResult | null> {
  const url = "https://places.googleapis.com/v1/places:searchText";
  const fields = [
    "places.displayName", "places.location", "places.formattedAddress",
    "places.rating", "places.userRatingCount", "places.websiteUri",
    "places.googleMapsUri", "places.regularOpeningHours", "places.photos",
    "places.primaryType",
  ].join(",");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": fields,
    },
    body: JSON.stringify({ textQuery: query, languageCode: "ja", maxResultCount: 1 }),
  });

  const data = await res.json();
  if (!data.places?.length) return null;

  const p = data.places[0];
  const loc = p.location || {};
  const hours = p.regularOpeningHours?.weekdayDescriptions || [];

  // Download up to 5 photos to Supabase Storage
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const photoUrls: string[] = [];
  const apiPhotos = p.photos || [];

  for (let i = 0; i < Math.min(5, apiPhotos.length); i++) {
    const photoName = apiPhotos[i].name;
    const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&maxHeightPx=600&key=${GOOGLE_API_KEY}`;
    try {
      const imgRes = await fetch(photoUrl);
      if (imgRes.ok) {
        const imgData = await imgRes.arrayBuffer();
        const filename = `import_${Date.now()}_${i}.jpg`;
        const { error } = await supabase.storage
          .from("shop-images")
          .upload(filename, imgData, { contentType: "image/jpeg" });
        if (!error) {
          const { data: urlData } = supabase.storage.from("shop-images").getPublicUrl(filename);
          photoUrls.push(urlData.publicUrl);
        }
      }
    } catch { /* skip failed photo */ }
  }

  return {
    name: p.displayName?.text || "",
    address: p.formattedAddress || "",
    lat: loc.latitude || 0,
    lng: loc.longitude || 0,
    rating: p.rating || 0,
    reviewCount: p.userRatingCount || 0,
    website: p.websiteUri || "",
    googleMapsUrl: p.googleMapsUri || "",
    hours: translateHours(hours),
    photos: photoUrls,
    primaryType: p.primaryType || "",
    status: "new",
  };
}

async function checkDuplicate(
  place: PlaceResult,
  existingShops: { id: number; name: string; lat: number; lng: number; google_maps_url: string }[],
): Promise<PlaceResult> {
  // 1. CID match
  const placeCid = extractCid(place.googleMapsUrl);
  if (placeCid) {
    for (const shop of existingShops) {
      const shopCid = extractCid(shop.google_maps_url);
      if (shopCid && shopCid === placeCid) {
        return { ...place, status: "duplicate", existingShopId: shop.id };
      }
    }
  }

  // 2. Name + distance match
  for (const shop of existingShops) {
    const nameSim = similarity(place.name, shop.name);
    const dist = haversine(place.lat, place.lng, shop.lat, shop.lng);
    if (nameSim > 0.8 && dist < 100) {
      return { ...place, status: "duplicate", existingShopId: shop.id };
    }
    // Chain detection: same name root but different location
    if (nameSim > 0.6 && dist > 500) {
      return { ...place, status: "chain_exists", existingShopId: shop.id };
    }
  }

  return place;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Verify admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: adminData } = await supabase
      .from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adminData) {
      return new Response(JSON.stringify({ error: "Not admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const urls: string[] = body.urls || [];

    if (urls.length === 0) {
      return new Response(JSON.stringify({ error: "No URLs provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing shops for duplicate check
    const { data: existingShops } = await supabase
      .from("shops")
      .select("id, name, lat, lng, google_maps_url");

    const results: PlaceResult[] = [];

    for (let url of urls) {
      // Resolve short URLs (maps.app.goo.gl)
      if (url.includes("goo.gl") || url.includes("maps.app")) {
        try {
          const redirectRes = await fetch(url, { redirect: "follow" });
          url = redirectRes.url;
        } catch { /* keep original */ }
      }

      // Parse URL to get search query
      let query = url;
      // Try to extract place name from URL
      const placeMatch = url.match(/\/place\/([^/@]+)/);
      if (placeMatch) {
        query = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
      } else {
        // Try CID-based URL - search by coordinates if available
        const coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (coordMatch) {
          query = `${coordMatch[1]},${coordMatch[2]}`;
        }
      }

      const place = await searchPlace(query);
      if (place) {
        const checked = await checkDuplicate(place, existingShops || []);
        results.push(checked);
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 200));
    }

    return new Response(JSON.stringify({ shops: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
