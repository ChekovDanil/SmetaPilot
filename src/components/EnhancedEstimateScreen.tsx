import { useMemo, useState } from "react";
import {
  ArrowLeft, BadgeCheck, CheckCircle2, CircleHelp, Download, FileDown,
  FileSpreadsheet, Pencil, Plus, TriangleAlert, Trash2
} from "lucide-react";
import { categoryById } from "../data/catalog";
import { exportExcel, exportPdf } from "../lib/export";
import type { EstimateDocument, EstimateLine } from "../types";

const sourceLabels = { user: "Введено", formula: "Формула", typical: "Типовое", found: "Найдено", missing: "Нет цены" } as const;
const money = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);

type Totals = {
  direct: number;
  overhead: number;
  profit: number;
  withoutVat: number;
  vat: number;
  grand: number;
};

type Filter = EstimateLine["group"] | "Все" | "Без цены";

const isReferenceLine = (item: EstimateLine) => item.source === "formula" && item.unitPrice <= 0;
const needsPrice = (item: EstimateLine) => item.unitPrice <= 0 && !isReferenceLine(item);

export default function EnhancedEstimateScreen({ document, setDocument, total, onLineChange, onBack, onNew }: {
  document: EstimateDocument;
  setDocument: (value: EstimateDocument) => void;
  total: Totals;
  onLineChange: (id: string, patch: Partial<EstimateLine>) => void;
  onBack: () => void;
  onNew: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("Все");
  const groups: EstimateLine["group"][] = ["Работы", "Материалы", "Техника", "Транспорт", "Прочее"];

  const missingLines = useMemo(() => document.lines.filter(needsPrice), [document.lines]);
  const pricedCandidates = useMemo(() => document.lines.filter(item => !isReferenceLine(item)), [document.lines]);
  const completedPrices = pricedCandidates.length - missingLines.length;
  const completeness = pricedCandidates.length ? Math.round(completedPrices / pricedCandidates.length * 100) : 100;
  const incomplete = missingLines.length > 0;

  const visible = filter === "Все"
    ? document.lines
    : filter === "Без цены"
      ? missingLines
      : document.lines.filter(item => item.group === filter);

  const groupCount = (group: Filter) => group === "Все"
    ? document.lines.length
    : group === "Без цены"
      ? missingLines.length
      : document.lines.filter(item => item.group === group).length;

  const addLine = () => setDocument({
    ...document,
    lines: [...document.lines, {
      id: crypto.randomUUID(), group: "Прочее", name: "Новая позиция", unit: "шт.",
      quantity: 1, unitPrice: 0, total: 0, source: "missing"
    }]
  });

  const changePrice = (item: EstimateLine, raw: string) => {
    const unitPrice = raw === "" ? 0 : Number(raw);
    onLineChange(item.id, { unitPrice, source: unitPrice > 0 ? "user" : "missing" });
  };

  const removeLine = (id: string) => setDocument({ ...document, lines: document.lines.filter(item => item.id !== id) });

  return <section className="workspace-section estimate-page">
    <div className="estimate-top">
      <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> К параметрам</button>
      <div className="estimate-actions">
        <button className="secondary-button" onClick={() => exportExcel(document)}><FileSpreadsheet size={17} /> Excel</button>
        <button className="primary-button" onClick={() => exportPdf(document)}><Download size={17} /> {incomplete ? "PDF · черновик" : "PDF"}</button>
      </div>
    </div>

    <div className="estimate-hero panel">
      <div>
        <div className="eyebrow">{incomplete ? <><TriangleAlert size={16} /> Черновик сметы</> : <><BadgeCheck size={16} /> Смета готова</>}</div>
        <div className="editable-title"><input value={document.title} onChange={event => setDocument({ ...document, title: event.target.value })} /><Pencil size={17} /></div>
        <p>{categoryById(document.categoryId).name} · создано {new Date(document.createdAt).toLocaleDateString("ru-RU")}</p>
      </div>
      <div className="grand-total">
        <small>{incomplete ? "ПРЕДВАРИТЕЛЬНЫЙ ИТОГ" : "ИТОГО С НДС"}</small>
        <strong className={incomplete ? "incomplete-total" : ""}>{money(total.grand)} ₽</strong>
        <span>{document.lines.length} позиций · готовность {completeness}%</span>
      </div>
    </div>

    <div className={`estimate-status ${incomplete ? "warning" : ""}`}>
      <div className="status-icon">{incomplete ? <TriangleAlert size={20} /> : <CheckCircle2 size={20} />}</div>
      <div>
        <strong>{incomplete ? `Смета заполнена на ${completeness}%` : "Все цены заполнены"}</strong>
        <span>{incomplete
          ? `${missingLines.length} ${missingLines.length === 1 ? "позиция требует" : "позиций требуют"} цены. Они не входят в текущий итог, поэтому сумма пока предварительная.`
          : "Расчёт полностью заполнен. PDF будет сформирован как готовый документ."}</span>
      </div>
      {incomplete && <button onClick={() => setFilter("Без цены")}>Показать без цены ({missingLines.length})</button>}
    </div>

    <div className="metric-grid">
      <div><span>Прямые затраты</span><strong>{money(total.direct)} ₽</strong></div>
      <div><span>Накладные {document.settings.overhead}%</span><strong>{money(total.overhead)} ₽</strong></div>
      <div><span>Прибыль {document.settings.profit}%</span><strong>{money(total.profit)} ₽</strong></div>
      <div><span>НДС {document.settings.vat}%</span><strong>{money(total.vat)} ₽</strong></div>
    </div>

    <div className="estimate-table-panel panel">
      <div className="table-toolbar">
        <div className="group-tabs">
          {(["Все", ...groups, ...(incomplete ? ["Без цены" as const] : [])] as Filter[]).map(group =>
            <button key={group} className={filter === group ? "active" : ""} onClick={() => setFilter(group)}>
              {group}<span>{groupCount(group)}</span>
            </button>)}
        </div>
        <button className="add-button" onClick={addLine}><Plus size={16} /> Добавить позицию</button>
      </div>

      <div className="table-scroll"><table className="estimate-table">
        <thead><tr><th>№</th><th>Раздел / Наименование</th><th>Ед.</th><th>Количество</th><th>Цена, ₽</th><th>Стоимость, ₽</th><th>Источник</th><th /></tr></thead>
        <tbody>{visible.map((item, index) => {
          const missing = needsPrice(item);
          return <tr key={item.id} data-group={item.group} className={missing ? "missing-price-row" : ""}>
            <td>{index + 1}</td>
            <td><select className="group-select" value={item.group} onChange={event => onLineChange(item.id, { group: event.target.value as EstimateLine["group"] })}>{groups.map(group => <option key={group}>{group}</option>)}</select><input className="name-input" value={item.name} onChange={event => onLineChange(item.id, { name: event.target.value })} /></td>
            <td><input value={item.unit} onChange={event => onLineChange(item.id, { unit: event.target.value })} /></td>
            <td><input type="number" value={item.quantity} onChange={event => onLineChange(item.id, { quantity: Number(event.target.value) })} /></td>
            <td><input type="number" min="0" value={item.unitPrice > 0 ? item.unitPrice : ""} placeholder={missing ? "Укажите цену" : "—"} onChange={event => changePrice(item, event.target.value)} /></td>
            <td className="line-total">{missing ? "не учтено" : item.total > 0 ? money(item.total) : "—"}</td>
            <td><span className={`source-tag ${missing ? "missing" : item.source}`}>{missing ? "Нет цены" : sourceLabels[item.source]}</span></td>
            <td><button className="delete-button" onClick={() => removeLine(item.id)}><Trash2 size={15} /></button></td>
          </tr>;
        })}</tbody>
      </table></div>

      <div className="mobile-lines">{visible.map((item, index) => {
        const missing = needsPrice(item);
        return <div className={`mobile-line ${missing ? "missing-price-line" : ""}`} key={item.id}>
          <div><div className="mobile-line-meta"><span>{index + 1}. {item.group}</span><span className={`source-tag ${missing ? "missing" : item.source}`}>{missing ? "Нет цены" : sourceLabels[item.source]}</span></div><button onClick={() => removeLine(item.id)}><Trash2 size={15} /></button></div>
          <input className="mobile-name" value={item.name} onChange={event => onLineChange(item.id, { name: event.target.value })} />
          <div className="mobile-values">
            <label><span>Кол-во, {item.unit}</span><input type="number" value={item.quantity} onChange={event => onLineChange(item.id, { quantity: Number(event.target.value) })} /></label>
            <label><span>Цена, ₽</span><input type="number" min="0" value={item.unitPrice > 0 ? item.unitPrice : ""} placeholder="Укажите цену" onChange={event => changePrice(item, event.target.value)} /></label>
            <strong>{missing ? "Не учтено в итоге" : `${money(item.total)} ₽`}</strong>
          </div>
        </div>;
      })}</div>
    </div>

    <div className="estimate-bottom-grid">
      <div className="assumptions panel">
        <div className="panel-title"><div><span className="panel-icon amber"><CircleHelp /></span><div><small>ПРОВЕРЬТЕ ПЕРЕД ОТПРАВКОЙ</small><h2>Допущения расчёта</h2></div></div></div>
        {document.assumptions.map(note => <p key={note}><span>•</span>{note}</p>)}
        <p><span>•</span>Цены, отмеченные как типовые, необходимо подтвердить для вашего региона.</p>
      </div>
      <div className="total-card">
        <span>{incomplete ? "Предварительная стоимость без НДС" : "Стоимость без НДС"}</span>
        <strong>{money(total.withoutVat)} ₽</strong>
        {incomplete && <div className="total-warning">Не учтено позиций без цены: {missingLines.length}. Итог изменится после их заполнения.</div>}
        <div><span>НДС</span><b>{money(total.vat)} ₽</b></div>
        <div className="total-final"><span>{incomplete ? "Текущий итог" : "Итого к оплате"}</span><b>{money(total.grand)} ₽</b></div>
        <button className="primary-button" onClick={() => exportPdf(document)}><FileDown size={18} /> {incomplete ? "Экспортировать черновик PDF" : "Экспортировать PDF"}</button>
      </div>
    </div>
    <button className="new-estimate" onClick={onNew}><Plus size={17} /> Создать новую смету</button>
  </section>;
}
