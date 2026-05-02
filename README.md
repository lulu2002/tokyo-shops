# Tokyo Specialty Shops Map

152 間東京專門店的互動式地圖網站，涵蓋 98 個領域、10 大分類。

## Features

- **分類篩選** — 3C、文具、廚房道具、食品茶酒、時尚配件、手工藝、生活雜貨、運動戶外、書店藝文、米食文化
- **卡片 / 清單切換** — 卡片模式慢慢逛，清單模式快速掃
- **營業狀態** — 即時顯示東京時間的營業狀態，支援自訂時間查詢
- **附近店家** — 瀏覽器定位後依距離排序，顯示步行時間
- **店家詳情** — Google Places 照片、評分、營業時間、地址
- **Google Maps 連結** — 直接開啟店家的 Google Maps 頁面
- **RWD** — 手機、平板、桌面完整支援
- **偏好記憶** — 檢視模式、篩選狀態存在 localStorage

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS
- Google Places API (New) — 照片、評分、營業時間
- GitHub Pages + GitHub Actions 自動部署

## Development

```bash
npm install
npm run dev
```

## Data Source

店家資料來源為手動整理的東京專門店清單，經緯度與店家資訊透過 Google Places API 查詢取得。
