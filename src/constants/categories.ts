export const CATEGORIES = [
  { key: '3C・音樂・遊戲', label: '3C・音樂', color: 'bg-blue-500' },
  { key: '文具・畫材・書寫', label: '文具・畫材', color: 'bg-amber-500' },
  { key: '廚房・料理道具', label: '廚房道具', color: 'bg-red-500' },
  { key: '食品・咖啡・茶酒', label: '食品・茶酒', color: 'bg-green-500' },
  { key: '時尚・配件', label: '時尚配件', color: 'bg-pink-500' },
  { key: '手工藝・傳統工藝', label: '手工藝', color: 'bg-purple-500' },
  { key: '生活雜貨・家居', label: '生活雜貨', color: 'bg-cyan-500' },
  { key: '運動・戶外', label: '運動戶外', color: 'bg-orange-500' },
  { key: '書店・藝文・旅行', label: '書店藝文', color: 'bg-indigo-500' },
  { key: '米食文化', label: '米食文化', color: 'bg-yellow-600' },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]['key'];
