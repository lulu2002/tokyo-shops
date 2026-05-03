const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ShopInput {
  id: number;
  name: string;
  lat: number;
  lng: number;
  subcategory: string;
  specialty: string;
  rating: number;
  openWindow: { open: string; close: string } | null; // null = unknown
  closed: boolean;
}

interface ClusterInput {
  name: string;
  shopIds: number[];
}

interface InterClusterWalk {
  from: string;
  to: string;
  minutes: number;
}

interface SuggestRequest {
  tripDate: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  shops: ShopInput[];
  clusters: ClusterInput[];
  interClusterWalk: InterClusterWalk[];
  extraConstraints?: string;
}

async function suggestWithClaude(req: SuggestRequest): Promise<unknown> {
  const shopList = req.shops
    .map((s) => {
      const status = s.closed
        ? "❌ 當天公休"
        : s.openWindow
          ? `✅ ${s.openWindow.open}～${s.openWindow.close}`
          : "⚠️ 營業時間不明";
      const dur = (s as unknown as Record<string, number>).duration || 20;
      return `- [ID:${s.id}] ${s.name}（${s.subcategory}${s.specialty ? "・" + s.specialty : ""}）★${s.rating || "?"} | ${status} | 預計停留 ${dur} 分鐘`;
    })
    .join("\n");

  const clusterInfo = req.clusters
    .map((c) => {
      const shops = c.shopIds
        .map((id) => req.shops.find((s) => s.id === id)?.name || "?")
        .join("、");
      return `📍 ${c.name}：${shops}`;
    })
    .join("\n");

  const walkInfo = req.interClusterWalk
    .map((w) => `${w.from} → ${w.to}：步行 ${w.minutes} 分`)
    .join("\n");

  const prompt = `你是東京旅遊行程助手。使用者選了以下專門店，請建議最佳造訪順序。

日期：${req.tripDate}（週${req.dayOfWeek}）
可用時間：${req.startTime} ～ ${req.endTime}

選擇的店家：
${shopList}

系統已分群（步行可達的店歸在一起）：
${clusterInfo}

區域間步行時間：
${walkInfo}

規則：
1. 建議區域的造訪順序，減少來回走動
2. 每間店的預計停留時間已標註（使用者設定），請據此計算時間是否足夠
3. 早關的店（closing time 早）應該優先安排
4. 晚開的店（opening time 晚）排在後面
5. 當天公休的店標記為移除，附上理由
6. 如果時間不夠逛完所有店，建議哪些可以捨棄（優先捨棄評分低或離群組遠的）
7. 用繁體中文回覆

${req.extraConstraints ? `\n使用者額外需求：\n${req.extraConstraints}\n\n請將以上需求納入考量。\n` : ''}
用以下 JSON 格式回覆（只回覆 JSON，不要其他文字）。
重要：id 和 shopId 欄位必須使用上面 [ID:數字] 中的數字，不要用店名。

{
  "suggestedOrder": [
    {
      "clusterName": "區域名稱",
      "reason": "為什麼先來這區的簡短理由",
      "shops": [
        { "id": 123, "priority": "high 或 normal", "note": "簡短提醒（如：15:00 關門，建議先去）或空字串" }
      ]
    }
  ],
  "warnings": [
    { "shopId": 123, "type": "closed 或 tight", "message": "原因" }
  ],
  "summary": "一段 50 字以內的整體建議摘要",
  "feasibility": "comfortable 或 tight 或 impossible"
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { error: "Failed to parse AI response" };

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { error: "Invalid JSON from AI" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify auth (any logged-in user can use this, not admin-only)
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // We just verify the token is valid, no admin check needed
    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SuggestRequest = await req.json();

    if (!body.shops || body.shops.length === 0) {
      return new Response(JSON.stringify({ error: "No shops provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const suggestion = await suggestWithClaude(body);

    return new Response(JSON.stringify(suggestion), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
