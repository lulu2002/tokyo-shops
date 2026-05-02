export const CATEGORIES = [
  { id: '3c', key: '3C・音樂・遊戲', label: '3C・音樂', color: 'bg-blue-500' },
  { id: 'stationery', key: '文具・畫材・書寫', label: '文具・畫材', color: 'bg-amber-500' },
  { id: 'kitchen', key: '廚房・料理道具', label: '廚房道具', color: 'bg-red-500' },
  { id: 'food', key: '食品・咖啡・茶酒', label: '食品・茶酒', color: 'bg-green-500' },
  { id: 'fashion', key: '時尚・配件', label: '時尚配件', color: 'bg-pink-500' },
  { id: 'craft', key: '手工藝・傳統工藝', label: '手工藝', color: 'bg-purple-500' },
  { id: 'lifestyle', key: '生活雜貨・家居', label: '生活雜貨', color: 'bg-cyan-500' },
  { id: 'sports', key: '運動・戶外', label: '運動戶外', color: 'bg-orange-500' },
  { id: 'books', key: '書店・藝文・旅行', label: '書店藝文', color: 'bg-indigo-500' },
  { id: 'rice', key: '米食文化', label: '米食文化', color: 'bg-yellow-600' },
  { id: 'eva', key: 'Eva 想逛', label: 'Eva 想逛', color: 'bg-rose-500' },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]['key'];

export function getCategoryById(id: string) {
  return CATEGORIES.find((c) => c.id === id);
}

export function getCategoryByKey(key: string) {
  return CATEGORIES.find((c) => c.key === key);
}
