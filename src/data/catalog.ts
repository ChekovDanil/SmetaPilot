import type { CategoryDefinition, CategoryId, ParameterDefinition } from "../types";

const area = (label = "Площадь работ"): ParameterDefinition => ({ id: "area", label, shortLabel: "Площадь", kind: "number", unit: "м²", placeholder: "700", important: true });
const price = (label = "Цена работ"): ParameterDefinition => ({ id: "workPrice", label, shortLabel: "Работы", kind: "number", unit: "₽/м²", placeholder: "1 400" });
const thickness = (id: string, label: string, value: number): ParameterDefinition => ({ id, label, shortLabel: label, kind: "number", unit: "см", defaultValue: value, important: true });
const select = (id: string, label: string, values: string[]): ParameterDefinition => ({ id, label, shortLabel: label, kind: "select", options: values.map(value => ({ label: value, value })), defaultValue: values[0] });
const item = (group: "Работы" | "Материалы" | "Техника" | "Транспорт" | "Прочее", name: string, unit: string) => ({ group, name, unit });

export const catalog: CategoryDefinition[] = [
  {
    id: "roads", name: "Дорожные работы", shortName: "Дороги", description: "Асфальтирование, основания, бордюры и площадки", keywords: ["дорог", "асфальт", "щеб", "бордюр", "парков", "тротуар"],
    example: "Асфальтирование 700 м², слой 5 см, основание щебень 15 см. Асфальт 7 000 ₽/т.",
    parameters: [
      area(),
      thickness("asphaltThickness", "Слой асфальта", 5),
      thickness("baseThickness", "Основание из щебня", 15),
      { id: "asphaltPrice", label: "Цена асфальта", shortLabel: "Асфальт", kind: "number", unit: "₽/т", placeholder: "7 000" },
      price(),
      select("workPriceScope", "Что входит в цену работ", ["Только работы", "Работы и техника", "Всё с материалами"]),
      { id: "excavationDepth", label: "Выемка грунта", shortLabel: "Выемка", kind: "number", unit: "см", defaultValue: 0, advanced: true, help: "Оставьте 0, если земляные работы не нужны" },
      { id: "excavationPrice", label: "Разработка и вывоз грунта", shortLabel: "Грунт", kind: "number", unit: "₽/м³", advanced: true },
      { id: "geotextile", label: "Геотекстиль", shortLabel: "Геотекстиль", kind: "select", options: [{ label: "Не нужен", value: "Нет" }, { label: "Нужен", value: "Да" }], defaultValue: "Нет", advanced: true },
      { id: "geotextilePrice", label: "Цена геотекстиля", shortLabel: "Геотекстиль", kind: "number", unit: "₽/м²", advanced: true },
      { id: "sandThickness", label: "Песчаный слой", shortLabel: "Песок", kind: "number", unit: "см", defaultValue: 0, advanced: true },
      { id: "sandPrice", label: "Цена песка", shortLabel: "Песок", kind: "number", unit: "₽/т", advanced: true },
      { id: "crushedStonePrice", label: "Цена щебня", shortLabel: "Щебень", kind: "number", unit: "₽/т", advanced: true },
      { id: "curbLength", label: "Длина бордюров", shortLabel: "Бордюр", kind: "number", unit: "м", defaultValue: 0, advanced: true },
      { id: "curbPrice", label: "Цена бордюра", shortLabel: "Бордюр", kind: "number", unit: "₽/м", advanced: true },
      { id: "machineShiftPrice", label: "Комплект дорожной техники", shortLabel: "Техника", kind: "number", unit: "₽/смена", advanced: true },
      { id: "deliveryPrice", label: "Стоимость одного рейса", shortLabel: "Доставка", kind: "number", unit: "₽/рейс", advanced: true },
      { id: "asphaltDensity", label: "Плотность асфальта", shortLabel: "Плотность", kind: "number", unit: "т/м³", defaultValue: 2.35, advanced: true },
      { id: "asphaltWaste", label: "Запас асфальта", shortLabel: "Запас", kind: "number", unit: "%", defaultValue: 3, advanced: true },
      { id: "baseDensity", label: "Насыпная плотность щебня", shortLabel: "Плотность", kind: "number", unit: "т/м³", defaultValue: 1.45, advanced: true },
      { id: "baseWaste", label: "Запас щебня", shortLabel: "Запас", kind: "number", unit: "%", defaultValue: 5, advanced: true },
      { id: "sandDensity", label: "Насыпная плотность песка", shortLabel: "Плотность", kind: "number", unit: "т/м³", defaultValue: 1.6, advanced: true },
      { id: "sandWaste", label: "Запас песка", shortLabel: "Запас", kind: "number", unit: "%", defaultValue: 5, advanced: true }
    ],
    defaultItems: [item("Работы", "Разбивка и подготовка участка", "м²"), item("Работы", "Устройство щебёночного основания", "м²"), item("Работы", "Укладка асфальтобетонной смеси", "м²"), item("Материалы", "Щебень", "т"), item("Материалы", "Асфальтобетонная смесь", "т"), item("Техника", "Каток и асфальтоукладчик", "смена"), item("Транспорт", "Доставка материалов", "рейс")]
  },
  {
    id: "earthworks", name: "Земляные работы", shortName: "Земляные", description: "Котлованы, траншеи, планировка и вывоз грунта", keywords: ["котлован", "транше", "грунт", "землян", "выем"], example: "Котлован 420 м³ с погрузкой и вывозом грунта на 15 км.",
    parameters: [{ id: "volume", label: "Объём грунта", shortLabel: "Объём", kind: "number", unit: "м³", important: true }, select("soil", "Категория грунта", ["Обычный грунт", "Плотный грунт", "Скальный грунт"]), { id: "distance", label: "Расстояние вывоза", shortLabel: "Вывоз", kind: "number", unit: "км", defaultValue: 10 }],
    defaultItems: [item("Работы", "Разработка грунта", "м³"), item("Техника", "Работа экскаватора", "маш.-ч"), item("Транспорт", "Вывоз грунта", "м³"), item("Работы", "Планировка основания", "м²")]
  },
  {
    id: "concrete", name: "Фундаменты и бетон", shortName: "Бетон", description: "Плиты, ленты, монолитные конструкции и стяжки", keywords: ["фундамент", "бетон", "монолит", "стяж", "плита"], example: "Монолитная плита 180 м² толщиной 250 мм, бетон B25.",
    parameters: [area(), thickness("concreteThickness", "Толщина конструкции", 25), select("concreteClass", "Класс бетона", ["B25", "B20", "B30"]), { id: "concretePrice", label: "Цена бетона", shortLabel: "Бетон", kind: "number", unit: "₽/м³" }],
    defaultItems: [item("Работы", "Устройство опалубки", "м²"), item("Работы", "Армирование", "т"), item("Работы", "Бетонирование", "м³"), item("Материалы", "Бетонная смесь", "м³"), item("Материалы", "Арматура", "т"), item("Техника", "Бетононасос", "смена")]
  },
  {
    id: "masonry", name: "Кладка и стены", shortName: "Кладка", description: "Кирпич, блоки, перегородки и перекрытия", keywords: ["кладк", "кирпич", "блок", "газобет", "стен", "перегород"], example: "Перегородки из газоблока 100 мм, общая площадь 240 м².",
    parameters: [area("Площадь стен"), select("material", "Материал стен", ["Газобетон", "Кирпич", "Керамический блок"]), thickness("wallThickness", "Толщина стены", 10), { id: "height", label: "Высота этажа", shortLabel: "Высота", kind: "number", unit: "м", defaultValue: 3 }],
    defaultItems: [item("Работы", "Кладка стен", "м²"), item("Материалы", "Стеновой материал", "м³"), item("Материалы", "Кладочная смесь", "кг"), item("Работы", "Армирование кладки", "м.п.")]
  },
  {
    id: "roofing", name: "Кровельные работы", shortName: "Кровля", description: "Скатные и плоские кровли, утепление и водосток", keywords: ["кровл", "крыша", "мембран", "черепиц", "профлист"], example: "Мягкая кровля 320 м², утеплитель 200 мм, демонтаж старого покрытия.",
    parameters: [area("Площадь кровли"), select("roofType", "Тип кровли", ["Мягкая кровля", "ПВХ-мембрана", "Металлочерепица", "Профлист"]), thickness("insulation", "Толщина утепления", 20), select("dismantling", "Демонтаж", ["Не нужен", "Нужен"])],
    defaultItems: [item("Работы", "Подготовка основания", "м²"), item("Материалы", "Пароизоляция", "м²"), item("Материалы", "Утеплитель", "м³"), item("Работы", "Монтаж покрытия", "м²"), item("Материалы", "Кровельное покрытие", "м²")]
  },
  {
    id: "facades", name: "Фасады", shortName: "Фасады", description: "Штукатурные и вентилируемые фасады, утепление", keywords: ["фасад", "утеплен", "штукатур", "облицов"], example: "Мокрый фасад 850 м², утеплитель минвата 100 мм.",
    parameters: [area("Площадь фасада"), select("facadeType", "Система фасада", ["Мокрый фасад", "Вентилируемый фасад", "Облицовочный кирпич"]), thickness("insulation", "Толщина утеплителя", 10)],
    defaultItems: [item("Работы", "Подготовка фасада", "м²"), item("Материалы", "Утеплитель", "м²"), item("Работы", "Монтаж фасадной системы", "м²"), item("Материалы", "Финишное покрытие", "м²"), item("Техника", "Леса / подъёмник", "смена")]
  },
  {
    id: "interiors", name: "Ремонт и отделка", shortName: "Отделка", description: "Квартиры, офисы, коммерческие и общественные помещения", keywords: ["ремонт", "отделк", "шпакл", "покраск", "плитк", "потол"], example: "Ремонт офиса 300 м²: стены под покраску, потолок Армстронг, кварцвинил.",
    parameters: [area("Площадь помещения"), select("finishClass", "Уровень отделки", ["Стандарт", "Эконом", "Премиум"]), { id: "ceilingHeight", label: "Высота потолка", shortLabel: "Высота", kind: "number", unit: "м", defaultValue: 2.8 }],
    defaultItems: [item("Работы", "Подготовка поверхностей", "м²"), item("Работы", "Отделка стен", "м²"), item("Работы", "Устройство потолка", "м²"), item("Работы", "Устройство пола", "м²"), item("Материалы", "Черновые материалы", "компл."), item("Материалы", "Чистовые материалы", "компл.")]
  },
  {
    id: "electrical", name: "Электромонтаж", shortName: "Электрика", description: "Кабельные линии, щиты, освещение и слаботочные сети", keywords: ["электр", "кабель", "розет", "освещ", "щит", "слаботоч"], example: "Электромонтаж офиса 450 м², 80 розеток и 60 светильников.",
    parameters: [area("Площадь объекта"), { id: "points", label: "Количество точек", shortLabel: "Точки", kind: "number", unit: "шт.", important: true }, select("installType", "Способ прокладки", ["Скрытая", "Открытая", "В лотках"])],
    defaultItems: [item("Работы", "Прокладка кабеля", "м"), item("Материалы", "Кабельная продукция", "м"), item("Работы", "Монтаж электроустановочных изделий", "шт."), item("Материалы", "Щитовое оборудование", "компл."), item("Работы", "Пусконаладочные работы", "компл.")]
  },
  {
    id: "plumbing", name: "Водоснабжение и канализация", shortName: "ВК", description: "Трубопроводы, сантехника, насосы и очистка", keywords: ["водоснаб", "канализ", "сантех", "труб", "водопровод"], example: "Разводка воды и канализации в доме 180 м², 3 санузла.",
    parameters: [area("Площадь объекта"), { id: "points", label: "Количество сантехнических точек", shortLabel: "Точки", kind: "number", unit: "шт." }, select("pipe", "Материал труб", ["Полипропилен", "Сшитый полиэтилен", "Медь"])],
    defaultItems: [item("Работы", "Монтаж трубопроводов", "м"), item("Материалы", "Трубы и фитинги", "компл."), item("Работы", "Монтаж сантехнических приборов", "шт."), item("Работы", "Испытание системы", "компл.")]
  },
  {
    id: "hvac", name: "Отопление и вентиляция", shortName: "ОВиК", description: "Отопление, вентиляция, кондиционирование и автоматика", keywords: ["отоплен", "вентил", "кондиц", "овик", "радиатор"], example: "Вентиляция магазина 900 м², приточно-вытяжная система с рекуперацией.",
    parameters: [area("Площадь объекта"), select("system", "Инженерная система", ["Вентиляция", "Отопление", "Кондиционирование"]), { id: "capacity", label: "Производительность / мощность", shortLabel: "Мощность", kind: "number", unit: "кВт или м³/ч" }],
    defaultItems: [item("Материалы", "Основное оборудование", "компл."), item("Материалы", "Воздуховоды / трубопроводы", "м"), item("Работы", "Монтаж системы", "компл."), item("Работы", "Автоматика и пусконаладка", "компл.")]
  },
  {
    id: "utilities", name: "Наружные инженерные сети", shortName: "Сети", description: "Водопровод, канализация, теплосети, газ и кабельные трассы", keywords: ["наружн", "сети", "теплотрас", "ливнев", "коллектор", "газопровод"], example: "Наружная канализация 180 м, труба 200 мм, глубина 2,2 м.",
    parameters: [{ id: "length", label: "Длина трассы", shortLabel: "Длина", kind: "number", unit: "м", important: true }, { id: "depth", label: "Средняя глубина", shortLabel: "Глубина", kind: "number", unit: "м", defaultValue: 1.8 }, select("networkType", "Тип сети", ["Канализация", "Водопровод", "Теплосеть", "Кабельная линия"])],
    defaultItems: [item("Работы", "Разработка траншеи", "м³"), item("Материалы", "Трубопровод / кабель", "м"), item("Работы", "Монтаж сети", "м"), item("Работы", "Обратная засыпка", "м³"), item("Работы", "Испытания", "компл.")]
  },
  {
    id: "landscaping", name: "Благоустройство", shortName: "Благоустройство", description: "Озеленение, покрытия, площадки и малые формы", keywords: ["благоустр", "газон", "озелен", "площадк", "брусчат"], example: "Благоустройство двора 1200 м²: газон, дорожки из брусчатки и освещение.",
    parameters: [area("Площадь территории"), select("covering", "Основное покрытие", ["Газон", "Брусчатка", "Резиновое покрытие", "Комбинированное"])],
    defaultItems: [item("Работы", "Планировка территории", "м²"), item("Работы", "Устройство покрытий", "м²"), item("Материалы", "Материалы покрытий", "м²"), item("Работы", "Озеленение", "м²"), item("Материалы", "Малые архитектурные формы", "компл.")]
  },
  {
    id: "demolition", name: "Демонтаж", shortName: "Демонтаж", description: "Разборка зданий, конструкций и инженерных систем", keywords: ["демонтаж", "снос", "разборк"], example: "Демонтаж кирпичного здания 2 этажа, площадь 600 м² с вывозом мусора.",
    parameters: [area("Площадь демонтажа"), select("structure", "Тип конструкций", ["Кирпич", "Железобетон", "Металл", "Смешанные"]), { id: "distance", label: "Плечо вывоза", shortLabel: "Вывоз", kind: "number", unit: "км", defaultValue: 15 }],
    defaultItems: [item("Работы", "Подготовительные мероприятия", "компл."), item("Работы", "Демонтаж конструкций", "м²"), item("Техника", "Работа спецтехники", "смена"), item("Транспорт", "Погрузка и вывоз отходов", "т"), item("Прочее", "Утилизация", "т")]
  },
  {
    id: "steel", name: "Металлоконструкции", shortName: "Металл", description: "Изготовление и монтаж каркасов, ферм и ограждений", keywords: ["металлокон", "ферм", "каркас", "балк", "колонн"], example: "Изготовление и монтаж металлокаркаса здания, масса 48 тонн.",
    parameters: [{ id: "weight", label: "Масса конструкций", shortLabel: "Масса", kind: "number", unit: "т", important: true }, select("complexity", "Сложность", ["Типовые конструкции", "Средняя сложность", "Сложные конструкции"])],
    defaultItems: [item("Материалы", "Металлопрокат", "т"), item("Работы", "Изготовление конструкций", "т"), item("Работы", "Антикоррозионная защита", "м²"), item("Работы", "Монтаж конструкций", "т"), item("Техника", "Кран", "смена")]
  },
  {
    id: "timber", name: "Деревянные конструкции", shortName: "Дерево", description: "Каркасные дома, перекрытия, террасы и столярные работы", keywords: ["дерев", "каркасн", "брус", "террас", "стропил"], example: "Каркасный дом 140 м², один этаж, утепление 200 мм.",
    parameters: [area("Площадь конструкций"), select("structure", "Тип конструкции", ["Каркас здания", "Перекрытие", "Терраса", "Стропильная система"])],
    defaultItems: [item("Материалы", "Пиломатериал", "м³"), item("Материалы", "Крепёж и защита", "компл."), item("Работы", "Изготовление элементов", "м³"), item("Работы", "Монтаж конструкций", "м²")]
  },
  {
    id: "windows", name: "Окна и светопрозрачные конструкции", shortName: "Окна", description: "Окна, витражи, двери и алюминиевые системы", keywords: ["окн", "витраж", "остеклен", "двер", "стеклопак"], example: "Замена 24 окон размером 1,5 × 1,4 м с откосами и отливами.",
    parameters: [{ id: "count", label: "Количество изделий", shortLabel: "Количество", kind: "number", unit: "шт.", important: true }, { id: "area", label: "Общая площадь", shortLabel: "Площадь", kind: "number", unit: "м²" }, select("profile", "Система", ["ПВХ", "Тёплый алюминий", "Холодный алюминий"])],
    defaultItems: [item("Работы", "Демонтаж существующих изделий", "шт."), item("Материалы", "Светопрозрачные конструкции", "м²"), item("Работы", "Монтаж изделий", "шт."), item("Материалы", "Откосы и отливы", "м.п.")]
  }
];

export const categoryById = (id: CategoryId) => catalog.find(category => category.id === id) ?? catalog[0];
