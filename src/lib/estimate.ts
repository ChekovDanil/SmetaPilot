import { categoryById } from "../data/catalog";
import type { EstimateDocument, EstimateLine, EstimateSettings, ValueSource } from "../types";

const n = (value: string | number | undefined, fallback = 0) => {
  if (value === undefined || value === "") return fallback;
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
    const sandThickness = n(parameters.sandThickness) / 100;
    const excavationDepth = n(parameters.excavationDepth) / 100;
    const asphaltDensity = n(parameters.asphaltDensity, 2.35);
    const baseDensity = n(parameters.baseDensity, 1.45);
    const sandDensity = n(parameters.sandDensity, 1.6);
    const asphaltWaste = 1 + n(parameters.asphaltWaste, 3) / 100;
    const baseWaste = 1 + n(parameters.baseWaste, 5) / 100;
    const sandWaste = 1 + n(parameters.sandWaste, 5) / 100;
    const asphaltMass = area * asphaltThickness * asphaltDensity * asphaltWaste;
    const crushedMass = area * baseThickness * baseDensity * baseWaste;
    const sandMass = area * sandThickness * sandDensity * sandWaste;
    const excavationVolume = area * excavationDepth;
    const geotextileQuantity = parameters.geotextile === "Да" ? area * 1.05 : 0;
    const curbLength = n(parameters.curbLength);
    const workPrice = n(parameters.workPrice, 0);
    const scope = String(parameters.workPriceScope ?? "Только работы");
    const typical = settings.priceMode === "typical";
    const resolvedPrice = (key: string, fallback: number): [number, ValueSource] => {
      const userPrice = n(parameters[key]);
      return userPrice > 0 ? [userPrice, "user"] : typical ? [fallback, "typical"] : [0, "missing"];
    };
    const pricedLine = (group: EstimateLine["group"], name: string, unit: string, quantity: number, key: string, fallback: number) => {
      const [unitPrice, source] = resolvedPrice(key, fallback);
      return line(group, name, unit, quantity, unitPrice, source);
    };
    const referenceMaterials = [
      ...(sandMass > 0 ? [line("Материалы", "Песок для подстилающего слоя (объём справочно)", "т", sandMass, 0, "formula")] : []),
      ...(crushedMass > 0 ? [line("Материалы", "Щебень для основания (объём справочно)", "т", crushedMass, 0, "formula")] : []),
      ...(asphaltMass > 0 ? [line("Материалы", "Асфальтобетонная смесь (объём справочно)", "т", asphaltMass, 0, "formula")] : []),
      ...(geotextileQuantity > 0 ? [line("Материалы", "Геотекстиль (объём справочно)", "м²", geotextileQuantity, 0, "formula")] : []),
      ...(curbLength > 0 ? [line("Материалы", "Бордюрный камень (объём справочно)", "м", curbLength, 0, "formula")] : [])
    ];

    if (scope === "Всё с материалами" && workPrice) {
      lines = [
        line("Работы", "Комплекс дорожных работ по цене пользователя", "м²", area, workPrice, "user"),
        ...referenceMaterials
      ];
      assumptions.push("Цена за м² указана как полная: материалы и техника повторно не начисляются.");
    } else {
      const workLines = workPrice > 0
        ? [line("Работы", scope === "Работы и техника" ? "Комплекс дорожных работ с техникой" : "Комплекс дорожных работ", "м²", area, workPrice, "user")]
        : [
            pricedLine("Работы", "Разбивка и подготовка участка", "м²", area, "sitePreparationPrice", 120),
            ...(excavationVolume > 0 ? [pricedLine("Работы", "Разработка и вывоз грунта", "м³", excavationVolume, "excavationPrice", 350)] : []),
            ...(geotextileQuantity > 0 ? [pricedLine("Работы", "Укладка геотекстиля", "м²", geotextileQuantity, "geotextileWorkPrice", 80)] : []),
            ...(sandMass > 0 ? [pricedLine("Работы", "Устройство песчаного слоя", "м²", area, "sandWorkPrice", 180)] : []),
            ...(crushedMass > 0 ? [pricedLine("Работы", "Устройство щебёночного основания", "м²", area, "baseWorkPrice", 260)] : []),
            ...(asphaltMass > 0 ? [pricedLine("Работы", "Укладка асфальтобетонной смеси", "м²", area, "asphaltWorkPrice", 600)] : []),
            ...(curbLength > 0 ? [pricedLine("Работы", "Установка бордюрного камня", "м", curbLength, "curbWorkPrice", 750)] : [])
          ];
      const materialLines = [
        ...(geotextileQuantity > 0 ? [pricedLine("Материалы", "Геотекстиль с нахлёстом 5%", "м²", geotextileQuantity, "geotextilePrice", 110)] : []),
        ...(sandMass > 0 ? [pricedLine("Материалы", "Песок для подстилающего слоя", "т", sandMass, "sandPrice", 900)] : []),
        ...(crushedMass > 0 ? [pricedLine("Материалы", "Щебень для основания", "т", crushedMass, "crushedStonePrice", 2100)] : []),
        ...(asphaltMass > 0 ? [pricedLine("Материалы", "Асфальтобетонная смесь", "т", asphaltMass, "asphaltPrice", 7000)] : []),
        ...(curbLength > 0 ? [pricedLine("Материалы", "Бордюрный камень", "м", curbLength, "curbPrice", 700)] : [])
      ];
      const totalMaterialMass = sandMass + crushedMass + asphaltMass;
      const trips = totalMaterialMass > 0 ? Math.max(1, Math.ceil(totalMaterialMass / 20)) : 0;
      lines = [
        ...workLines,
        ...materialLines,
        ...(scope === "Работы и техника" && workPrice ? [] : [pricedLine("Техника", "Комплект дорожной техники", "смена", Math.max(1, Math.ceil(area / 1000)), "machineShiftPrice", 68000)]),
        ...(trips > 0 ? [pricedLine("Транспорт", "Доставка инертных материалов и смеси", "рейс", trips, "deliveryPrice", 8500)] : [])
      ];
      if (scope === "Работы и техника" && workPrice) assumptions.push("Техника уже включена в цену работ и отдельно не начисляется.");
    }
    assumptions.push(
      `Асфальт: плотность ${asphaltDensity.toLocaleString("ru-RU")} т/м³, запас ${n(parameters.asphaltWaste, 3).toLocaleString("ru-RU")}%.`,
      `Щебень: насыпная плотность ${baseDensity.toLocaleString("ru-RU")} т/м³, запас ${n(parameters.baseWaste, 5).toLocaleString("ru-RU")}%.`,
      ...(sandMass > 0 ? [`Песок: насыпная плотность ${sandDensity.toLocaleString("ru-RU")} т/м³, запас ${n(parameters.sandWaste, 5).toLocaleString("ru-RU")}%.`] : []),
      "Количество рейсов рассчитано при загрузке автомобиля до 20 т."
    );
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
