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
    lines = [
      line("Работы", "Разбивка и подготовка участка", "м²", area, workPrice ? workPrice * .12 : 170, workPrice ? "formula" : "typical"),
      line("Работы", "Устройство щебёночного основания", "м²", area, workPrice ? workPrice * .28 : 390, workPrice ? "formula" : "typical"),
      line("Работы", "Укладка асфальтобетонной смеси", "м²", area, workPrice ? workPrice * .6 : 840, workPrice ? "formula" : "typical"),
      line("Материалы", "Щебень для основания", "т", crushedMass, n(parameters.crushedStonePrice, 2100), parameters.crushedStonePrice ? "user" : "typical"),
      line("Материалы", "Асфальтобетонная смесь", "т", asphaltMass, asphaltPrice, parameters.asphaltPrice ? "user" : "typical"),
      line("Техника", "Комплект дорожной техники", "смена", Math.max(1, Math.ceil(area / 1000)), n(parameters.machineShiftPrice, 68000), "typical"),
      line("Транспорт", "Доставка материалов", "рейс", Math.max(1, Math.ceil((asphaltMass + crushedMass) / 20)), n(parameters.deliveryPrice, 8500), "typical")
    ];
    assumptions.push("Плотность асфальтобетона принята 2,35 т/м³, запас 3%.", "Насыпная плотность щебня принята 1,45 т/м³, запас 5%.");
  } else {
    const primaryQuantity = n(parameters.volume || parameters.length || parameters.weight || parameters.count || parameters.area, 1);
    const basePrice = n(parameters.workPrice, categoryId === "interiors" ? 3500 : 1200);
    lines = category.defaultItems.map((defaultItem, index) => {
      const isMaterial = defaultItem.group === "Материалы";
      const quantity = defaultItem.unit === "компл." || defaultItem.unit === "смена" ? Math.max(1, Math.ceil(primaryQuantity / 500)) : primaryQuantity;
      const unitPrice = basePrice * (isMaterial ? .58 : defaultItem.group === "Работы" ? .34 : .18) * (1 + index * .09);
      return line(defaultItem.group, defaultItem.name, defaultItem.unit, quantity, unitPrice, parameters.workPrice ? "formula" : "typical");
    });
    assumptions.push("Типовые количества и расценки требуют подтверждения перед передачей заказчику.");
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
