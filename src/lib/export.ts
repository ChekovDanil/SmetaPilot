import { categoryById } from "../data/catalog";
import { totals } from "./estimate";
import type { EstimateDocument } from "../types";

const money = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);

export async function exportExcel(document: EstimateDocument) {
  const XLSX = await import("xlsx");
  const summary = totals(document);
  const rows: Record<string, string | number>[] = document.lines.map((item, index) => ({
    "№": index + 1, "Раздел": item.group, "Наименование": item.name, "Ед.": item.unit,
    "Количество": item.quantity, "Цена": item.unitPrice, "Стоимость": item.total, "Источник": item.source
  }));
  rows.push({ "№": rows.length + 1, "Раздел": "ИТОГО", "Наименование": "Итого с НДС", "Ед.": "₽", "Количество": 1, "Цена": summary.grand, "Стоимость": summary.grand, "Источник": "расчёт" });
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [{ wch: 5 }, { wch: 15 }, { wch: 40 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "Смета");
  XLSX.writeFile(workbook, `${document.title.replace(/[^а-яa-z0-9]+/gi, "-")}.xlsx`);
}

export function exportPdf(document: EstimateDocument) {
  const summary = totals(document);
  const popup = window.open("", "_blank", "width=1200,height=800");
  if (!popup) return;
  const rows = document.lines.map((item, index) => `<tr><td>${index + 1}</td><td>${item.group}</td><td>${item.name}</td><td>${item.unit}</td><td>${money(item.quantity)}</td><td>${money(item.unitPrice)}</td><td>${money(item.total)}</td></tr>`).join("");
  popup.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${document.title}</title><style>@page{size:A4 landscape;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#14201d;margin:0}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1c8d6b;padding-bottom:14px;margin-bottom:18px}h1{margin:0 0 6px;font-size:24px}p{margin:3px 0;color:#5b6965;font-size:12px}.brand{font-weight:800;color:#107153;font-size:18px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#107153;color:white;text-align:left;padding:8px 6px}td{padding:7px 6px;border-bottom:1px solid #d9e2df}td:nth-child(n+5){text-align:right}.totals{margin:18px 0 0 auto;width:340px}.totals div{display:flex;justify-content:space-between;padding:5px 0}.totals .grand{font-size:18px;font-weight:800;border-top:2px solid #107153;padding-top:10px}.note{margin-top:22px;padding:12px;background:#f3f7f5;border-radius:8px}@media print{button{display:none}}</style></head><body><header><div><h1>${document.title}</h1><p>${categoryById(document.categoryId).name}</p><p>Дата: ${new Date(document.createdAt).toLocaleDateString("ru-RU")} · Валюта: RUB</p></div><div class="brand">SmetaPilot</div></header><table><thead><tr><th>№</th><th>Раздел</th><th>Наименование</th><th>Ед.</th><th>Кол-во</th><th>Цена</th><th>Стоимость</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>Прямые затраты</span><b>${money(summary.direct)} ₽</b></div><div><span>Накладные</span><b>${money(summary.overhead)} ₽</b></div><div><span>Прибыль</span><b>${money(summary.profit)} ₽</b></div><div><span>НДС</span><b>${money(summary.vat)} ₽</b></div><div class="grand"><span>Итого</span><span>${money(summary.grand)} ₽</span></div></div><div class="note"><b>Допущения:</b> ${document.assumptions.join(" ")}</div><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
  popup.document.close();
}
