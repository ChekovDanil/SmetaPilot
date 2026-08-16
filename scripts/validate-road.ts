import { buildEstimate, totals } from "../src/lib/estimate";
import type { EstimateSettings } from "../src/types";

const mine: EstimateSettings = { region: "", priceMode: "mine", overhead: 0, profit: 0, vat: 0 };
const expect = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const find = (lines: ReturnType<typeof buildEstimate>["lines"], text: string) => lines.find(item => item.name.includes(text));
const findMaterial = (lines: ReturnType<typeof buildEstimate>["lines"], text: string) => lines.find(item => item.group === "Материалы" && item.name.includes(text));

const allInclusive = buildEstimate("Тест", "roads", "", {
  area: 700, asphaltThickness: 5, baseThickness: 15, workPrice: 1400, workPriceScope: "Всё с материалами"
}, mine);
expect(totals(allInclusive).direct === 980000, "Полная цена должна начисляться один раз");
expect(allInclusive.lines.filter(item => item.group === "Материалы").every(item => item.total === 0), "Справочные материалы не должны дублировать полную цену");

const quantities = buildEstimate("Тест", "roads", "", {
  area: 700, asphaltThickness: 5, baseThickness: 15, asphaltPrice: 7000, crushedStonePrice: 2100
}, mine);
expect(findMaterial(quantities.lines, "Асфальтобетонная смесь")?.quantity === 84.72, "Неверная масса асфальта");
expect(findMaterial(quantities.lines, "Щебень для основания")?.quantity === 159.86, "Неверная масса щебня");

const extended = buildEstimate("Тест", "roads", "", {
  area: 100, asphaltThickness: 5, baseThickness: 15, sandThickness: 10, excavationDepth: 20,
  geotextile: "Да", curbLength: 40
}, mine);
expect(find(extended.lines, "Разработка и вывоз")?.quantity === 20, "Неверный объём выемки");
expect(find(extended.lines, "Геотекстиль с нахлёстом")?.quantity === 105, "Неверная площадь геотекстиля");
expect(findMaterial(extended.lines, "Песок для подстилающего")?.quantity === 16.8, "Неверная масса песка");
expect(findMaterial(extended.lines, "Бордюрный камень")?.quantity === 40, "Неверная длина бордюра");

const workAndMachines = buildEstimate("Тест", "roads", "", {
  area: 700, asphaltThickness: 5, baseThickness: 15, workPrice: 1400, workPriceScope: "Работы и техника"
}, mine);
expect(!find(workAndMachines.lines, "Комплект дорожной техники"), "Техника не должна начисляться повторно");

console.log("Road estimate validation: OK");
