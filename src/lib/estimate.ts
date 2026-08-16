import { categoryById } from "../data/catalog";
import type { EstimateDocument, EstimateLine, EstimateSettings, ValueSource } from "../types";

const n = (value: string | number | undefined, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const line = (group: EstimateLine["group"], name: string, unit: string, quantity: number, unitPrice: number, source: ValueSource): EstimateLine => ({ id: crypto.randomUUID(), group, name, unit, quantity: round(quantity), unitPrice: round(unitPrice), total: round(quantity * unitPrice), source });

export function buildEstimate(title: string, categoryId: EstimateDocument["categoryId"], sourceText: string, parameters: Record<string, string | number>, settings: EstimateSettings): EstimateDocument {
  const category = categoryById(categoryId);
  const area = n(parameters.area, 1);
  let lines: EstimateLine[] = [];
  const assumptions: string[] = [];

  if (categoryId === "roads") {
    const asphaltThickness = n(parameters.asphaltThickness, 5) / 100;
    const baseThickness = n(parameters.baseThickness, 15) / 100;
    const asphaltMass = area * asphaltThickness * 2.35 * 1.03;
    const crushedMass = area * baseThickness * 1.45 * 1.05;
    const asphaltPrice = n(parameters.asphaltPrice, 7000);
    const workPrice = n(parameters.workPrice, 0);
    const scope = String(parameters.workPriceScope ?? "Только работы");
    const typical = settings.priceMode === "typical";
    if (scope === "Всё с материалами" && workPrice) {
      lines = [
        line("Работы", "Комплекс дорожных работ по цене пользователя", "м²", area, workPrice, "user"),
        line("Материалы", "Щебень для основания (объём справочно)", "т", crushedMass, 0, "formula"),
        line("Материалы", "Асфальтобетонная смесь (объём справочно)", "т", asphaltMass, 0, "formula")
      ];
      assumptions.push("Цена за м² указана как полная: материалы и техника повторно не начисляются.");
    } else {
      lines = [
        line("Работы", "Разбивка и подготовка участка", "м²", area, workPrice ? workPrice * .12 : typical ? 170 : 0, workPrice ? "formula" : typical ? "typical" : "missing"),
        line("Работы", "Устройство щебёночного основания", "м²", area, workPrice ? workPrice * .28 : typical ? 390 : 0, workPrice ? "formula" : typical ? "typical" : "missing"),
        line("Работы", "Укладка асфальтобетонной смеси", "м²", area, workPrice ? workPrice * .6 : typical ? 840 : 0, workPrice ? "formula" : typical ? "typical" : "missing"),
        line("Материалы", "Щебень для основания", "т", crushedMass, parameters.crushedStonePrice ? n(parameters.crushedStonePrice) : typical ? 2100 : 0, parameters.crushedStonePrice ? "user" : typical ? "typical" : "missing"),
        line("Материалы", "Асфальтобетонная смесь", "т", asphaltMass, parameters.asphaltPrice ? asphaltPrice : typical ? 7000 : 0, parameters.asphaltPrice ? "user" : typical ? "typical" : "missing"),
        ...(scope === "Работы и техника" && workPrice ? [] : [line("Техника", "Комплект дорожной техники", "смена", Math.max(1, Math.ceil(area / 1000)), parameters.machineShiftPrice ? n(parameters.machineShiftPrice) : typical ? 68000 : 0, parameters.machineShiftPrice ? "user" : typical ? "typical" : "missing")]),
        line("Транспорт", "Доставка материалов", "рейс", Math.max(1, Math.ceil((asphaltMass + crushedMass) / 20)), parameters.deliveryPrice ? n(parameters.deliveryPrice) : typical ? 8500 : 0, parameters.deliveryPrice ? "user" : typical ? "typical" : "missing")
      ];
      if (scope === "Работы и техника" && workPrice) assumptions.push("Техника уже включена в цену работ и отдельно не начисляется.");
    }
    assumptions.push("Плотность асфальтобетона принята 2,35 т/м³, запас 3%.", "Насыпная плотность щебня принята 1,45 т/м³, запас 5%.");
  } else {
    const primaryQuantity = n(parameters.volume || parameters.length || parameters.weight || parameters.count || parameters.area, 1);
    const basePrice = parameters.workPrice ? n(parameters.workPrice) : settings.priceMode === "typical" ? (categoryId === "interiors" ? 3500 : 1200) : 0;
    lines = category.defaultItems.map((defaultItem, index) => {
      const isMaterial = defaultItem.group === "Материалы";
      const quantity = defaultItem.unit === "компл." || defaultItem.unit === "смена" ? Math.max(1, Math.ceil(primaryQuantity / 500)) : primaryQuantity;
      const unitPrice = basePrice * (isMaterial ? .58 : defaultItem.group === "Работы" ? .34 : .18) * (1 + index * .09);
      return line(defaultItem.group, defaultItem.name, defaultItem.unit, quantity, unitPrice, parameters.workPrice ? "formula" : settings.priceMode === "typical" ? "typical" : "missing");
    });
    assumptions.push(settings.priceMode === "typical" ? "Типовые количества и расценки требуют подтверждения перед передачей заказчику." : "Неизвестные цены оставлены нулевыми — заполните их в готовой смете.");
  }

  return { title, categoryId, createdAt: new Date().toISOString(), sourceText, parameters, settings, lines, assumptions };
}

export function totals(document: EstimateDocument) {
  const direct = document.lines.reduce((sum, item) => sum + item.total, 0);
  const overhead = direct * document.settings.overhead / 100;
  const profit = (direct + overhead) * document.settings.profit / 100;
  const withoutVat = direct + overhead + profit;
  const vat = withoutVat * document.settings.vat / 100;
  return { direct, overhead, profit, withoutVat, vat, grand: withoutVat + vat };
}

export function updateLine(item: EstimateLine, patch: Partial<EstimateLine>): EstimateLine {
  const next = { ...item, ...patch };
  return { ...next, total: round(next.quantity * next.unitPrice) };
}
