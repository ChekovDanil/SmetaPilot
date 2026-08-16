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

const wordForPositions = (value: number) => {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return "позиция";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "позиции";
  return "позиций";
};

export async function exportExcel(document: EstimateDocument) {
  const XLSX = await import("xlsx");
  const summary = totals(document);
  const missingLines = document.lines.filter(needsPrice);
  const incomplete = missingLines.length > 0;

  const rows: Record<string, string | number>[] = document.lines.map((item, index) => {
    const missing = needsPrice(item);
    const reference = isReferenceLine(item);
    return {
      "№": index + 1,
      "Раздел": item.group,
      "Наименование": item.name,
      "Ед.": item.unit,
      "Количество": item.quantity,
      "Цена": missing || reference ? "" : item.unitPrice,
      "Стоимость": missing || reference ? "" : item.total,
      "Источник": missing ? "Нет цены" : sourceLabel[item.source]
    };
  });

  if (incomplete) {
    rows.push({
      "№": "",
      "Раздел": "СТАТУС",
      "Наименование": `ЧЕРНОВИК — без цены: ${missingLines.length} ${wordForPositions(missingLines.length)}`,
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
    "Источник": "Расчёт"
  });

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [{ wch: 5 }, { wch: 16 }, { wch: 44 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "Смета");
  const suffix = incomplete ? "-черновик" : "";
  XLSX.writeFile(workbook, `${document.title.replace(/[^а-яa-z0-9]+/gi, "-")}${suffix}.xlsx`);
}

export function exportPdf(document: EstimateDocument) {
  const summary = totals(document);
  const popup = window.open("", "_blank", "width=1280,height=900");
  if (!popup) return;

  const category = categoryById(document.categoryId);
  const region = document.settings.region.trim() || "Не указан";
  const missingLines = document.lines.filter(needsPrice);
  const pricedCandidates = document.lines.filter(item => !isReferenceLine(item));
  const completeness = pricedCandidates.length
    ? Math.round((pricedCandidates.length - missingLines.length) / pricedCandidates.length * 100)
    : 100;
  const incomplete = missingLines.length > 0;
  const created = new Date(document.createdAt);
  const dateText = created.toLocaleDateString("ru-RU");
  const dateCode = `${created.getFullYear()}${String(created.getMonth() + 1).padStart(2, "0")}${String(created.getDate()).padStart(2, "0")}`;
  const documentCode = `SP-${dateCode}-${document.categoryId.toUpperCase()}`;

  const assumptions = document.assumptions.length
    ? document.assumptions.map(note => `<li>${escapeHtml(note)}</li>`).join("")
    : "<li>Дополнительные допущения не указаны.</li>";

  const rows = document.lines.map((item, index) => {
    const missing = needsPrice(item);
    const reference = isReferenceLine(item);
    const price = missing
      ? `<span class="missing-value">Укажите цену</span>`
      : reference
        ? `<span class="dash">—</span>`
        : `${money(item.unitPrice)} ₽`;
    const lineTotal = missing || reference
      ? `<span class="dash">—</span>`
      : `${money(item.total)} ₽`;
    const label = missing ? "Нет цены" : sourceLabel[item.source];
    const sourceClass = missing ? "missing" : item.source;
    const rowClass = missing ? "row-missing" : reference ? "row-reference" : "";

    return `<tr class="${rowClass}">
      <td class="num">${index + 1}</td>
      <td><span class="section-tag section-${escapeHtml(item.group)}">${escapeHtml(item.group)}</span></td>
      <td class="name">${escapeHtml(item.name)}</td>
      <td class="unit">${escapeHtml(item.unit)}</td>
      <td class="number">${qty(item.quantity)}</td>
      <td class="number">${price}</td>
      <td class="number total-cell">${lineTotal}</td>
      <td><span class="source ${sourceClass}">${label}</span></td>
    </tr>`;
  }).join("");

  const statusText = incomplete
    ? `${missingLines.length} ${wordForPositions(missingLines.length)} без цены не ${missingLines.length === 1 ? "входит" : "входят"} в текущий итог.`
    : "Все позиции, влияющие на стоимость, имеют цену.";

  const currentTotalLabel = incomplete ? "Текущий итог*" : "Итого к оплате";

  popup.document.write(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(document.title)}${incomplete ? " — черновик" : ""}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 13mm 12mm 13mm; }
  * { box-sizing: border-box; }
  html, body { background: #ffffff; }
  body {
    margin: 0;
    color: #17202d;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.42;
    -webkit-font-smoothing: antialiased;
  }
  .sheet { width: 100%; margin: 0 auto; padding: 0 3mm; }
  .accent-line { height: 4px; margin: 0 0 13px; border-radius: 99px; background: linear-gradient(90deg, #25364e 0%, #48648f 58%, #79aa9a 100%); }
  .document-kicker { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 9px; }
  .document-kicker span:first-child { color: #687587; font-size: 8.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border-radius: 99px; font-size: 8.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
  .status-badge.draft { color: #79571f; background: #fff8eb; border: 1px solid #e6c687; }
  .status-badge.ready { color: #346354; background: #eef8f4; border: 1px solid #c9e2d9; }
  header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 28px; align-items: start; padding-bottom: 14px; }
  h1 { margin: 0; color: #111a27; font-size: 23px; line-height: 1.14; letter-spacing: -.025em; }
  .subtitle { margin-top: 6px; color: #5f6c7d; font-size: 11px; }
  .brand { text-align: right; color: #26364d; font-size: 19px; font-weight: 800; letter-spacing: -.025em; }
  .brand i { color: #619986; font-style: normal; }
  .brand small { display: block; margin-top: 4px; color: #8490a0; font-size: 7.5px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
  .meta-card { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; margin: 2px 0 14px; border: 1px solid #d8dfe7; border-radius: 8px; background: #fafbfd; overflow: hidden; }
  .meta-item { min-width: 0; padding: 8px 10px; border-right: 1px solid #e0e5eb; }
  .meta-item:last-child { border-right: 0; }
  .meta-item span { display: block; color: #7c8795; font-size: 7.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .meta-item strong { display: block; margin-top: 3px; overflow: hidden; color: #273241; font-size: 9.5px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
  .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; margin: 0 0 12px; }
  .summary-card { min-width: 0; padding: 9px 10px; border: 1px solid #d8dfe7; border-radius: 7px; background: #f8fafc; }
  .summary-card span { display: block; color: #748091; font-size: 7.5px; font-weight: 700; letter-spacing: .045em; text-transform: uppercase; }
  .summary-card strong { display: block; margin-top: 4px; color: #1d2836; font-size: 13px; white-space: nowrap; }
  .summary-card.final { border-color: ${incomplete ? "#e5c582" : "#c7ddd5"}; background: ${incomplete ? "#fff9ef" : "#f1f8f5"}; }
  .summary-card.final strong { color: ${incomplete ? "#77551f" : "#315f50"}; font-size: 14px; }
  .completeness-note { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin: -2px 0 12px; padding: 7px 10px; border-left: 3px solid ${incomplete ? "#c99e55" : "#6f9f8e"}; background: ${incomplete ? "#fffaf1" : "#f5faf8"}; color: ${incomplete ? "#765b2c" : "#45675c"}; font-size: 9px; }
  .completeness-note b { white-space: nowrap; }
  .table-frame { margin: 0 2mm; border: 1px solid #cbd4df; border-radius: 8px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { padding: 8px 7px; border-right: 1px solid rgba(255,255,255,.11); background: #24344b; color: #f7f9fc; text-align: left; font-size: 8.6px; font-weight: 700; letter-spacing: .01em; }
  th:last-child { border-right: 0; }
  td { padding: 7.5px 7px; border-top: 1px solid #dfe5eb; border-right: 1px solid #e4e9ee; vertical-align: middle; background: #ffffff; font-size: 9.2px; }
  td:last-child { border-right: 0; }
  tbody tr:nth-child(even) td { background: #fafbfd; }
  tbody tr.row-reference td { color: #647180; background: #f8fafb; }
  tbody tr.row-missing td { background: #fffaf2; }
  .num { width: 4%; text-align: center; color: #7c8794; }
  th:nth-child(2) { width: 11%; }
  th:nth-child(3) { width: 31%; }
  th:nth-child(4) { width: 7%; }
  th:nth-child(5) { width: 10%; }
  th:nth-child(6) { width: 12%; }
  th:nth-child(7) { width: 14%; }
  th:nth-child(8) { width: 11%; }
  .name { color: #202b39; font-weight: 600; }
  .unit { color: #657181; }
  .number { text-align: right; white-space: nowrap; }
  .total-cell { color: #172230; font-weight: 700; }
  .dash { color: #a1aab5; }
  .missing-value { color: #9a6722; font-size: 8.6px; font-weight: 700; }
  .section-tag { display: inline-block; max-width: 100%; padding: 3px 5px; border-radius: 4px; color: #536272; background: #edf1f5; font-size: 7.8px; font-weight: 700; white-space: nowrap; }
  .section-Работы { color: #396455; background: #edf7f3; }
  .section-Материалы { color: #405d82; background: #eef3fb; }
  .section-Техника { color: #5d6078; background: #f1f1f8; }
  .section-Транспорт { color: #665477; background: #f5f0f8; }
  .source { display: inline-block; padding: 3px 5px; border-radius: 4px; font-size: 7.6px; font-weight: 700; white-space: nowrap; }
  .source.user { color: #3f5f88; background: #edf3fb; }
  .source.formula { color: #3f6b5c; background: #edf7f3; }
  .source.typical { color: #826128; background: #fff7e8; }
  .source.found { color: #655183; background: #f3eff9; }
  .source.missing { color: #8f6124; background: #fff3df; }
  .lower-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 12px; margin: 14px 2mm 0; align-items: start; }
  .card { border: 1px solid #d4dce5; border-radius: 8px; overflow: hidden; background: #fff; }
  .card-head { padding: 9px 11px; border-bottom: 1px solid #dce2e9; background: #f6f8fa; }
  .card-head small { display: block; color: #7a8796; font-size: 7px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .card-head strong { display: block; margin-top: 2px; color: #283545; font-size: 10.5px; }
  .notes ul { margin: 0; padding: 10px 14px 10px 25px; color: #5b6877; font-size: 9px; }
  .notes li { margin: 0 0 5px; }
  .notes li:last-child { margin-bottom: 0; }
  .status-box { margin: 8px 10px 10px; padding: 8px 9px; border-radius: 6px; font-size: 8.7px; }
  .status-box.draft { color: #755a2b; background: #fff9ef; border: 1px solid #ead3a7; }
  .status-box.ready { color: #45695d; background: #f3f9f7; border: 1px solid #d3e5de; }
  .status-box strong { display: block; margin-bottom: 2px; }
  .totals .card-head { background: #24344b; border-bottom-color: #24344b; }
  .totals .card-head small, .totals .card-head strong { color: #fff; }
  .total-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 8px 11px; border-bottom: 1px solid #e0e5ea; font-size: 9px; }
  .total-row span { color: #667281; }
  .total-row b { color: #202b39; white-space: nowrap; }
  .total-row.grand { padding: 11px; border-bottom: 0; background: ${incomplete ? "#fff9ef" : "#f1f8f5"}; font-size: 12px; }
  .total-row.grand span, .total-row.grand b { color: ${incomplete ? "#75541d" : "#315e50"}; font-weight: 800; }
  .footnote { margin: 8px 2mm 0; color: #7e8894; font-size: 7.8px; text-align: right; }
  footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin: 13px 2mm 0; padding-top: 8px; border-top: 1px solid #dce2e8; color: #87919d; font-size: 7.7px; }
  footer strong { color: #5b6878; }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .sheet { padding: 0 3mm; }
  }
</style>
</head>
<body>
<div class="sheet">
  <div class="accent-line"></div>
  <div class="document-kicker">
    <span>Строительная смета · ${escapeHtml(documentCode)}</span>
    <span class="status-badge ${incomplete ? "draft" : "ready"}">${incomplete ? `Черновик · ${completeness}%` : "Готово · 100%"}</span>
  </div>

  <header>
    <div>
      <h1>${escapeHtml(document.title)}</h1>
      <div class="subtitle">${escapeHtml(category.name)} · ${incomplete ? "предварительный расчёт стоимости" : "итоговый расчёт стоимости"}</div>
    </div>
    <div class="brand">Smeta<i>Pilot</i><small>Estimate service</small></div>
  </header>

  <div class="meta-card">
    <div class="meta-item"><span>Дата</span><strong>${dateText}</strong></div>
    <div class="meta-item"><span>Регион</span><strong>${escapeHtml(region)}</strong></div>
    <div class="meta-item"><span>Валюта</span><strong>RUB</strong></div>
    <div class="meta-item"><span>Позиций</span><strong>${document.lines.length}</strong></div>
    <div class="meta-item"><span>Готовность</span><strong>${completeness}%</strong></div>
  </div>

  <div class="summary-grid">
    <div class="summary-card"><span>Прямые затраты</span><strong>${money(summary.direct)} ₽</strong></div>
    <div class="summary-card"><span>Накладные ${document.settings.overhead}%</span><strong>${money(summary.overhead)} ₽</strong></div>
    <div class="summary-card"><span>Прибыль ${document.settings.profit}%</span><strong>${money(summary.profit)} ₽</strong></div>
    <div class="summary-card"><span>НДС ${document.settings.vat}%</span><strong>${money(summary.vat)} ₽</strong></div>
    <div class="summary-card final"><span>${incomplete ? "Текущий итог*" : "Итого"}</span><strong>${money(summary.grand)} ₽</strong></div>
  </div>

  <div class="completeness-note"><span>${statusText}</span><b>${incomplete ? "Итог изменится после заполнения цен" : "Расчёт готов к передаче"}</b></div>

  <div class="table-frame">
    <table>
      <thead><tr><th>№</th><th>Раздел</th><th>Наименование</th><th>Ед.</th><th>Количество</th><th>Цена</th><th>Стоимость</th><th>Источник</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="lower-grid">
    <div class="card notes">
      <div class="card-head"><small>Основание расчёта</small><strong>Допущения и пояснения</strong></div>
      <ul>${assumptions}</ul>
      <div class="status-box ${incomplete ? "draft" : "ready"}">
        <strong>${incomplete ? `Черновик · готовность ${completeness}%` : "Смета заполнена полностью"}</strong>
        ${incomplete ? `${missingLines.length} ${wordForPositions(missingLines.length)} требует заполнения цены и пока не учитывается в итоговой сумме.` : "Все ценовые позиции учтены в итоговом расчёте."}
      </div>
    </div>

    <div class="card totals">
      <div class="card-head"><small>${incomplete ? "Предварительный" : "Финальный"}</small><strong>Итог расчёта</strong></div>
      <div class="total-row"><span>Прямые затраты</span><b>${money(summary.direct)} ₽</b></div>
      <div class="total-row"><span>Накладные</span><b>${money(summary.overhead)} ₽</b></div>
      <div class="total-row"><span>Прибыль</span><b>${money(summary.profit)} ₽</b></div>
      <div class="total-row"><span>Стоимость без НДС</span><b>${money(summary.withoutVat)} ₽</b></div>
      <div class="total-row"><span>НДС</span><b>${money(summary.vat)} ₽</b></div>
      <div class="total-row grand"><span>${currentTotalLabel}</span><b>${money(summary.grand)} ₽</b></div>
    </div>
  </div>

  ${incomplete ? `<div class="footnote">* Текущий итог не включает ${missingLines.length} ${wordForPositions(missingLines.length)} без цены.</div>` : ""}

  <footer>
    <span><strong>SmetaPilot</strong> · документ сформирован автоматически</span>
    <span>Перед утверждением проверьте объёмы, цены и условия выполнения работ.</span>
  </footer>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`);
  popup.document.close();
}
