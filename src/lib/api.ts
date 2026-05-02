import { supabase } from './supabase';
import type { Shop } from '../types/shop';
import type { List } from '../types/list';

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

// ============================================
// Lists
// ============================================

export async function fetchMyLists(userId: string): Promise<List[]> {
  const { data, error } = await supabase
    .from('lists')
    .select('*, list_items(count)')
    .eq('user_id', userId)
    .order('sort_order');

  if (error) throw error;
  return (data || []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    userId: l.user_id as string,
    name: l.name as string,
    color: l.color as string,
    isPublic: l.is_public as boolean,
    sortOrder: l.sort_order as number,
    createdAt: l.created_at as string,
    itemCount: ((l.list_items as { count: number }[])?.[0]?.count) || 0,
  }));
}

export async function createList(userId: string, name: string, color = 'bg-rose-500'): Promise<List> {
  const { data, error } = await supabase
    .from('lists')
    .insert({ user_id: userId, name, color })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    color: data.color,
    isPublic: data.is_public,
    sortOrder: data.sort_order,
    createdAt: data.created_at,
    itemCount: 0,
  };
}

export async function updateList(listId: string, updates: { name?: string; is_public?: boolean }): Promise<void> {
  const { error } = await supabase.from('lists').update(updates).eq('id', listId);
  if (error) throw error;
}

export async function deleteList(listId: string): Promise<void> {
  const { error } = await supabase.from('lists').delete().eq('id', listId);
  if (error) throw error;
}

export async function fetchPublicLists(): Promise<List[]> {
  const { data, error } = await supabase
    .from('lists')
    .select('*, list_items(count)')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    userId: l.user_id as string,
    name: l.name as string,
    color: l.color as string,
    isPublic: true,
    sortOrder: l.sort_order as number,
    createdAt: l.created_at as string,
    itemCount: ((l.list_items as { count: number }[])?.[0]?.count) || 0,
  }));
}

export async function fetchListById(listId: string): Promise<List | null> {
  const { data, error } = await supabase
    .from('lists')
    .select('*, list_items(count)')
    .eq('id', listId)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    color: data.color,
    isPublic: data.is_public,
    sortOrder: data.sort_order,
    createdAt: data.created_at,
    itemCount: ((data.list_items as { count: number }[])?.[0]?.count) || 0,
  };
}

export async function fetchListShopIds(listId: string): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('list_items')
    .select('shop_id')
    .eq('list_id', listId);

  if (error) throw error;
  return new Set((data || []).map((r: { shop_id: number }) => r.shop_id));
}

export async function addToList(listId: string, shopId: number): Promise<void> {
  const { error } = await supabase
    .from('list_items')
    .insert({ list_id: listId, shop_id: shopId });
  if (error) throw error;
}

export async function removeFromList(listId: string, shopId: number): Promise<void> {
  const { error } = await supabase
    .from('list_items')
    .delete()
    .eq('list_id', listId)
    .eq('shop_id', shopId);
  if (error) throw error;
}

export async function fetchShopListMap(userId: string): Promise<Map<number, { listId: string; listName: string }[]>> {
  // First get user's list IDs, then get items for those lists
  const { data: lists } = await supabase
    .from('lists')
    .select('id, name')
    .eq('user_id', userId);

  if (!lists || lists.length === 0) return new Map();

  const listMap = new Map(lists.map((l) => [l.id as string, l.name as string]));
  const listIds = lists.map((l) => l.id);

  const { data, error } = await supabase
    .from('list_items')
    .select('shop_id, list_id')
    .in('list_id', listIds);

  if (error) throw error;
  const map = new Map<number, { listId: string; listName: string }[]>();
  for (const row of data || []) {
    const shopId = row.shop_id as number;
    const listId = row.list_id as string;
    const entry = { listId, listName: listMap.get(listId) || '' };
    if (!map.has(shopId)) map.set(shopId, []);
    map.get(shopId)!.push(entry);
  }
  return map;
}

// ============================================
// Categories
// ============================================

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
