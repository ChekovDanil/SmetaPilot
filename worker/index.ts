const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://chekovdanil.github.io"
];

const categories = ["roads", "earthworks", "concrete", "masonry", "roofing", "facades", "interiors", "electrical", "plumbing", "hvac", "utilities", "landscaping", "demolition", "steel", "timber", "windows"] as const;

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[2],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(request: Request, data: unknown, status = 200) {
  return Response.json(data, { status, headers: { ...corsHeaders(request), "Cache-Control": "no-store" } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAiResponse(value: unknown): Record<string, unknown> | null {
  if (isRecord(value) && isRecord(value.response)) return value.response;
  if (isRecord(value) && typeof value.response === "string") {
    try { const parsed: unknown = JSON.parse(value.response); return isRecord(parsed) ? parsed : null; } catch { return null; }
  }
  return isRecord(value) ? value : null;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) return new Response(null, { status: 204, headers: corsHeaders(request) });
    if (url.pathname === "/api/health") return json(request, { ok: true, service: "SmetaPilot", ai: true });
    if (url.pathname !== "/api/analyze") {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return Response.redirect("https://chekovdanil.github.io/SmetaPilot/", 302);
    }
    if (request.method !== "POST") return json(request, { error: "Метод не поддерживается" }, 405);

    const contentLength = Number(request.headers.get("Content-Length") ?? 0);
    if (contentLength > 16_000) return json(request, { error: "Описание слишком большое" }, 413);

    try {
      const body: unknown = await request.json();
      if (!isRecord(body) || typeof body.text !== "string" || body.text.trim().length < 20 || body.text.length > 4000) {
        return json(request, { error: "Описание должно содержать от 20 до 4000 символов" }, 400);
      }
      const categoryHint = typeof body.categoryId === "string" && categories.includes(body.categoryId as typeof categories[number]) ? body.categoryId : "не задана";
      const prompt = `Разбери описание строительных работ для черновой коммерческой сметы. Ничего не рассчитывай и не придумывай цены. Извлеки только явно указанные пользователем числа и характеристики. Для extracted используй только стандартные ключи из JSON-схемы: площадь всегда area, объём volume, длина length, масса weight, количество count, цена работ workPrice, цена асфальта asphaltPrice, толщина асфальта в сантиметрах asphaltThickness, толщина основания в сантиметрах baseThickness. Выбери категорию из списка: ${categories.join(", ")}. Подсказка категории: ${categoryHint}. Описание: ${body.text}`;
      const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
        messages: [
          { role: "system", content: "Ты аккуратный русскоязычный ассистент-сметчик. Возвращай только проверяемые структурированные данные. Не выполняй арифметику и не назначай цены." },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "estimate_description",
            strict: true,
            schema: {
              type: "object",
              properties: {
                categoryId: { type: "string", enum: categories },
                projectName: { type: "string" },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                extracted: {
                  type: "object",
                  properties: {
                    area: { type: "number" }, volume: { type: "number" }, length: { type: "number" }, weight: { type: "number" }, count: { type: "number" },
                    workPrice: { type: "number" }, asphaltPrice: { type: "number" }, asphaltThickness: { type: "number" }, baseThickness: { type: "number" },
                    crushedStonePrice: { type: "number" }, machineShiftPrice: { type: "number" }, deliveryPrice: { type: "number" }, distance: { type: "number" },
                    concreteThickness: { type: "number" }, concretePrice: { type: "number" }, height: { type: "number" }, ceilingHeight: { type: "number" },
                    points: { type: "number" }, depth: { type: "number" }, capacity: { type: "number" }, insulation: { type: "number" }, wallThickness: { type: "number" },
                    material: { type: "string" }, system: { type: "string" }, soil: { type: "string" }, roofType: { type: "string" }, facadeType: { type: "string" },
                    finishClass: { type: "string" }, installType: { type: "string" }, pipe: { type: "string" }, networkType: { type: "string" },
                    covering: { type: "string" }, structure: { type: "string" }, complexity: { type: "string" }, profile: { type: "string" }
                  },
                  additionalProperties: false
                },
                notes: { type: "array", items: { type: "string" }, maxItems: 3 }
              },
              required: ["categoryId", "projectName", "confidence", "extracted", "notes"],
              additionalProperties: false
            }
          }
        },
        max_tokens: 700,
        temperature: 0.1
      });
      const parsed = normalizeAiResponse(result);
      if (!parsed || typeof parsed.categoryId !== "string" || !categories.includes(parsed.categoryId as typeof categories[number])) {
        console.warn(JSON.stringify({ event: "invalid_ai_response", path: url.pathname }));
        return json(request, { error: "Не удалось распознать описание" }, 422);
      }
      return json(request, { ...parsed, usedAi: true });
    } catch (error) {
      console.error(JSON.stringify({ event: "analyze_failed", message: error instanceof Error ? error.message : "unknown", path: url.pathname }));
      return json(request, { error: "Сервис анализа временно недоступен" }, 503);
    }
  }
} satisfies ExportedHandler<Env>;
