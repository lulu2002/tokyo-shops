import { useState, useCallback } from 'react';
import type { ImportPreview } from '../lib/importShops';
import { resolveUrls, classifyShops, saveImportedShops } from '../lib/importShops';
import type { Category } from '../lib/api';

type Step = 'input' | 'loading' | 'filter' | 'classifying' | 'review' | 'saving';

interface Props {
  categories: Category[];
  categoryMap: Map<string, number>;
  onClose: () => void;
  onDone: () => void;
}

export function ImportModal({ categories, categoryMap, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>('input');
  const [urlText, setUrlText] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [previews, setPreviews] = useState<ImportPreview[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filterIdx, setFilterIdx] = useState(0);

  // Step 1: Parse URLs and resolve
  const handleResolve = useCallback(async () => {
    const urls = urlText.split('\n').map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) return;
    setStep('loading');
    const results = await resolveUrls(urls, (done, total) => setProgress({ done, total }));
    setPreviews(results);
    // Auto-select new shops
    const sel = new Set<number>();
    results.forEach((r, i) => { if (r.status === 'new') sel.add(i); });
    setSelected(sel);
    setFilterIdx(0);
    setStep('filter');
  }, [urlText]);

  // Step 2: Filter - swipe cards
  const currentPreview = previews[filterIdx];

  const runClassify = useCallback(async () => {
    setStep('classifying');
    const selectedShops = previews.filter((_, i) => selected.has(i));
    const classified = await classifyShops(selectedShops);
    // Map back to previews
    setPreviews((prev) => prev.map((p, i) => {
      if (!selected.has(i)) return p;
      const cls = classified.find((c) => c.name === p.name);
      return cls || p;
    }));
    setStep('review');
  }, [previews, selected]);

  const handleSwipe = (accept: boolean) => {
    if (accept) {
      setSelected((prev) => new Set(prev).add(filterIdx));
    } else {
      setSelected((prev) => { const n = new Set(prev); n.delete(filterIdx); return n; });
    }
    if (filterIdx < previews.length - 1) {
      setFilterIdx(filterIdx + 1);
    } else {
      runClassify();
    }
  };

  const handleSkipToReview = () => runClassify();

  // Step 3: Review - edit categories
  const updatePreview = (idx: number, updates: Partial<ImportPreview>) => {
    setPreviews((prev) => prev.map((p, i) => i === idx ? { ...p, ...updates } : p));
  };

  // Step 4: Save
  const handleSave = useCallback(async () => {
    setStep('saving');
    const toSave = previews.filter((_, i) => selected.has(i));
    await saveImportedShops(toSave, categoryMap);
    onDone();
  }, [previews, selected, categoryMap, onDone]);

  const selectedPreviews = previews.filter((_, i) => selected.has(i));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            {step === 'input' && '匯入店家'}
            {step === 'loading' && '解析中...'}
            {step === 'filter' && `篩選 (${filterIdx + 1}/${previews.length})`}
            {step === 'classifying' && 'AI 分類中...'}
            {step === 'review' && `確認匯入 (${selectedPreviews.length} 間)`}
            {step === 'saving' && '匯入中...'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* Step: Input */}
        {step === 'input' && (
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-500">每行貼一個 Google Maps 連結</p>
            <textarea
              value={urlText}
              onChange={(e) => setUrlText(e.target.value)}
              placeholder={'https://maps.google.com/...\nhttps://maps.google.com/...'}
              rows={8}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 resize-none font-mono"
            />
            <button
              onClick={handleResolve}
              disabled={!urlText.trim()}
              className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-40"
            >
              開始解析 ({urlText.split('\n').filter((u) => u.trim()).length} 個連結)
            </button>
          </div>
        )}

        {/* Step: Loading */}
        {step === 'loading' && (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-500">解析中 {progress.done}/{progress.total}</p>
          </div>
        )}

        {/* Step: Classifying */}
        {step === 'classifying' && (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-500">AI 分類中...</p>
            <p className="text-xs text-gray-400 mt-1">正在為 {selectedPreviews.length} 間店家建議分類</p>
          </div>
        )}

        {/* Step: Filter (swipe cards) */}
        {step === 'filter' && currentPreview && (
          <div className="p-4">
            {/* Card */}
            <div className="rounded-xl border border-gray-200 overflow-hidden mb-4">
              {currentPreview.photos[0] && (
                <img src={currentPreview.photos[0]} alt="" className="w-full aspect-[16/10] object-cover" />
              )}
              <div className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900">{currentPreview.name}</h4>
                  {currentPreview.rating > 0 && (
                    <span className="text-xs text-gray-400">★ {currentPreview.rating}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{currentPreview.address}</p>
                {currentPreview.status === 'duplicate' && (
                  <p className="text-xs text-red-500 mt-1">⚠️ 已存在：{currentPreview.existingShopName}</p>
                )}
                {currentPreview.status === 'chain_exists' && (
                  <p className="text-xs text-amber-500 mt-1">⚠️ 連鎖店已有：{currentPreview.existingShopName}</p>
                )}
              </div>
            </div>

            {/* Swipe buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => handleSwipe(false)}
                className="flex-1 py-3 rounded-lg bg-gray-100 text-gray-500 font-medium hover:bg-gray-200"
              >
                ← 跳過
              </button>
              <button
                onClick={() => handleSwipe(true)}
                className="flex-1 py-3 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600"
              >
                加入 →
              </button>
            </div>
            <button
              onClick={handleSkipToReview}
              className="w-full mt-2 py-2 text-sm text-gray-400 hover:text-gray-600"
            >
              跳過篩選，直接確認 →
            </button>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <div className="p-4 space-y-3">
            {selectedPreviews.length === 0 ? (
              <p className="text-center text-gray-400 py-8">沒有選擇任何店家</p>
            ) : (
              <>
                {selectedPreviews.map((shop, _i) => {
                  const realIdx = previews.indexOf(shop);
                  return (
                    <div key={realIdx} className="rounded-lg border border-gray-200 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        {shop.photos[0] && (
                          <img src={shop.photos[0]} alt="" className="w-12 h-12 rounded object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 text-sm truncate">{shop.name}</h4>
                          <p className="text-xs text-gray-400 truncate">{shop.address}</p>
                        </div>
                        <button
                          onClick={() => setSelected((prev) => { const n = new Set(prev); n.delete(realIdx); return n; })}
                          className="text-gray-300 hover:text-red-500 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={shop.category || ''}
                          onChange={(e) => updatePreview(realIdx, { category: e.target.value })}
                          className="text-xs px-2 py-1.5 rounded border border-gray-200"
                        >
                          <option value="">選擇分類</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.name}>{c.label}</option>
                          ))}
                        </select>
                        <input
                          value={shop.subcategory || ''}
                          onChange={(e) => updatePreview(realIdx, { subcategory: e.target.value })}
                          placeholder="子分類"
                          className="text-xs px-2 py-1.5 rounded border border-gray-200"
                        />
                        <input
                          value={shop.specialty || ''}
                          onChange={(e) => updatePreview(realIdx, { specialty: e.target.value })}
                          placeholder="專長"
                          className="text-xs px-2 py-1.5 rounded border border-gray-200"
                        />
                        <input
                          value={shop.description || ''}
                          onChange={(e) => updatePreview(realIdx, { description: e.target.value })}
                          placeholder="說明"
                          className="text-xs px-2 py-1.5 rounded border border-gray-200"
                        />
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            <button
              onClick={handleSave}
              disabled={selectedPreviews.length === 0 || selectedPreviews.some((s) => !s.category)}
              className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-40"
            >
              確認匯入 {selectedPreviews.length} 間
            </button>
          </div>
        )}

        {/* Step: Saving */}
        {step === 'saving' && (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-500">匯入中...</p>
          </div>
        )}
      </div>
    </div>
  );
}
