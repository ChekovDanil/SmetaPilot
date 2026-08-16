export type CategoryId =
  | "roads" | "earthworks" | "concrete" | "masonry" | "roofing" | "facades"
  | "interiors" | "electrical" | "plumbing" | "hvac" | "utilities" | "landscaping"
  | "demolition" | "steel" | "timber" | "windows";

export type FieldKind = "number" | "text" | "select";

export interface ParameterDefinition {
  id: string;
  label: string;
  shortLabel: string;
  kind: FieldKind;
  unit?: string;
  placeholder?: string;
  defaultValue?: string | number;
  options?: { label: string; value: string }[];
  important?: boolean;
}

export interface CategoryDefinition {
  id: CategoryId;
  name: string;
  shortName: string;
  description: string;
  keywords: string[];
  example: string;
  parameters: ParameterDefinition[];
  defaultItems: Omit<EstimateLine, "id" | "quantity" | "unitPrice" | "total" | "source">[];
}

export type ValueSource = "user" | "formula" | "typical" | "found" | "missing";

export interface EstimateLine {
  id: string;
  group: "Работы" | "Материалы" | "Техника" | "Транспорт" | "Прочее";
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  source: ValueSource;
}

export interface AnalysisResult {
  categoryId: CategoryId;
  projectName: string;
  confidence: number;
  extracted: Record<string, string | number>;
  notes: string[];
  usedAi: boolean;
}

export interface EstimateSettings {
  region: string;
  priceMode: "mine" | "typical" | "search";
  overhead: number;
  profit: number;
  vat: number;
}

export interface EstimateDocument {
  title: string;
  categoryId: CategoryId;
  createdAt: string;
  sourceText: string;
  parameters: Record<string, string | number>;
  settings: EstimateSettings;
  lines: EstimateLine[];
  assumptions: string[];
}

export type AppStep = "start" | "questions" | "estimate";
