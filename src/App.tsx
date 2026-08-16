import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Calculator, Check, ChevronDown,
  CircleHelp, ClipboardList, FileDown, HardHat, Layers3, MapPin, Search,
  ShieldCheck, Sparkles, WandSparkles
} from "lucide-react";
import { catalog, categoryById } from "./data/catalog";
import EnhancedEstimateScreen from "./components/EnhancedEstimateScreen";
import { analyzeDescription } from "./lib/analyzer";
import { buildEstimate, totals, updateLine } from "./lib/estimate";
import type { AnalysisResult, AppStep, CategoryId, EstimateDocument, EstimateLine, EstimateSettings, ParameterDefinition } from "./types";

const examples = [catalog[0].example, catalog[6].example, catalog[2].example];
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
    setStep("start");
    setAnalysis(null);
    setDocument(null);
    setDescription("");
    setSelectedCategory(undefined);
    setParameters({});
    localStorage.removeItem("smetapilot-draft");
  }

  function editLine(id: string, patch: Partial<EstimateLine>) {
    if (document) setDocument({ ...document, lines: document.lines.map(item => item.id === id ? updateLine(item, patch) : item) });
  }

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={startNew} aria-label="На главную"><span className="brand-mark"><Calculator size={20} /></span><span>Smeta<span>Pilot</span></span></button>
      {step !== "start" && <div className="progress" aria-label="Прогресс"><span className="done"><Check size={14} /> Описание</span><i /><span className={step !== "questions" ? "done" : "active"}>{step === "estimate" ? <Check size={14} /> : "2"} Уточнения</span><i /><span className={step === "estimate" ? "active" : ""}>3 Смета</span></div>}
      <div className="top-actions">{document && step === "start" && <button className="ghost-button" onClick={() => setStep("estimate")}><ClipboardList size={17} /> Черновик</button>}<span className="privacy"><ShieldCheck size={16} /> Данные хранятся локально</span></div>
    </header>

    <main>
      {step === "start" && <StartScreen description={description} setDescription={setDescription} selected={selectedCategory} setSelected={setSelectedCategory} loading={loading} error={error} onStart={startAnalysis} showAll={showAllCategories} setShowAll={setShowAllCategories} />}
      {step === "questions" && analysis && <QuestionsScreen analysis={analysis} parameters={parameters} setParameters={setParameters} settings={settings} setSettings={setSettings} onBack={() => setStep("start")} onCreate={createEstimate} />}
      {step === "estimate" && document && total && <EnhancedEstimateScreen document={document} setDocument={setDocument} total={total} onLineChange={editLine} onBack={() => setStep("questions")} onNew={startNew} />}
    </main>
  </div>;
}

function StartScreen({ description, setDescription, selected, setSelected, loading, error, onStart, showAll, setShowAll }: {
  description: string;
  setDescription: (value: string) => void;
  selected?: CategoryId;
  setSelected: (id?: CategoryId) => void;
  loading: boolean;
  error: string;
  onStart: () => void;
  showAll: boolean;
  setShowAll: (value: boolean) => void;
}) {
  const visibleCategories = showAll ? catalog : catalog.slice(0, 8);
  return <>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><Sparkles size={16} /> Умный мастер строительных смет</div>
        <h1>Опишите работу.<br /><span>Получите готовую<br />смету.</span></h1>
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
        <div className="pilot-card"><div className="card-orbit orbit-one" /><div className="card-orbit orbit-two" /><div className="pilot-head"><span><Sparkles size={20} /></span><div><small>SMETAPILOT</small><strong>От задачи до документа</strong></div></div>
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
  analysis: AnalysisResult;
  parameters: Record<string, string | number>;
  setParameters: (value: Record<string, string | number>) => void;
  settings: EstimateSettings;
  setSettings: (value: EstimateSettings) => void;
  onBack: () => void;
  onCreate: () => void;
}) {
  const category = categoryById(analysis.categoryId);
  const mainFields = category.parameters.filter(field => !field.advanced);
  const advancedFields = category.parameters.filter(field => field.advanced);

  return <section className="workspace-section">
    <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Изменить описание</button>
    <div className="workspace-title"><div><div className="eyebrow"><BadgeCheck size={16} /> Задачу понял</div><h1>{analysis.projectName}</h1><p>{category.description}. Проверьте значения — типовые параметры можно оставить как есть.</p></div><div className="confidence"><span>{Math.round(analysis.confidence * 100)}%</span><small>уверенность<br />распознавания</small></div></div>
    <div className="workspace-grid">
      <div className="questions-panel panel">
        <div className="panel-title"><div><span className="panel-icon"><ClipboardList /></span><div><small>ШАГ 2 ИЗ 3</small><h2>Уточните параметры</h2></div></div><span className="required-dot">● обязательные</span></div>
        <ParameterFields fields={mainFields} parameters={parameters} setParameters={setParameters} extracted={analysis.extracted} />
        {advancedFields.length > 0 && <details className="advanced-fields"><summary><span><Layers3 size={16} /> Точная настройка конструкции</span><span>{advancedFields.length} параметров <ChevronDown size={16} /></span></summary><p>Добавьте только то, что входит в проект. Нулевые слои и работы в смету не попадут.</p><ParameterFields fields={advancedFields} parameters={parameters} setParameters={setParameters} extracted={analysis.extracted} /></details>}
      </div>
      <aside className="settings-panel panel">
        <div className="panel-title"><div><span className="panel-icon"><Calculator /></span><div><small>ПАРАМЕТРЫ СМЕТЫ</small><h2>Цены и итог</h2></div></div></div>
        <label className="simple-field"><span><MapPin size={15} /> Регион</span><input value={settings.region} placeholder="Например, Москва" onChange={event => setSettings({ ...settings, region: event.target.value })} /></label>
        <div className="mode-field"><span>Как заполнять неизвестные цены</span>{[["mine", "Только мои цены", "Неизвестные цены останутся пустыми"], ["typical", "Типовые значения", "Помечать как допущение"], ["search", "Найти цены · скоро", "Подключим проверенные источники"]].map(([value, label, note]) => <button key={value} disabled={value === "search"} className={settings.priceMode === value ? "active" : ""} onClick={() => setSettings({ ...settings, priceMode: value as EstimateSettings["priceMode"] })}><span className="radio">{settings.priceMode === value && <i />}</span><span><strong>{label}</strong><small>{note}</small></span>{value === "search" && <Search size={16} />}</button>)}</div>
        <div className="percent-grid"><label><span>Накладные</span><div><input type="number" value={settings.overhead} onChange={event => setSettings({ ...settings, overhead: Number(event.target.value) })} /><em>%</em></div></label><label><span>Прибыль</span><div><input type="number" value={settings.profit} onChange={event => setSettings({ ...settings, profit: Number(event.target.value) })} /><em>%</em></div></label><label><span>НДС</span><div><input type="number" value={settings.vat} onChange={event => setSettings({ ...settings, vat: Number(event.target.value) })} /><em>%</em></div></label></div>
        <div className="settings-note"><ShieldCheck size={17} /><span>Все типовые значения будут отдельно отмечены в готовой смете.</span></div>
      </aside>
    </div>
    <div className="sticky-action"><div><strong>{category.name}</strong><span>{category.parameters.filter(field => parameters[field.id] !== undefined && parameters[field.id] !== "").length} из {category.parameters.length} параметров заполнено</span></div><button className="primary-button large" onClick={onCreate}>Рассчитать смету <ArrowRight size={19} /></button></div>
  </section>;
}

function ParameterFields({ fields, parameters, setParameters, extracted }: {
  fields: ParameterDefinition[];
  parameters: Record<string, string | number>;
  setParameters: (value: Record<string, string | number>) => void;
  extracted: Record<string, string | number>;
}) {
  return <div className="fields-grid">{fields.map(field => <label className={`field-card ${field.important ? "important" : ""}`} key={field.id}><span>{field.label}{field.important && <i>●</i>}</span><div className="input-shell">
    {field.kind === "select" ? <select value={parameters[field.id] ?? field.defaultValue ?? ""} onChange={event => setParameters({ ...parameters, [field.id]: event.target.value })}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={field.kind} inputMode={field.kind === "number" ? "decimal" : undefined} value={parameters[field.id] ?? ""} placeholder={field.placeholder} onChange={event => setParameters({ ...parameters, [field.id]: field.kind === "number" ? numberValue(event.target.value) : event.target.value })} />}
    {field.unit && <em>{field.unit}</em>}</div>{field.help ? <small><CircleHelp size={12} /> {field.help}</small> : field.defaultValue !== undefined && !extracted[field.id] && <small><WandSparkles size={12} /> Типовое значение — можно изменить</small>}</label>)}</div>;
}

export default App;
