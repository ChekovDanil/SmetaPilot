import { catalog } from "../data/catalog";
import type { AnalysisResult, CategoryId } from "../types";

const numberBefore = (text: string, unit: RegExp): number | undefined => {
  const match = text.replace(/\s/g, "").match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${unit.source}`, "i"));
  return match ? Number(match[1].replace(",", ".")) : undefined;
};

export function analyzeLocally(text: string, forcedCategory?: CategoryId): AnalysisResult {
  const normalized = text.toLowerCase();
  const ranked = catalog.map(category => ({
    category,
    score: category.keywords.reduce((sum, keyword) => sum + (normalized.includes(keyword) ? 1 : 0), 0)
  })).sort((a, b) => b.score - a.score);
  const category = forcedCategory ? catalog.find(item => item.id === forcedCategory)! : ranked[0].category;
  const extracted: Record<string, string | number> = {};
  const area = numberBefore(normalized, /(?:м2|м²|кв\.?(?:м|метр))/);
  const volume = numberBefore(normalized, /(?:м3|м³|куб\.?(?:м|метр))/);
  const length = numberBefore(normalized, /(?:м\b|метр)/);
  const tons = numberBefore(normalized, /(?:т\b|тонн)/);
  if (area) extracted.area = area;
  if (volume) extracted.volume = volume;
  if (category.id === "utilities" && length) extracted.length = length;
  if (category.id === "steel" && tons) extracted.weight = tons;

  const perSquare = normalized.match(/(?:цена\s*(?:работ[ы]?|за\s*работу)?|работ[ы]?\s*(?:по|стоимость))[^\d]{0,20}(\d[\d\s]*(?:[.,]\d+)?)\s*(?:руб(?:лей|ля|ль)?|₽)\s*(?:\/|за)?\s*(?:м2|м²|кв\.?\s*м|квадратн(?:ый|ого)\s+метр(?:а)?)/i);
  if (perSquare) extracted.workPrice = Number(perSquare[1].replace(/\s/g, "").replace(",", "."));
  const asphalt = normalized.replace(/\s/g, "").match(/асфальт\D{0,20}(\d+(?:[.,]\d+)?)\s*(?:руб(?:лей|ля|ль)?|₽)?(?:\/|за)?(?:т|тонн(?:у|а|ы)?)/i);
  if (asphalt) extracted.asphaltPrice = Number(asphalt[1].replace(",", "."));
  const asphaltLayer = normalized.match(/(?:слой|асфальт)[^\d]{0,18}(\d+(?:[.,]\d+)?)\s*(?:см|мм)/i);
  if (asphaltLayer) extracted.asphaltThickness = Number(asphaltLayer[1].replace(",", ".")) / (asphaltLayer[0].includes("мм") ? 10 : 1);
  const title = category.name + (area ? ` — ${area.toLocaleString("ru-RU")} м²` : "");

  return {
    categoryId: category.id,
    projectName: title,
    confidence: Math.min(.96, .55 + ranked[0].score * .1),
    extracted,
    notes: ["Распознано локально — проверьте выделенные параметры"],
    usedAi: false
  };
}

export async function analyzeDescription(text: string, categoryId?: CategoryId): Promise<AnalysisResult> {
  const apiBase = String(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${apiBase}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, categoryId }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const ai = await response.json() as AnalysisResult;
    const local = analyzeLocally(text, categoryId ?? ai.categoryId);
    return { ...ai, extracted: { ...local.extracted, ...ai.extracted } };
  } catch {
    return analyzeLocally(text, categoryId);
  } finally {
    window.clearTimeout(timeout);
  }
}
