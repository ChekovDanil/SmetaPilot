import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Calculator, Check, ChevronDown,
  CircleHelp, ClipboardList, FileDown, HardHat, Layers3, MapPin, Search,
  ShieldCheck, WandSparkles
} from "lucide-react";
import { catalog, categoryById } from "./data/catalog";
import EnhancedEstimateScreen from "./components/EnhancedEstimateScreen";
import { analyzeDescription } from "./lib/analyzer";
import { buildEstimate, totals, updateLine } from "./lib/estimate";
import type { AnalysisResult, AppStep, CategoryId, EstimateDocument, EstimateLine, EstimateSettings, ParameterDefinition } from "./types";

const examples = [catalog[0].example, catalog[6].example, catalog[2].example];
const numberValue = (value: string) => value === "" ? "" : Number(value.replace(/\s/g, "").replace(",", "."));

function BrandMark({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-mark ${compact ? "compact" : ""}`} aria-hidden="true">
    <span className="brand-sigma">Σ</span>
    <i className="brand-dimension" />
  </span>;
}

function TechnicalMark() {
  return <span className="technical-mark" aria-hidden="true"><span>Σ</span><i /></span>;
}

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
      <button className="brand" onClick={startNew} aria-label="На главную">
        <BrandMark />
        <span className="brand-word"><span className="brand-name">Smeta<span>Pilot</span></span><small>строительные сметы</small></span>
      </button>
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
  const visibleCategories = showAll ? catalog : catalog.slice(0, 6);

  return <div className="landing-v2">
    <section className="landing-v2-hero">
      <div className="landing-v2-copy">
        <div className="landing-kicker">Строительные сметы и расчёты</div>
        <h1>Опишите объект.<br /><span>Получите готовую смету.</span></h1>
        <p className="landing-lead">Работы, материалы, техника и физические объёмы — из обычного описания проекта. Без сложных форм и десятков лишних полей.</p>

        <div className="landing-composer">
          <label htmlFor="estimate-description">Что нужно рассчитать?</label>
          {selected && <div className="selected-category"><HardHat size={15} /> {categoryById(selected).name}<button onClick={() => setSelected(undefined)} aria-label="Убрать направление">×</button></div>}
          <textarea id="estimate-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Например: асфальтирование 700 м², слой 50 мм, основание — щебень 150 мм. Работа 1 400 ₽/м², асфальт 7 000 ₽ за тонну." maxLength={4000} />
          <div className="landing-composer-footer">
            <div className="landing-example-chips">
              <span>Примеры</span>
              {examples.map((example, index) => <button key={example} onClick={() => { setDescription(example); setSelected(index === 0 ? "roads" : index === 1 ? "interiors" : "concrete"); }}>{index === 0 ? "Дорога" : index === 1 ? "Ремонт" : "Фундамент"}</button>)}
            </div>
            <button className="landing-cta" onClick={onStart} disabled={loading}>{loading ? <><span className="spinner" /> Анализирую</> : <>Рассчитать смету <ArrowRight size={20} /></>}</button>
          </div>
        </div>
        {error && <div className="form-error"><CircleHelp size={17} /> {error}</div>}

        <div className="landing-proofline">
          <span><ShieldCheck size={18} /> Без регистрации</span>
          <span><Calculator size={18} /> Прозрачные формулы</span>
          <span><FileDown size={18} /> PDF и Excel</span>
        </div>
      </div>

      <div className="landing-v2-visual">
        <div className="construction-section" aria-hidden="true">
          <div className="section-measure section-measure-top">700 м²</div>
          <div className="road-slice">
            <div className="road-layer asphalt"><span>Асфальтобетон</span><b>50 мм</b></div>
            <div className="road-layer crushed"><span>Щебёночное основание</span><b>150 мм</b></div>
            <div className="road-layer base"><span>Подготовленное основание</span><b>проект</b></div>
          </div>
          <div className="section-measure section-measure-side">200 мм</div>
        </div>

        <div className="estimate-preview-card">
          <div className="preview-head">
            <div><span>Смета № SP-0248</span><strong>Дорожные работы — 700 м²</strong></div>
            <em>Предварительная</em>
          </div>
          <div className="preview-table">
            <div className="preview-row preview-row-head"><span>Позиция</span><span>Объём</span><span>Стоимость</span></div>
            <div className="preview-row"><strong>Подготовка основания</strong><span>700 м²</span><b>98 000 ₽</b></div>
            <div className="preview-row"><strong>Щебень</strong><span>159,8 т</span><b>191 760 ₽</b></div>
            <div className="preview-row"><strong>Асфальтобетон</strong><span>84,7 т</span><b>593 023 ₽</b></div>
          </div>
          <div className="preview-summary">
            <div><span>Текущий итог</span><strong>845 413 ₽</strong></div>
            <div className="preview-formats"><span>PDF</span><span>XLSX</span></div>
          </div>
        </div>
      </div>
    </section>

    <section className="landing-process">
      <div className="landing-section-heading">
        <span>Как это работает</span>
        <h2>От описания до документа — три понятных шага</h2>
      </div>
      <div className="process-grid">
        <article><span>01</span><div><h3>Опишите объект</h3><p>Напишите обычными словами вид работ, площадь, объёмы и известные цены.</p></div></article>
        <article><span>02</span><div><h3>Уточните главное</h3><p>SmetaPilot спросит только параметры, которые действительно влияют на расчёт.</p></div></article>
        <article><span>03</span><div><h3>Получите смету</h3><p>Редактируйте позиции и цены, затем выгружайте документ в PDF или Excel.</p></div></article>
      </div>
    </section>

    <section className="landing-directions">
      <div className="landing-section-heading split">
        <div><span>Направления</span><h2>Сметы для основных видов строительных работ</h2></div>
        <button onClick={() => setShowAll(!showAll)}>{showAll ? "Свернуть" : `Все ${catalog.length} направлений`} <ChevronDown size={19} className={showAll ? "rotate" : ""} /></button>
      </div>
      <div className="landing-category-grid">{visibleCategories.map((category, index) => <button key={category.id} className={`landing-category-card ${selected === category.id ? "selected" : ""}`} onClick={() => setSelected(selected === category.id ? undefined : category.id)}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <div><strong>{category.shortName}</strong><p>{category.description}</p></div>
        <ArrowRight size={20} />
      </button>)}</div>
    </section>

    <section className="landing-calculation">
      <div className="calculation-copy">
        <span className="landing-section-label">Прозрачный расчёт</span>
        <h2>Понятно, откуда берётся каждая цифра</h2>
        <p>Физические объёмы рассчитываются по формулам, а исходные параметры остаются видимыми. Пользователь может проверить и изменить любое значение.</p>
        <div className="calculation-note"><Calculator size={21} /><span><strong>Никакой магии.</strong> Площадь, толщина, плотность и запас превращаются в понятный объём материала.</span></div>
      </div>
      <div className="calculation-flow" aria-label="Пример расчёта асфальтобетона">
        <div><span>Площадь</span><strong>700 м²</strong></div><i>×</i>
        <div><span>Толщина</span><strong>0,05 м</strong></div><i>=</i>
        <div><span>Объём</span><strong>35 м³</strong></div><i>×</i>
        <div><span>Плотность</span><strong>2,35 т/м³</strong></div><i>+</i>
        <div className="accent"><span>Запас 3%</span><strong>84,72 т</strong></div>
      </div>
    </section>

    <section className="landing-document">
      <div className="document-preview">
        <div className="document-preview-top"><BrandMark compact /><div><span>SMETAPILOT</span><strong>Смета на дорожные работы</strong></div></div>
        <div className="document-lines"><i /><i /><i /><i /><i /></div>
        <div className="document-total"><span>Итого с НДС</span><strong>845 412,88 ₽</strong></div>
      </div>
      <div className="document-copy">
        <span className="landing-section-label">Готовый документ</span>
        <h2>Смета, которую можно отправить заказчику</h2>
        <p>Структурированный PDF для согласования и Excel для дальнейшей работы. В документе видны позиции, объёмы, цены, итоги и допущения.</p>
        <div className="document-features"><span><Check size={18} /> Работы и материалы</span><span><Check size={18} /> Итоги и НДС</span><span><Check size={18} /> Допущения расчёта</span></div>
      </div>
    </section>

    <section className="landing-final-strip">
      <div><ShieldCheck size={22} /><span><strong>Данные остаются у вас</strong>Проекты сохраняются локально на устройстве.</span></div>
      <div><Layers3 size={22} /><span><strong>Расчёт можно проверить</strong>Формулы и источники значений видны в смете.</span></div>
      <div><FileDown size={22} /><span><strong>Результат готов к работе</strong>Редактирование, PDF и XLSX в одном сценарии.</span></div>
    </section>
  </div>;
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
    <div className="workspace-title"><div><div className="eyebrow"><TechnicalMark /> Задача распознана</div><h1>{analysis.projectName}</h1><p>{category.description}. Проверьте значения — типовые параметры можно оставить как есть.</p></div><div className="confidence"><span>{Math.round(analysis.confidence * 100)}%</span><small>уверенность<br />распознавания</small></div></div>
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