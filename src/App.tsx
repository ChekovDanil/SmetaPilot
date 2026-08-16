import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Calculator, Check, ChevronDown,
  CircleHelp, ClipboardList, Download, FileDown, FileSpreadsheet, HardHat,
  Layers3, MapPin, Pencil, Plus, Search, ShieldCheck, Sparkles, Trash2, WandSparkles
} from "lucide-react";
import { catalog, categoryById } from "./data/catalog";
import { analyzeDescription } from "./lib/analyzer";
import { buildEstimate, totals, updateLine } from "./lib/estimate";
import { exportExcel, exportPdf } from "./lib/export";
import type { AnalysisResult, AppStep, CategoryId, EstimateDocument, EstimateLine, EstimateSettings } from "./types";

const examples = [catalog[0].example, catalog[6].example, catalog[2].example];
const sourceLabels = { user: "Введено", formula: "Формула", typical: "Типовое", found: "Найдено", missing: "Нет цены" } as const;
const money = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
const numberValue = (value: string) => value === "" ? "" : Number(value.replace(/\s/g, "").replace(",", "."));

function App() {
  const [step, setStep] = useState<AppStep>("start");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | undefined>();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [parameters, setParameters] = useState<Record<string, string | number>>({});
  const [settings, setSettings] = useState<EstimateSettings>({ region: "", priceMode: "mine", overhead: 10, profit: 8, vat: 20 });
  const [document, setDocument] = useState<EstimateDocument | null>(() => {
    try { return JSON.parse(localStorage.getItem("smetapilot-draft") ?? "null") as EstimateDocument | null; } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (document) localStorage.setItem("smetapilot-draft", JSON.stringify(document));
  }, [document]);

  const total = useMemo(() => document ? totals(document) : null, [document]);

  async function startAnalysis() {
    if (description.trim().length < 20) {
      setError("Добавьте немного деталей: вид работ, объём или площадь.");
      return;
    }
    setError("");
    setLoading(true);
    const result = await analyzeDescription(description, selectedCategory);
    const category = categoryById(result.categoryId);
    const defaults = Object.fromEntries(category.parameters.filter(field => field.defaultValue !== undefined).map(field => [field.id, field.defaultValue!]));
    setAnalysis(result);
    setParameters({ ...defaults, ...result.extracted });
    setStep("questions");
    setLoading(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function createEstimate() {
    if (!analysis) return;
    setDocument(buildEstimate(analysis.projectName, analysis.categoryId, description, parameters, settings));
    setStep("estimate");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startNew() {
    setStep("start"); setAnalysis(null); setDocument(null); setDescription(""); setSelectedCategory(undefined); setParameters({});
    localStorage.removeItem("smetapilot-draft");
  }

  function editLine(id: string, patch: Partial<EstimateLine>) {
    if (document) setDocument({ ...document, lines: document.lines.map(item => item.id === id ? updateLine(item, patch) : item) });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={startNew} aria-label="На главную"><span className="brand-mark"><Calculator size={20} /></span><span>Smeta<span>Pilot</span></span></button>
        {step !== "start" && <div className="progress" aria-label="Прогресс"><span className="done"><Check size={14} /> Описание</span><i /><span className={step !== "questions" ? "done" : "active"}>{step === "estimate" ? <Check size={14} /> : "2"} Уточнения</span><i /><span className={step === "estimate" ? "active" : ""}>3 Смета</span></div>}
        <div className="top-actions">{document && step === "start" && <button className="ghost-button" onClick={() => setStep("estimate")}><ClipboardList size={17} /> Черновик</button>}<span className="privacy"><ShieldCheck size={16} /> Данные хранятся локально</span></div>
      </header>

      <main>
        {step === "start" && <StartScreen description={description} setDescription={setDescription} selected={selectedCategory} setSelected={setSelectedCategory} loading={loading} error={error} onStart={startAnalysis} showAll={showAllCategories} setShowAll={setShowAllCategories} />}
        {step === "questions" && analysis && <QuestionsScreen analysis={analysis} parameters={parameters} setParameters={setParameters} settings={settings} setSettings={setSettings} onBack={() => setStep("start")} onCreate={createEstimate} />}
        {step === "estimate" && document && total && <EstimateScreen document={document} setDocument={setDocument} total={total} onLineChange={editLine} onBack={() => setStep("questions")} onNew={startNew} />}
      </main>
    </div>
  );
}

function StartScreen({ description, setDescription, selected, setSelected, loading, error, onStart, showAll, setShowAll }: {
  description: string; setDescription: (value: string) => void; selected?: CategoryId; setSelected: (id?: CategoryId) => void;
  loading: boolean; error: string; onStart: () => void; showAll: boolean; setShowAll: (value: boolean) => void;
}) {
  const visibleCategories = showAll ? catalog : catalog.slice(0, 8);
  return <>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><Sparkles size={16} /> Умный мастер строительных смет</div>
        <h1>Опишите работу.<br /><span>Получите готовую смету.</span></h1>
        <p className="lead">SmetaPilot поймёт задачу, задаст только важные вопросы и рассчитает объёмы по прозрачным формулам.</p>
        <div className="composer-wrap">
          {selected && <div className="selected-category"><HardHat size={14} /> {categoryById(selected).name}<button onClick={() => setSelected(undefined)}>×</button></div>}
          <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Например: нужна смета на асфальтирование 700 м². Цена работ 1 400 ₽/м², асфальт 7 000 ₽ за тонну, основание — щебень..." maxLength={4000} />
          <div className="composer-bottom"><span>{description.length ? `${description.length} символов` : "Можно писать обычными словами"}</span><button className="primary-button" onClick={onStart} disabled={loading}>{loading ? <><span className="spinner" /> Анализирую</> : <>Создать смету <ArrowRight size={18} /></>}</button></div>
        </div>
        {error && <div className="form-error"><CircleHelp size={16} /> {error}</div>}
        <div className="examples"><span>Попробовать:</span>{examples.map((example, index) => <button key={example} onClick={() => { setDescription(example); setSelected(index === 0 ? "roads" : index === 1 ? "interiors" : "concrete"); }}>{index === 0 ? "Дорога" : index === 1 ? "Ремонт офиса" : "Фундамент"}</button>)}</div>
      </div>
      <div className="hero-side">
        <div className="pilot-card"><div className="card-orbit orbit-one" /><div className="card-orbit orbit-two" /><div className="pilot-head"><span><WandSparkles size={18} /></span><div><small>SMETAPILOT</small><strong>От задачи до документа</strong></div></div>
          <div className="pilot-step"><span>01</span><div><strong>Распознаёт</strong><p>вид работ, объёмы и ваши цены</p></div><BadgeCheck size={18} /></div>
          <div className="pilot-step"><span>02</span><div><strong>Уточняет</strong><p>только параметры, влияющие на итог</p></div><CircleHelp size={18} /></div>
          <div className="pilot-step"><span>03</span><div><strong>Рассчитывает</strong><p>работы, материалы, технику и НДС</p></div><Calculator size={18} /></div>
          <div className="pilot-result"><div><small>Результат</small><strong>Редактируемая смета</strong></div><div className="export-pills"><span>PDF</span><span>XLSX</span></div></div>
        </div>
      </div>
    </section>

    <section className="directions">
      <div className="section-heading"><div><span>Направления</span><h2>Один мастер для разных видов строительства</h2></div><button onClick={() => setShowAll(!showAll)}>{showAll ? "Свернуть" : `Все ${catalog.length} направлений`} <ChevronDown size={17} className={showAll ? "rotate" : ""} /></button></div>
      <div className="category-grid">{visibleCategories.map((category, index) => <button key={category.id} className={`category-card ${selected === category.id ? "selected" : ""}`} onClick={() => setSelected(selected === category.id ? undefined : category.id)}><span className="category-number">{String(index + 1).padStart(2, "0")}</span><div><strong>{category.shortName}</strong><p>{category.description}</p></div><ArrowRight size={17} /></button>)}</div>
    </section>
    <section className="trust-row"><div><ShieldCheck /><span><strong>Без регистрации</strong>Проекты сохраняются на устройстве</span></div><div><Layers3 /><span><strong>Прозрачный расчёт</strong>Видно происхождение каждой цифры</span></div><div><FileDown /><span><strong>Готовый документ</strong>PDF для клиента и Excel для работы</span></div></section>
  </>;
}

function QuestionsScreen({ analysis, parameters, setParameters, settings, setSettings, onBack, onCreate }: {
  analysis: AnalysisResult; parameters: Record<string, string | number>; setParameters: (value: Record<string, string | number>) => void;
  settings: EstimateSettings; setSettings: (value: EstimateSettings) => void; onBack: () => void; onCreate: () => void;
}) {
  const category = categoryById(analysis.categoryId);
  return <section className="workspace-section">
    <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Изменить описание</button>
    <div className="workspace-title"><div><div className="eyebrow"><BadgeCheck size={16} /> Задачу понял</div><h1>{analysis.projectName}</h1><p>{category.description}. Проверьте значения — типовые параметры можно оставить как есть.</p></div><div className="confidence"><span>{Math.round(analysis.confidence * 100)}%</span><small>уверенность<br />распознавания</small></div></div>
    <div className="workspace-grid">
      <div className="questions-panel panel"><div className="panel-title"><div><span className="panel-icon"><ClipboardList /></span><div><small>ШАГ 2 ИЗ 3</small><h2>Уточните параметры</h2></div></div><span className="required-dot">● обязательные</span></div>
        <div className="fields-grid">{category.parameters.map(field => <label className={`field-card ${field.important ? "important" : ""}`} key={field.id}><span>{field.label}{field.important && <i>●</i>}</span><div className="input-shell">
          {field.kind === "select" ? <select value={parameters[field.id] ?? field.defaultValue ?? ""} onChange={event => setParameters({ ...parameters, [field.id]: event.target.value })}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={field.kind} inputMode={field.kind === "number" ? "decimal" : undefined} value={parameters[field.id] ?? ""} placeholder={field.placeholder} onChange={event => setParameters({ ...parameters, [field.id]: field.kind === "number" ? numberValue(event.target.value) : event.target.value })} />}
          {field.unit && <em>{field.unit}</em>}</div>{field.defaultValue !== undefined && !analysis.extracted[field.id] && <small><WandSparkles size={12} /> Типовое значение — можно изменить</small>}</label>)}</div>
      </div>
      <aside className="settings-panel panel"><div className="panel-title"><div><span className="panel-icon"><Calculator /></span><div><small>ПАРАМЕТРЫ СМЕТЫ</small><h2>Цены и итог</h2></div></div></div>
        <label className="simple-field"><span><MapPin size={15} /> Регион</span><input value={settings.region} placeholder="Например, Москва" onChange={event => setSettings({ ...settings, region: event.target.value })} /></label>
        <div className="mode-field"><span>Как заполнять неизвестные цены</span>{[["mine", "Только мои цены", "Неизвестные цены останутся нулевыми"], ["typical", "Типовые значения", "Помечать как допущение"], ["search", "Найти цены · скоро", "Подключим проверенные источники"]].map(([value, label, note]) => <button key={value} disabled={value === "search"} className={settings.priceMode === value ? "active" : ""} onClick={() => setSettings({ ...settings, priceMode: value as EstimateSettings["priceMode"] })}><span className="radio">{settings.priceMode === value && <i />}</span><span><strong>{label}</strong><small>{note}</small></span>{value === "search" && <Search size={16} />}</button>)}</div>
        <div className="percent-grid"><label><span>Накладные</span><div><input type="number" value={settings.overhead} onChange={event => setSettings({ ...settings, overhead: Number(event.target.value) })} /><em>%</em></div></label><label><span>Прибыль</span><div><input type="number" value={settings.profit} onChange={event => setSettings({ ...settings, profit: Number(event.target.value) })} /><em>%</em></div></label><label><span>НДС</span><div><input type="number" value={settings.vat} onChange={event => setSettings({ ...settings, vat: Number(event.target.value) })} /><em>%</em></div></label></div>
        <div className="settings-note"><ShieldCheck size={17} /><span>Все типовые значения будут отдельно отмечены в готовой смете.</span></div>
      </aside>
    </div>
    <div className="sticky-action"><div><strong>{category.name}</strong><span>{category.parameters.filter(field => parameters[field.id] !== undefined && parameters[field.id] !== "").length} из {category.parameters.length} параметров заполнено</span></div><button className="primary-button large" onClick={onCreate}>Рассчитать смету <ArrowRight size={19} /></button></div>
  </section>;
}

function EstimateScreen({ document, setDocument, total, onLineChange, onBack, onNew }: {
  document: EstimateDocument; setDocument: (value: EstimateDocument) => void; total: ReturnType<typeof totals>;
  onLineChange: (id: string, patch: Partial<EstimateLine>) => void; onBack: () => void; onNew: () => void;
}) {
  const [filter, setFilter] = useState<EstimateLine["group"] | "Все">("Все");
  const visible = filter === "Все" ? document.lines : document.lines.filter(item => item.group === filter);
  const groups: (EstimateLine["group"] | "Все")[] = ["Все", "Работы", "Материалы", "Техника", "Транспорт", "Прочее"];
  const addLine = () => setDocument({ ...document, lines: [...document.lines, { id: crypto.randomUUID(), group: "Прочее", name: "Новая позиция", unit: "шт.", quantity: 1, unitPrice: 0, total: 0, source: "user" }] });
  return <section className="workspace-section estimate-page">
    <div className="estimate-top"><button className="back-link" onClick={onBack}><ArrowLeft size={17} /> К параметрам</button><div className="estimate-actions"><button className="secondary-button" onClick={() => exportExcel(document)}><FileSpreadsheet size={17} /> Excel</button><button className="primary-button" onClick={() => exportPdf(document)}><Download size={17} /> PDF</button></div></div>
    <div className="estimate-hero panel"><div><div className="eyebrow"><BadgeCheck size={16} /> Смета готова</div><div className="editable-title"><input value={document.title} onChange={event => setDocument({ ...document, title: event.target.value })} /><Pencil size={17} /></div><p>{categoryById(document.categoryId).name} · создано {new Date(document.createdAt).toLocaleDateString("ru-RU")}</p></div><div className="grand-total"><small>ИТОГО С НДС</small><strong>{money(total.grand)} ₽</strong><span>{document.lines.length} позиций</span></div></div>
    <div className="metric-grid"><div><span>Прямые затраты</span><strong>{money(total.direct)} ₽</strong></div><div><span>Накладные {document.settings.overhead}%</span><strong>{money(total.overhead)} ₽</strong></div><div><span>Прибыль {document.settings.profit}%</span><strong>{money(total.profit)} ₽</strong></div><div><span>НДС {document.settings.vat}%</span><strong>{money(total.vat)} ₽</strong></div></div>
    <div className="estimate-table-panel panel"><div className="table-toolbar"><div className="group-tabs">{groups.map(group => <button key={group} className={filter === group ? "active" : ""} onClick={() => setFilter(group)}>{group}</button>)}</div><button className="add-button" onClick={addLine}><Plus size={16} /> Добавить позицию</button></div>
      <div className="table-scroll"><table className="estimate-table"><thead><tr><th>№</th><th>Раздел / Наименование</th><th>Ед.</th><th>Количество</th><th>Цена, ₽</th><th>Стоимость, ₽</th><th>Источник</th><th /></tr></thead><tbody>{visible.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><select className="group-select" value={item.group} onChange={event => onLineChange(item.id, { group: event.target.value as EstimateLine["group"] })}>{groups.slice(1).map(group => <option key={group}>{group}</option>)}</select><input className="name-input" value={item.name} onChange={event => onLineChange(item.id, { name: event.target.value })} /></td><td><input value={item.unit} onChange={event => onLineChange(item.id, { unit: event.target.value })} /></td><td><input type="number" value={item.quantity} onChange={event => onLineChange(item.id, { quantity: Number(event.target.value) })} /></td><td><input type="number" value={item.unitPrice} onChange={event => onLineChange(item.id, { unitPrice: Number(event.target.value), source: "user" })} /></td><td className="line-total">{money(item.total)}</td><td><span className={`source-tag ${item.source}`}>{sourceLabels[item.source]}</span></td><td><button className="delete-button" onClick={() => setDocument({ ...document, lines: document.lines.filter(lineItem => lineItem.id !== item.id) })}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div>
      <div className="mobile-lines">{visible.map((item, index) => <div className="mobile-line" key={item.id}><div><span>{index + 1}. {item.group}</span><button onClick={() => setDocument({ ...document, lines: document.lines.filter(lineItem => lineItem.id !== item.id) })}><Trash2 size={15} /></button></div><input className="mobile-name" value={item.name} onChange={event => onLineChange(item.id, { name: event.target.value })} /><div className="mobile-values"><label><span>Кол-во, {item.unit}</span><input type="number" value={item.quantity} onChange={event => onLineChange(item.id, { quantity: Number(event.target.value) })} /></label><label><span>Цена, ₽</span><input type="number" value={item.unitPrice} onChange={event => onLineChange(item.id, { unitPrice: Number(event.target.value), source: "user" })} /></label><strong>{money(item.total)} ₽</strong></div></div>)}</div>
    </div>
    <div className="estimate-bottom-grid"><div className="assumptions panel"><div className="panel-title"><div><span className="panel-icon amber"><CircleHelp /></span><div><small>ПРОВЕРЬТЕ ПЕРЕД ОТПРАВКОЙ</small><h2>Допущения расчёта</h2></div></div></div>{document.assumptions.map(note => <p key={note}><span>•</span>{note}</p>)}<p><span>•</span>Цены, отмеченные как типовые, необходимо подтвердить для вашего региона.</p></div><div className="total-card"><span>Стоимость без НДС</span><strong>{money(total.withoutVat)} ₽</strong><div><span>НДС</span><b>{money(total.vat)} ₽</b></div><div className="total-final"><span>Итого к оплате</span><b>{money(total.grand)} ₽</b></div><button className="primary-button" onClick={() => exportPdf(document)}><FileDown size={18} /> Экспортировать PDF</button></div></div>
    <button className="new-estimate" onClick={onNew}><Plus size={17} /> Создать новую смету</button>
  </section>;
}

export default App;
