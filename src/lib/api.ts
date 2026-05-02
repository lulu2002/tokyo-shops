import { supabase } from './supabase';
import type { Shop } from '../types/shop';

interface DbShop {
  id: number;
  name: string;
  subcategory: string;
  specialty: string;
  description: string;
  location: string;
  price: string;
  lat: number;
  lng: number;
  photo_url: string;
  photos: string[];
  slug: string;
  rating: number;
  review_count: number;
  address: string;
  website: string;
  google_maps_url: string;
  hours: string[];
  shop_categories: { categories: { id: number; slug: string; name: string; label: string; color: string } }[];
}

interface DbCategory {
  id: number;
  slug: string;
  name: string;
  label: string;
  color: string;
  sort_order: number;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
}

function mapShop(db: DbShop): Shop {
  return {
    id: db.id,
    name: db.name,
    category: db.shop_categories?.[0]?.categories?.name || '',
    categories: db.shop_categories?.map((sc) => sc.categories.name) || [],
    categoryColor: db.shop_categories?.[0]?.categories?.color || 'bg-gray-500',
    subcategory: db.subcategory,
    specialty: db.specialty,
    description: db.description,
    location: db.location,
    fromKuramae: '',
    price: db.price,
    lat: db.lat,
    lng: db.lng,
    photoUrl: db.photo_url,
    photos: db.photos?.filter(Boolean) || [],
    slug: db.slug,
    rating: db.rating,
    reviewCount: db.review_count,
    address: db.address,
    website: db.website,
    googleMapsUrl: db.google_maps_url,
    hours: db.hours,
  };
}

export async function fetchShops(): Promise<Shop[]> {
  const { data, error } = await supabase
    .from('shops')
    .select('*, shop_categories(categories(id, slug, name, label, color))')
    .order('id');

  if (error) throw error;
  return (data as DbShop[]).map(mapShop);
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order');

  if (error) throw error;
  return (data as DbCategory[]).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    label: c.label,
    color: c.color,
    sortOrder: c.sort_order,
  }));
}
