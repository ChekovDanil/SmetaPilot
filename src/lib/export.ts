import { categoryById } from "../data/catalog";
import { totals } from "./estimate";
import type { EstimateDocument, EstimateLine } from "../types";

const money = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
const qty = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(value);
const escapeHtml = (value: string | number) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const sourceLabel: Record<EstimateLine["source"], string> = {
  user: "Введено",
  formula: "Расчёт",
  typical: "Типовое",
  found: "Найдено",
  missing: "Нет цены"
};

const isReferenceLine = (item: EstimateLine) => item.source === "formula" && item.unitPrice <= 0;
const needsPrice = (item: EstimateLine) => item.unitPrice <= 0 && !isReferenceLine(item);

export async function exportExcel(document: EstimateDocument) {
  const XLSX = await import("xlsx");
  const summary = totals(document);
  const missingLines = document.lines.filter(needsPrice);
  const incomplete = missingLines.length > 0;

  const rows: Record<string, string | number>[] = document.lines.map((item, index) => {
    const missing = needsPrice(item);
    return {
      "№": index + 1,
      "Раздел": item.group,
      "Наименование": item.name,
      "Ед.": item.unit,
      "Количество": item.quantity,
      "Цена": missing || isReferenceLine(item) ? "" : item.unitPrice,
      "Стоимость": missing || isReferenceLine(item) ? "" : item.total,
      "Источник": missing ? "Нет цены" : sourceLabel[item.source]
    };
  });

  if (incomplete) {
    rows.push({
      "№": "",
      "Раздел": "СТАТУС",
      "Наименование": `ЧЕРНОВИК — не заполнено цен: ${missingLines.length}`,
      "Ед.": "",
      "Количество": "",
      "Цена": "",
      "Стоимость": "",
      "Источник": "Требует проверки"
    });
  }

  rows.push({
    "№": rows.length + 1,
    "Раздел": "ИТОГО",
    "Наименование": incomplete ? "Текущий предварительный итог с НДС" : "Итого с НДС",
    "Ед.": "₽",
    "Количество": 1,
    "Цена": summary.grand,
    "Стоимость": summary.grand,
    "Источник": "расчёт"
  });

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [{ wch: 5 }, { wch: 15 }, { wch: 42 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 17 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "Смета");
  const suffix = incomplete ? "-черновик" : "";
  XLSX.writeFile(workbook, `${document.title.replace(/[^а-яa-z0-9]+/gi, "-")}${suffix}.xlsx`);
}

export function exportPdf(document: EstimateDocument) {
  const summary = totals(document);
  const popup = window.open("", "_blank", "width=1200,height=900");
  if (!popup) return;

  const category = categoryById(document.categoryId);
  const region = document.settings.region.trim() || "не указан";
  const missingLines = document.lines.filter(needsPrice);
  const pricedCandidates = document.lines.filter(item => !isReferenceLine(item));
  const completeness = pricedCandidates.length
    ? Math.round((pricedCandidates.length - missingLines.length) / pricedCandidates.length * 100)
    : 100;
  const incomplete = missingLines.length > 0;

  const assumptions = document.assumptions.length
    ? document.assumptions.map(note => `<li>${escapeHtml(note)}</li>`).join("")
    : "<li>Дополнительные допущения не указаны.</li>";

  const rows = document.lines.map((item, index) => {
    const missing = needsPrice(item);
    const reference = isReferenceLine(item);
    const price = missing
      ? `<span class="missing">укажите цену</span>`
      : reference
        ? `<span class="muted-value">—</span>`
        : `${money(item.unitPrice)} ₽`;
    const total = missing || reference
      ? `<span class="muted-value">—</span>`
      : `${money(item.total)} ₽`;
    const label = missing ? "Нет цены" : sourceLabel[item.source];
    const sourceClass = missing ? "missing" : item.source;

    return `<tr class="${missing ? "row-missing" : ""}">
      <td class="num">${index + 1}</td>
      <td><span class="group">${escapeHtml(item.group)}</span></td>
      <td class="name">${escapeHtml(item.name)}</td>
      <td class="unit">${escapeHtml(item.unit)}</td>
      <td class="number">${qty(item.quantity)}</td>
      <td class="number">${price}</td>
      <td class="number total-cell">${total}</td>
      <td><span class="source ${sourceClass}">${label}</span></td>
    </tr>`;
  }).join("");

  const statusNotice = incomplete
    ? `<div class="warning"><strong>Черновик: готовность ${completeness}%</strong><span>${missingLines.length} ${missingLines.length === 1 ? "позиция не имеет цены и не входит" : "позиций не имеют цены и не входят"} в текущий итог. После заполнения цен сумма изменится.</span></div>`
    : `<div class="ok"><strong>Смета заполнена на 100%</strong><span>Все позиции, влияющие на стоимость, имеют цену.</span></div>`;

  popup.document.write(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(document.title)}${incomplete ? " — черновик" : ""}</title>
<style>
  @page { size: A4 landscape; margin: 11mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #17211e; background: #fff; font-size: 12px; line-height: 1.45; }
  .page { width: 100%; position: relative; }
  .draft-ribbon { display: ${incomplete ? "flex" : "none"}; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px; padding: 8px 12px; border: 1px solid #e2b878; border-radius: 7px; background: #fff8eb; color: #80581d; font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
  header { display: grid; grid-template-columns: 1fr auto; gap: 28px; align-items: start; padding-bottom: 16px; border-bottom: 3px solid #137556; }
  h1 { margin: 0; font-size: 24px; line-height: 1.15; letter-spacing: -.02em; }
  .subtitle { margin: 6px 0 0; color: #53635e; font-size: 12px; }
  .meta { display: flex; flex-wrap: wrap; gap: 7px 18px; margin-top: 12px; color: #63726d; font-size: 11px; }
  .meta b { color: #27332f; }
  .brand { text-align: right; color: #137556; font-size: 20px; font-weight: 800; letter-spacing: -.02em; }
  .brand small { display: block; margin-top: 5px; color: #80908a; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; }
  .summary-strip { display: grid; grid-template-columns: repeat(5, 1fr); margin: 16px 0; border: 1px solid #cfd9d5; border-radius: 8px; overflow: hidden; }
  .summary-strip div { padding: 10px 12px; border-right: 1px solid #d9e1de; background: #f7faf9; }
  .summary-strip div:last-child { border-right: 0; background: ${incomplete ? "#fff8eb" : "#e9f7f1"}; }
  .summary-strip span { display: block; color: #66756f; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; }
  .summary-strip strong { display: block; margin-top: 4px; font-size: 14px; color: #18231f; }
  .summary-strip div:last-child strong { color: ${incomplete ? "#835b23" : "#0d6b4d"}; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1px solid #bfcac6; }
  thead { display: table-header-group; }
  th { padding: 8px 7px; border: 1px solid #b9c7c1; background: #176f55; color: #fff; text-align: left; font-size: 9.5px; font-weight: 700; }
  td { padding: 8px 7px; border: 1px solid #d3dcda; vertical-align: middle; font-size: 10px; }
  tbody tr:nth-child(even) td { background: #f8faf9; }
  tbody tr.row-missing td { background: #fffaf1; }
  tr { page-break-inside: avoid; }
  .num { width: 4%; text-align: center; color: #63736d; }
  th:nth-child(2) { width: 11%; }
  th:nth-child(3) { width: 31%; }
  th:nth-child(4) { width: 7%; }
  th:nth-child(5) { width: 11%; }
  th:nth-child(6) { width: 12%; }
  th:nth-child(7) { width: 13%; }
  th:nth-child(8) { width: 11%; }
  .name { font-weight: 600; color: #1d2925; }
  .group { display: inline-block; font-size: 9px; font-weight: 700; color: #385048; }
  .unit { color: #586a63; }
  .number { text-align: right; white-space: nowrap; }
  .total-cell { font-weight: 700; color: #17211e; }
  .source { display: inline-block; padding: 3px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; white-space: nowrap; }
  .source.user { background: #edf4ff; color: #315b91; }
  .source.formula { background: #eaf7f2; color: #176a50; }
  .source.typical { background: #fff6e4; color: #92621c; }
  .source.found { background: #f3ecff; color: #7048a3; }
  .source.missing { background: #fff0e4; color: #995922; }
  .missing { color: #995922; font-weight: 700; }
  .muted-value { color: #9aa6a2; }
  .footer-grid { display: grid; grid-template-columns: 1fr 360px; gap: 16px; margin-top: 16px; align-items: start; }
  .notes { border: 1px solid #d4ddda; border-radius: 8px; overflow: hidden; }
  .notes h2 { margin: 0; padding: 10px 12px; background: #f4f7f6; border-bottom: 1px solid #d4ddda; font-size: 12px; }
  .notes ul { margin: 0; padding: 12px 14px 12px 28px; color: #566660; }
  .notes li { margin: 0 0 6px; }
  .notes li:last-child { margin-bottom: 0; }
  .warning, .ok { display: flex; flex-direction: column; gap: 3px; margin-top: 10px; padding: 10px 12px; border-radius: 7px; font-size: 10px; }
  .warning { border: 1px solid #e7c991; background: #fff8eb; color: #80581d; }
  .ok { border: 1px solid #cfe3da; background: #f3faf7; color: #29624f; }
  .totals { border: 1px solid #bfcac6; border-radius: 8px; overflow: hidden; }
  .totals h2 { margin: 0; padding: 11px 13px; background: #176f55; color: #fff; font-size: 13px; }
  .totals-row { display: flex; justify-content: space-between; gap: 18px; padding: 9px 13px; border-bottom: 1px solid #d8e0dd; background: #fff; }
  .totals-row span { color: #5a6964; }
  .totals-row b { white-space: nowrap; }
  .totals-row.grand { padding: 13px; border-bottom: 0; background: ${incomplete ? "#fff8eb" : "#eaf7f1"}; font-size: 15px; }
  .totals-row.grand span, .totals-row.grand b { color: ${incomplete ? "#80581d" : "#0d6348"}; font-weight: 800; }
  .footer { display: flex; justify-content: space-between; gap: 20px; margin-top: 16px; padding-top: 10px; border-top: 1px solid #d4ddda; color: #7b8984; font-size: 9px; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="draft-ribbon">Черновик · не все цены заполнены · готовность ${completeness}%</div>
  <header>
    <div>
      <h1>${escapeHtml(document.title)}</h1>
      <div class="subtitle">${escapeHtml(category.name)} · ${incomplete ? "предварительная смета" : "готовая строительная смета"}</div>
      <div class="meta">
        <span><b>Дата:</b> ${new Date(document.createdAt).toLocaleDateString("ru-RU")}</span>
        <span><b>Регион:</b> ${escapeHtml(region)}</span>
        <span><b>Валюта:</b> RUB</span>
        <span><b>Позиций:</b> ${document.lines.length}</span>
        <span><b>Готовность:</b> ${completeness}%</span>
      </div>
    </div>
    <div class="brand">SmetaPilot<small>${incomplete ? "черновик расчёта" : "строительная смета"}</small></div>
  </header>

  <div class="summary-strip">
    <div><span>Прямые затраты</span><strong>${money(summary.direct)} ₽</strong></div>
    <div><span>Накладные ${document.settings.overhead}%</span><strong>${money(summary.overhead)} ₽</strong></div>
    <div><span>Прибыль ${document.settings.profit}%</span><strong>${money(summary.profit)} ₽</strong></div>
    <div><span>НДС ${document.settings.vat}%</span><strong>${money(summary.vat)} ₽</strong></div>
    <div><span>${incomplete ? "Текущий итог*" : "Итого"}</span><strong>${money(summary.grand)} ₽</strong></div>
  </div>

  <table>
    <thead><tr><th>№</th><th>Раздел</th><th>Наименование</th><th>Ед.</th><th>Количество</th><th>Цена</th><th>Стоимость</th><th>Источник</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer-grid">
    <div>
      <div class="notes"><h2>Допущения и пояснения</h2><ul>${assumptions}</ul></div>
      ${statusNotice}
    </div>
    <div class="totals">
      <h2>${incomplete ? "Предварительный итог" : "Итог расчёта"}</h2>
      <div class="totals-row"><span>Прямые затраты</span><b>${money(summary.direct)} ₽</b></div>
      <div class="totals-row"><span>Накладные</span><b>${money(summary.overhead)} ₽</b></div>
      <div class="totals-row"><span>Прибыль</span><b>${money(summary.profit)} ₽</b></div>
      <div class="totals-row"><span>Стоимость без НДС</span><b>${money(summary.withoutVat)} ₽</b></div>
      <div class="totals-row"><span>НДС</span><b>${money(summary.vat)} ₽</b></div>
      <div class="totals-row grand"><span>${incomplete ? "Текущий итог*" : "Итого к оплате"}</span><b>${money(summary.grand)} ₽</b></div>
    </div>
  </div>

  <div class="footer"><span>Сформировано в SmetaPilot${incomplete ? " · ЧЕРНОВИК" : ""}</span><span>${incomplete ? "* Итог не включает позиции без цены и изменится после их заполнения." : "Перед утверждением проверьте объёмы, цены и условия выполнения работ."}</span></div>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`);
  popup.document.close();
}
