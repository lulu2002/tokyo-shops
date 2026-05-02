import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShopInput {
  name: string;
  address: string;
  primaryType: string;
}

interface Classification {
  name: string;
  category: string;
  subcategory: string;
  specialty: string;
  description: string;
}

async function classifyWithClaude(shops: ShopInput[], categories: string[]): Promise<Classification[]> {
  const shopList = shops.map((s, i) => `${i + 1}. ${s.name} | ${s.address} | Google type: ${s.primaryType}`).join("\n");

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
      messages: [{
        role: "user",
        content: `你是東京旅遊專門店分類助手。請為以下店家分類。

可用的分類（只能選這些）：
${categories.map((c) => `- ${c}`).join("\n")}

店家列表：
${shopList}

請用 JSON array 回覆，每個元素包含：
- name: 店名（原樣）
- category: 從上面的分類中選一個最適合的
- subcategory: 更細的子分類（繁體中文，例如「包丁/刃物」「自作鍵盤」）
- specialty: 這間店的專長（繁體中文，10字以內，例如「手工包丁」「精釀啤酒」）
- description: 一句話說明為什麼特別（繁體中文，30字以內）

只回覆 JSON array，不要其他文字。`,
      }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
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
    const shops: ShopInput[] = body.shops || [];

    if (shops.length === 0) {
      return new Response(JSON.stringify({ error: "No shops" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch categories from DB
    const { data: catData } = await supabase
      .from("categories")
      .select("name")
      .order("sort_order");
    const categories = (catData || []).map((c: { name: string }) => c.name);

    const classifications = await classifyWithClaude(shops, categories);

    return new Response(JSON.stringify({ classifications }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
