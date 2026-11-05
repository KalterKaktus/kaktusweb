/** Public, data-only catalogue. Money is fictional Kaktus-Taler, stored as integers. */
export const TRANSLATIONS = { de: {}, ru: {} };
function words(path, de, ru) {
  for (const [lang, value] of [['de', de], ['ru', ru]]) {
    const bits = path.split('.');
    let target = TRANSLATIONS[lang];
    for (const part of bits.slice(0, -1)) target = target[part] ??= {};
    target[bits.at(-1)] = value;
  }
  return `life.${path}`;
}
function text(group, id, de, ru, descDe, descRu) {
  return {
    title: words(`${group}.${id}.title`, de, ru),
    description: words(`${group}.${id}.description`, descDe, descRu),
  };
}
export const RULES = Object.freeze({
  startCash: 40000, careerBonus: 20000, tuition: 60000, loanUnit: 10000,
  loanInterest: 0.10, happinessValue: 5000, partnerValue: 25000,
  childValue: 35000, childUpkeep: 2500, rent: 3000,
  insuranceCost: 18000, maxChildren: 3, retirement: 80,
});

export const CAREERS = [
  { id: 'maker', degree: false, salary: 25000, houseDiscount: 15000,
    ...text('careers', 'maker', 'Werkstattprofi', 'Мастерская', '25.000 je Zahltag. Dein Haus kostet 15.000 weniger.', '25 000 в день зарплаты. Скидка на дом — 15 000.') },
  { id: 'ranger', degree: false, salary: 25000, freeInsurance: true,
    ...text('careers', 'ranger', 'Naturhüter', 'Хранитель природы', '25.000 je Zahltag. Versicherung ist inklusive.', '25 000 в день зарплаты. Страховка включена.') },
  { id: 'creator', degree: false, salary: 22000, variableBonus: 8000,
    ...text('careers', 'creator', 'Kreativstudio', 'Творческая студия', '22.000 plus 0–8.000 Auftragsbonus je Zahltag.', '22 000 плюс бонус за заказы от 0 до 8 000 в день зарплаты.') },
  { id: 'engineer', degree: true, salary: 36000, investmentBonus: 0.02,
    ...text('careers', 'engineer', 'Energie-Ingenieur', 'Инженер энергетики', '36.000 je Zahltag. Anlagen erhalten zusätzlich 2 % Rendite.', '36 000 в день зарплаты. Доходность вложений выше на 2 %.') },
  { id: 'doctor', degree: true, salary: 35000, freeInsurance: true,
    ...text('careers', 'doctor', 'Kaktus-Medizin', 'Кактусовая медицина', '35.000 je Zahltag. Versicherung ist inklusive.', '35 000 в день зарплаты. Страховка включена.') },
  { id: 'scientist', degree: true, salary: 34000, researchGrant: 17000,
    ...text('careers', 'scientist', 'Zukunftsforschung', 'Исследователь будущего', '34.000 je Zahltag. Je 17.000 Forschungsprämie auf Feld 48 und 64.', '34 000 в день зарплаты. Премия 17 000 на клетках 48 и 64.') },
];
export const HOUSES = [
  { id: 'cottage', cost: 70000, value: 110000, upkeep: 2000, happiness: 1,
    ...text('houses', 'cottage', 'Kleines Gartenhaus', 'Садовый домик', '70.000 Kaufpreis · 2.000 Unterhalt je Zahltag · 110.000 Endwert · +1 Glück.', 'Цена 70 000 · содержание 2 000 в день зарплаты · итоговая стоимость 110 000 · +1 радость.') },
  { id: 'townhouse', cost: 130000, value: 185000, upkeep: 3000, happiness: 2,
    ...text('houses', 'townhouse', 'Buntes Stadthaus', 'Яркий городской дом', '130.000 Kaufpreis · 3.000 Unterhalt je Zahltag · 185.000 Endwert · +2 Glück.', 'Цена 130 000 · содержание 3 000 в день зарплаты · итоговая стоимость 185 000 · +2 радости.') },
  { id: 'villa', cost: 200000, value: 270000, upkeep: 4000, happiness: 3,
    ...text('houses', 'villa', 'Sonnenvilla', 'Солнечная вилла', '200.000 Kaufpreis · 4.000 Unterhalt je Zahltag · 270.000 Endwert · +3 Glück.', 'Цена 200 000 · содержание 4 000 в день зарплаты · итоговая стоимость 270 000 · +3 радости.') },
];

const milestones = [
  [0, 'departure', 'Dein erster eigener Weg', 'Твой собственный путь', 'Direkt Geld verdienen oder mit einem Studienkredit starten?', 'Начать работать сразу или взять кредит на учёбу?'],
  [8, 'qualification', 'Ein Beruf fürs Leben?', 'Профессия на всю жизнь?', 'Ein neuer Abschluss oder ein erster beruflicher Meilenstein.', 'Новый диплом или первый профессиональный рубеж.'],
  [16, 'firstRoute', 'Welche Richtung fühlt sich richtig an?', 'Куда зовёт дорога?', 'Sicherheit federt Verluste ab. Abenteuer verstärkt Gewinne und Risiken.', 'Спокойный путь смягчает потери. Приключения усиливают доходы и риск.'],
  [24, 'partner', 'Zu zweit oder ganz bei dir?', 'Вместе или своим путём?', 'Eine Partnerschaft und ein unabhängiges Leben können beide reich machen.', 'И отношения, и самостоятельная жизнь могут быть счастливыми.'],
  [32, 'home', 'Ein Ort zum Ankommen', 'Место, которое зовётся домом', 'Kaufen oder weiter mieten? Fehlendes Geld wird transparent als Kredit verbucht.', 'Купить жильё или снимать? Недостающая сумма становится кредитом.'],
  [40, 'family', 'Deine kleine große Familie', 'Твоя маленькая большая семья', 'Kinder bringen Erinnerungen, kosten aber 12.000 zum Start und 2.500 je Zahltag.', 'Дети дарят воспоминания, но требуют 12 000 вначале и 2 500 в день зарплаты.'],
  [48, 'careerChange', 'Zeit für ein neues Kapitel', 'Время новой главы', 'Mehr Verantwortung, mehr freie Zeit oder ein eigenes kleines Unternehmen?', 'Больше ответственности, больше свободного времени или своё дело?'],
  [56, 'secondRoute', 'Noch einmal neu abbiegen', 'Новый поворот', 'Du kannst deinen Lebensstil jetzt ändern. Bestehende Versicherungen bleiben bestehen.', 'Сейчас можно изменить образ жизни. Страховка продолжает действовать.'],
  [64, 'investment', 'Was soll aus deinem Geld werden?', 'Как распорядиться деньгами?', 'Anlagen schwanken an jedem Zahltag. Liquidität und Schuldentilgung bieten Alternativen.', 'Вложения меняются в каждый день зарплаты. Можно сохранить деньги или погасить долги.'],
  [72, 'legacy', 'Was bleibt, ist deine Geschichte', 'Твоя история остаётся', 'Geld, Gemeinschaft und Erinnerungen zählen im Finale.', 'В финале ценятся деньги, близкие и воспоминания.'],
  [80, 'retirement', 'Hallo, goldene Jahre!', 'Здравствуй, золотая пора!', 'Alle Lebenswerte werden am Ende zusammengerechnet. Wer zuerst ankommt, erhält keinen Zeitbonus.', 'В конце учитывается всё, что удалось обрести. За ранний финиш бонуса нет.'],
];
export const MILESTONES = milestones.map(([index, id, de, ru, dd, dr]) => ({
  index, id, type: 'milestone', ...text('milestones', id, de, ru, dd, dr),
}));
const tileTypes = {
  event: ['Lebensmoment', 'Момент жизни', 'Eine neue Geschichte wartet auf dich.', 'Тебя ждёт новая история.'],
  payday: ['Zahltag', 'День зарплаты', 'Gehalt wird auch beim Überqueren ausgezahlt; Unterhalt wird abgezogen.', 'Зарплата начисляется и при прохождении клетки; содержание списывается.'],
  tax: ['Gemeinschaftskasse', 'Общая касса', '8.000 Beitrag; auf dem sicheren Weg 20 % weniger.', 'Взнос 8 000; на спокойном пути на 20 % меньше.'],
  market: ['Kleine Geldanlage', 'Небольшое вложение', 'Einlegen, auszahlen oder Geld verfügbar halten.', 'Вложить, вывести или сохранить свободные деньги.'],
  opportunity: ['Eine offene Tür', 'Открытая дверь', 'Ein Lebensmoment mit einer neuen Entscheidung.', 'Момент жизни с новым выбором.'],
};
for (const [id, [de, ru, dd, dr]] of Object.entries(tileTypes)) text('tiles', id, de, ru, dd, dr);
export const BOARD = Array.from({ length: 81 }, (_, index) => {
  const milestone = MILESTONES.find(m => m.index === index);
  if (milestone) return { index, ...milestone, type: index === 0 ? 'start' : index === 80 ? 'retirement' : 'milestone', milestone: milestone.id };
  const type = index % 5 === 0 ? 'payday' : index % 13 === 0 ? 'tax' : index % 9 === 0 ? 'market' : index % 7 === 0 ? 'opportunity' : 'event';
  return { index, type, title: `life.tiles.${type}.title`, description: `life.tiles.${type}.description` };
});

/** Route modifiers apply only to event/tax cash, never tuition, salaries, housing or loans. */
export const ROUTES = [
  { id: 'safe', lossMultiplier: 0.8, gainMultiplier: 1,
    ...text('routes', 'safe', 'Der ruhige Gartenweg', 'Тихая садовая дорожка', '20 % kleinere Ereignisverluste, normale Gewinne. Einmalig 10.000 Planungspuffer.', 'Потери событий ниже на 20 %, доходы обычные. Сразу +10 000 на спокойный старт.') },
  { id: 'adventure', lossMultiplier: 1.4, gainMultiplier: 1.5,
    ...text('routes', 'adventure', 'Die Abenteuerstraße', 'Дорога приключений', '50 % größere Ereignisgewinne und 40 % größere Verluste. Einmalig +2 Glück.', 'Доходы событий выше на 50 %, потери — на 40 %. Сразу +2 радости.') },
];

export const CHOICES = {};
function choice(id, de, ru, dd, dr, extra = {}) {
  CHOICES[id] = { id, ...text('choices', id, de, ru, dd, dr), ...extra };
}
choice('career', 'Direkt ins Berufsleben', 'Сразу работать', '20.000 Startbonus, sofort Gehalt, kein Studienkredit.', 'Стартовый бонус 20 000, зарплата сразу, без кредита на учёбу.', { gain: 20000 });
choice('study', 'Erst studieren', 'Сначала учиться', '60.000 Studienkredit; Abschluss auf Feld 8 eröffnet höher bezahlte Berufe.', 'Кредит на учёбу 60 000; диплом на клетке 8 открывает более высокие зарплаты.', { cost: 60000 });
choice('training', 'In Können investieren', 'Развивать навыки', '20.000 Weiterbildungskosten. Ab jetzt +3.000 Gehalt je Zahltag.', 'Обучение стоит 20 000. Зарплата повышается на 3 000.', { cost: 20000, salary: 3000 });
choice('bonus', 'Erste Erfolge feiern', 'Отпраздновать успех', '20.000 Erfolgsprämie für einen guten Start.', 'Премия 20 000 за первые успехи.', { gain: 20000 });
choice('mentor', 'Zeit mit einem Mentor', 'Время с наставником', '+4 Glück durch Menschen, die an dich glauben.', '+4 радости благодаря людям, которые в тебя верят.' );
choice('insure', 'Sicherheit dazubuchen', 'Оформить страховку', 'Einmalig 18.000. Bei versicherten Schäden entfällt der Geldverlust komplett.', 'Один платёж 18 000. Страховые случаи не уменьшают деньги.', { cost: 18000 });
choice('uninsured', 'Risiko selbst tragen', 'Принять риск', 'Keine Prämie. Unfälle und Schäden bezahlst du selbst.', 'Без взноса. Расходы при авариях и поломках оплачиваются самостоятельно.');
choice('partner', 'Gemeinsam weiterreisen', 'Продолжить вместе', '15.000 für die Hochzeit, +2 Glück, 25.000 Partnerschaftswert im Finale.', 'Свадьба стоит 15 000, +2 радости, 25 000 за партнёрство в финале.', { cost: 15000 });
choice('solo', 'Mein eigener Rhythmus', 'Свой собственный ритм', '+4 Glück durch Freiheit und Freundschaften.', '+4 радости за свободу и дружбу.');
choice('rent', 'Flexibel bleiben', 'Сохранить свободу', 'Kein Kaufpreis. Miete kostet weiter 3.000 je Zahltag, +11 Glück durch Ortsfreiheit.', 'Без покупки. Аренда стоит 3 000 в день зарплаты, +11 радости за свободу выбора места.');
choice('children0', 'Ein Leben voller Freiraum', 'Жизнь с простором', 'Keine Kinderkosten, +2 Glück. Dein Weg ist genauso viel wert.', 'Без расходов на детей, +2 радости. Твой путь столь же ценен.');
choice('children1', 'Ein Kind willkommen heißen', 'Встретить одного ребёнка', '12.000 Startkosten, 2.500 Unterhalt je Zahltag, +2 Glück und 35.000 Familienwert.', '12 000 вначале, 2 500 в день зарплаты, +2 радости и 35 000 за семью.', { cost: 12000 });
choice('children2', 'Zwillinge, doppeltes Leben', 'Двойня — двойная жизнь', '24.000 Startkosten, 5.000 Unterhalt je Zahltag, +2 Glück und 70.000 Familienwert.', '24 000 вначале, 5 000 в день зарплаты, +2 радости и 70 000 за семью.', { cost: 24000 });
choice('promotion', 'Die nächste Karrierestufe', 'Следующая карьерная ступень', '25.000 Einsatz, −1 Glück. Dafür +7.000 Gehalt an allen weiteren Zahltagen.', 'Цена 25 000 и −1 радость. Зарплата повышается на 7 000.', { cost: 25000, salary: 7000 });
choice('sabbatical', 'Raum zum Durchatmen', 'Время перевести дыхание', '5.000 Auszeitbudget für +4 Glück.', 'Бюджет отдыха 5 000 за +4 радости.', { cost: 5000 });
choice('venture', 'Mein eigener kleiner Laden', 'Мой небольшой магазин', '20.000 Einsatz. 60 % Chance auf 60.000 Erlös, sonst kein Erlös.', 'Вложить 20 000. С вероятностью 60 % получить 60 000, иначе без выручки.', { cost: 20000, risk: 0.4 });
choice('invest20', '20.000 breit anlegen', 'Вложить 20 000', 'Kauf von Anlagen für 20.000. Wertentwicklung an jedem weiteren Zahltag.', 'Купить вложения на 20 000. Их стоимость меняется в каждый следующий день зарплаты.', { cost: 20000 });
choice('invest60', '60.000 für die Zukunft', '60 000 на будущее', 'Kauf von Anlagen für 60.000. Schwankungen gehören dazu.', 'Купить вложения на 60 000. Возможны колебания стоимости.', { cost: 60000 });
choice('invest120', '120.000 langfristig anlegen', 'Вложить 120 000', 'Großes Portfolio für 120.000; dieselbe Rendite und dasselbe Verlustrisiko.', 'Крупный портфель за 120 000; те же доходность и риск потерь.', { cost: 120000 });
choice('cashout', 'Anlagen auszahlen', 'Вывести вложения', 'Alle Anlagen zum aktuellen Wert verkaufen. Keine Gebühr.', 'Продать все вложения по текущей стоимости. Без комиссии.');
choice('repay', 'Kredit zurückzahlen', 'Погасить кредит', 'So viel wie möglich aus vorhandenem Bargeld tilgen. Keine neuen Kredite.', 'Погасить максимально возможную сумму свободными деньгами. Без новых кредитов.');
choice('hold', 'Geld verfügbar halten', 'Сохранить деньги', 'Nichts ausgeben und ohne neue Verpflichtung weiterreisen.', 'Ничего не тратить и продолжить без новых обязательств.');
choice('community', 'Einen Gemeinschaftsgarten stiften', 'Подарить общий сад', '20.000 spenden, +6 Glück. 50 % Chance auf 12.000 Förderzuschuss.', 'Пожертвовать 20 000, +6 радости. Шанс 50 % получить грант 12 000.', { cost: 20000, risk: 0.5 });
choice('memories', 'Eine letzte große Reise', 'Последнее большое путешествие', '10.000 Reisebudget, +4 Glück.', 'Бюджет путешествия 10 000, +4 радости.', { cost: 10000 });
choice('retire', 'Das Leben feiern', 'Праздновать жизнь', 'Dein Bargeld, Haus, Anlagen, Familie und Glück zählen; Schulden werden abgezogen.', 'Учитываются деньги, дом, вложения, семья и радость; долги вычитаются.');

export const EVENTS = [];
function event(id, de, ru, dd, dr, a, b, extra = {}) {
  const options = [a, b].map(([oid, od, or, ode, ore, effect]) => ({
    id: `${id}_${oid}`, ...text(`events.${id}.options`, oid, od, or, ode, ore), effect,
  }));
  EVENTS.push({ id, ...text('events', id, de, ru, dd, dr), options, ...extra });
}
// Each event is original and has an explicit, inspectable outcome. No real-money mechanics.
event('bicycle', 'Ein Rad für die Stadt', 'Велосипед для города', 'Der tägliche Weg darf schöner werden.', 'Ежедневная дорога может стать приятнее.',
  ['buy', 'Lieblingsrad kaufen', 'Купить любимый велосипед', '8.000 ausgeben, +3 Glück.', 'Потратить 8 000, +3 радости.', { cash: -8000, happiness: 3 }],
  ['repair', 'Das alte Rad reparieren', 'Починить старый', '+2.000 Nachbarschaftsbonus und +1 Glück.', '+2 000 от соседской мастерской и +1 радость.', { cash: 2000, happiness: 1 }]);
event('roof', 'Ein undichtes Dach', 'Протекающая крыша', 'Der Regen kommt leider bis ins Wohnzimmer.', 'Дождь добрался до гостиной.',
  ['repair', 'Sorgfältig reparieren', 'Основательный ремонт', 'Versicherter Schaden: 18.000, +1 Glück.', 'Страховой случай: 18 000, +1 радость.', { cash: -18000, insured: true, happiness: 1 }],
  ['patch', 'Selbst abdichten', 'Заделать самостоятельно', '6.000 Material, −1 Glück; nicht versichert.', 'Материалы 6 000, −1 радость; без страховки.', { cash: -6000, happiness: -1 }]);
event('festival', 'Lichterfest im Viertel', 'Праздник огней', 'Zwischen Musik und Lampions entstehen Geschichten.', 'Музыка и фонари дарят новые истории.',
  ['visit', 'Den Abend genießen', 'Насладиться вечером', '5.000 für +3 Glück.', '5 000 за +3 радости.', { cash: -5000, happiness: 3 }],
  ['stand', 'Einen Stand betreiben', 'Открыть свой прилавок', '+12.000 Einnahmen.', '+12 000 выручки.', { cash: 12000 }]);
event('grant', 'Eine gute Idee wird gefördert', 'Поддержка хорошей идеи', 'Dein nachhaltiges Projekt hat die Jury überzeugt.', 'Твой экологичный проект убедил жюри.',
  ['cash', 'Die Förderung nutzen', 'Принять поддержку', '+16.000.', '+16 000.', { cash: 16000 }],
  ['share', 'Wissen kostenlos weitergeben', 'Делиться знаниями бесплатно', '+5.000 und +3 Glück.', '+5 000 и +3 радости.', { cash: 5000, happiness: 3 }]);
event('dentist', 'Eine überraschende Zahnarztrechnung', 'Неожиданный счёт стоматолога', 'Auch Kaktusmenschen müssen zum Kontrolltermin.', 'Даже кактусовым людям нужны осмотры.',
  ['full', 'Die Behandlung abschließen', 'Пройти лечение', 'Versicherte Rechnung: 14.000.', 'Страховой счёт: 14 000.', { cash: -14000, insured: true }],
  ['plan', 'Kleine Behandlung wählen', 'Выбрать малое лечение', '4.000 bezahlen und −2 Glück; nicht versichert.', 'Заплатить 4 000 и −2 радости; без страховки.', { cash: -4000, happiness: -2 }]);
event('solar', 'Sonne auf dem Dach', 'Солнце на крыше', 'Eine Energiegenossenschaft sucht neue Mitglieder.', 'Энергетический кооператив ищет участников.',
  ['join', 'Solar-Anteile kaufen', 'Купить солнечные паи', '15.000 bezahlen, Anlagenwert +18.000.', 'Заплатить 15 000, вложения +18 000.', { cash: -15000, investments: 18000, fixedCash: true }],
  ['help', 'Beim Aufbau helfen', 'Помочь с установкой', '+7.000 und +1 Glück.', '+7 000 и +1 радость.', { cash: 7000, happiness: 1 }]);
event('storm', 'Sturm über Kaktusstadt', 'Буря над Кактусградом', 'Ein umgestürzter Baum hat einiges beschädigt.', 'Упавшее дерево многое повредило.',
  ['claim', 'Den Schaden beseitigen', 'Устранить ущерб', 'Versicherter Schaden: 25.000.', 'Страховой случай: 25 000.', { cash: -25000, insured: true }],
  ['neighbors', 'Mit Nachbarn anpacken', 'Помочь вместе с соседями', '12.000 Material, +2 Glück; nicht versichert.', 'Материалы 12 000, +2 радости; без страховки.', { cash: -12000, happiness: 2 }]);
event('award', 'Du wirst ausgezeichnet', 'Твоя награда', 'Dein Einsatz ist nicht unbemerkt geblieben.', 'Твои старания заметили.',
  ['prize', 'Das Preisgeld annehmen', 'Принять премию', '+20.000.', '+20 000.', { cash: 20000 }],
  ['party', 'Das ganze Team einladen', 'Пригласить всю команду', '+7.000 und +3 Glück.', '+7 000 и +3 радости.', { cash: 7000, happiness: 3 }]);
event('friend', 'Ein Freund braucht einen Neustart', 'Другу нужен новый старт', 'Manchmal ist Hilfe der Anfang von etwas Gutem.', 'Иногда помощь становится началом хорошего.',
  ['support', 'Unkompliziert helfen', 'Просто помочь', '10.000 geben, +4 Glück.', 'Отдать 10 000, +4 радости.', { cash: -10000, happiness: 4 }],
  ['time', 'Zeit schenken', 'Подарить время', '+2 Glück.', '+2 радости.', { happiness: 2 }]);
event('heirloom', 'Ein Familienfund', 'Семейная находка', 'Auf dem Dachboden liegt mehr als alte Kartons.', 'На чердаке нашлись не только старые коробки.',
  ['sell', 'Das Sammlerstück verkaufen', 'Продать коллекционную вещь', '+18.000.', '+18 000.', { cash: 18000 }],
  ['keep', 'Die Geschichte bewahren', 'Сохранить историю', '+4 Glück.', '+4 радости.', { happiness: 4 }]);
event('startup', 'Ein mutiger Prototyp', 'Смелый прототип', 'Ein kleines Team glaubt an eine große Idee.', 'Небольшая команда верит в большую идею.',
  ['back', 'Den Versuch finanzieren', 'Поддержать попытку', '12.000 Einsatz; 50 % Chance auf 34.000, sonst 0.', 'Вложить 12 000; шанс 50 % получить 34 000, иначе 0.', { cash: -12000, gamble: { chance: 0.5, win: 34000 } }],
  ['consult', 'Mit Erfahrung helfen', 'Помочь опытом', '+6.000 Honorar.', '+6 000 за консультацию.', { cash: 6000 }]);
event('weekend', 'Ein freies Wochenende', 'Свободные выходные', 'Der Kalender ist ausnahmsweise leer.', 'В календаре наконец ничего нет.',
  ['trip', 'Raus in die Berge', 'Отправиться в горы', '7.000 Reisekosten, +3 Glück.', 'Путешествие 7 000, +3 радости.', { cash: -7000, happiness: 3 }],
  ['work', 'Einen Auftrag fertigstellen', 'Закончить заказ', '+10.000, −1 Glück.', '+10 000, −1 радость.', { cash: 10000, happiness: -1 }]);
event('repairCafe', 'Ein Repair-Café entsteht', 'Открывается ремонтное кафе', 'Werkzeug, Kuchen und eine gemeinsame Idee.', 'Инструменты, пироги и общее дело.',
  ['build', 'Einen Abend mithelfen', 'Помочь вечером', '+2 Glück und +4.000 Aufwandsentschädigung.', '+2 радости и +4 000 за помощь.', { cash: 4000, happiness: 2 }],
  ['sponsor', 'Die Werkbank finanzieren', 'Подарить верстак', '8.000 spenden, +4 Glück.', 'Пожертвовать 8 000, +4 радости.', { cash: -8000, happiness: 4 }]);
event('taxRefund', 'Post vom Finanzamt', 'Письмо из налоговой', 'Diesmal darf der Brief Freude machen.', 'На этот раз письмо обрадует.',
  ['take', 'Erstattung auszahlen', 'Получить возврат', '+14.000.', '+14 000.', { cash: 14000 }],
  ['invest', 'Direkt für später anlegen', 'Сразу вложить на будущее', 'Anlagenwert +17.000.', 'Вложения +17 000.', { investments: 17000 }]);
event('lostPhone', 'Das Handy ist verschwunden', 'Телефон пропал', 'Ein leerer Platz in der Tasche, ein voller Tag.', 'Карман пуст, а день полон дел.',
  ['replace', 'Zuverlässig ersetzen', 'Купить надёжную замену', 'Versicherter Schaden: 9.000.', 'Страховой случай: 9 000.', { cash: -9000, insured: true }],
  ['simple', 'Ein einfaches Gerät nehmen', 'Выбрать простой телефон', '3.000 bezahlen, −1 Glück.', 'Заплатить 3 000, −1 радость.', { cash: -3000, happiness: -1 }]);
event('garden', 'Dein Garten blüht auf', 'Твой сад расцвёл', 'Aus ein paar Samen wird ein kleines Paradies.', 'Из нескольких семян вырос маленький рай.',
  ['market', 'Ableger auf dem Markt verkaufen', 'Продать отростки на рынке', '+11.000.', '+11 000.', { cash: 11000 }],
  ['give', 'Mit der Nachbarschaft teilen', 'Поделиться с соседями', '+3 Glück.', '+3 радости.', { happiness: 3 }]);
event('course', 'Ein Kurs, der dich weiterbringt', 'Полезный курс', 'Eine neue Fähigkeit könnte Türen öffnen.', 'Новый навык может открыть двери.',
  ['learn', 'Den Kurs belegen', 'Записаться', '12.000 Kosten, ab jetzt +1.500 Gehalt.', 'Стоимость 12 000, зарплата навсегда +1 500.', { cash: -12000, salary: 1500, fixedCash: true }],
  ['library', 'Die Bibliothek entdecken', 'Открыть для себя библиотеку', '+2 Glück.', '+2 радости.', { happiness: 2 }]);
event('pet', 'Eine Pfote findet ein Zuhause', 'Четыре лапы находят дом', 'Im Tierheim wartet ein sehr neugieriger Mitbewohner.', 'В приюте ждёт очень любопытный сосед.',
  ['adopt', 'Einziehen lassen', 'Приютить', '9.000 Startbudget, +4 Glück.', 'Начальные расходы 9 000, +4 радости.', { cash: -9000, happiness: 4 }],
  ['walk', 'Regelmäßig Gassi gehen', 'Помогать с прогулками', '+2 Glück.', '+2 радости.', { happiness: 2 }]);
event('marketStall', 'Flohmarkt unter Kastanien', 'Блошиный рынок под каштанами', 'Was du nicht mehr brauchst, freut jemand anderen.', 'То, что тебе не нужно, порадует другого.',
  ['sell', 'Einen Stand aufbauen', 'Разложить товары', '+9.000 und +1 Glück.', '+9 000 и +1 радость.', { cash: 9000, happiness: 1 }],
  ['browse', 'Nach Schätzen stöbern', 'Искать сокровища', '4.000 ausgeben, +3 Glück.', 'Потратить 4 000, +3 радости.', { cash: -4000, happiness: 3 }]);
event('flood', 'Wasser im Keller', 'Вода в подвале', 'Die Waschmaschine hat eigene Pläne gemacht.', 'У стиральной машины были свои планы.',
  ['service', 'Fachleute rufen', 'Вызвать специалистов', 'Versicherter Schaden: 20.000.', 'Страховой случай: 20 000.', { cash: -20000, insured: true }],
  ['diy', 'Selbst trocknen und reparieren', 'Высушить и починить самим', '8.000, −1 Glück; nicht versichert.', '8 000, −1 радость; без страховки.', { cash: -8000, happiness: -1 }]);
event('book', 'Deine Geschichte wird ein Buch', 'Твоя история станет книгой', 'Jemand möchte deine Erfahrungen lesen.', 'Кто-то хочет прочитать о твоём опыте.',
  ['publish', 'Das Angebot unterschreiben', 'Принять предложение', '+15.000 Honorar.', '+15 000 гонорара.', { cash: 15000 }],
  ['free', 'Ein offenes Lesecafé starten', 'Открыть литературное кафе', '+4 Glück.', '+4 радости.', { happiness: 4 }]);
event('concert', 'Deine Lieblingsband kommt', 'Приезжает любимая группа', 'Ein Lied kann einen ganzen Sommer zurückbringen.', 'Одна песня может вернуть целое лето.',
  ['tickets', 'Ganz vorne dabei sein', 'Быть у самой сцены', '8.000 für +4 Glück.', '8 000 за +4 радости.', { cash: -8000, happiness: 4 }],
  ['stream', 'Mit Freunden zu Hause hören', 'Слушать дома с друзьями', '+2 Glück.', '+2 радости.', { happiness: 2 }]);
event('overtime', 'Ein wichtiger Großauftrag', 'Крупный срочный заказ', 'Der Kunde zahlt gut, doch der Kalender ist schon voll.', 'Клиент хорошо платит, но календарь уже заполнен.',
  ['accept', 'Die Extrameile gehen', 'Постараться сверх обычного', '+22.000, −2 Glück.', '+22 000, −2 радости.', { cash: 22000, happiness: -2 }],
  ['decline', 'Grenzen setzen', 'Установить границы', '+2 Glück.', '+2 радости.', { happiness: 2 }]);
event('contest', 'Das große Kaktus-Quiz', 'Большая кактусовая викторина', 'Du weißt überraschend viel über stachelige Dinge.', 'Ты удивительно много знаешь о колючих вещах.',
  ['risk', 'Bis ins Finale spielen', 'Играть до финала', '50 % Chance auf +30.000, sonst −5.000.', 'Шанс 50 % получить +30 000, иначе −5 000.', { gamble: { chance: 0.5, win: 30000, lose: -5000 } }],
  ['leave', 'Den kleinen Preis mitnehmen', 'Забрать малый приз', '+10.000.', '+10 000.', { cash: 10000 }]);
event('train', 'Ein Zug ins Unbekannte', 'Поезд навстречу неизвестному', 'Ein günstiges Ticket, ein freier Platz am Fenster.', 'Недорогой билет и свободное место у окна.',
  ['travel', 'Einfach einsteigen', 'Просто отправиться', '6.000, +3 Glück.', '6 000, +3 радости.', { cash: -6000, happiness: 3 }],
  ['refund', 'Die Reisekasse behalten', 'Сохранить деньги на поездку', '+5.000.', '+5 000.', { cash: 5000 }]);
event('neighborhood', 'Ein Platz wird neu belebt', 'Площадь оживает', 'Die Nachbarschaft träumt von Bäumen statt Asphalt.', 'Соседи мечтают о деревьях вместо асфальта.',
  ['fund', 'Einen Baum finanzieren', 'Подарить дерево', '7.000, +4 Glück.', '7 000, +4 радости.', { cash: -7000, happiness: 4 }],
  ['hands', 'An einem Samstag helfen', 'Помочь в субботу', '+2 Glück.', '+2 радости.', { happiness: 2 }]);
event('device', 'Die Kaffeemaschine streikt', 'Кофемашина отказалась работать', 'Der Morgen beginnt heute etwas langsamer.', 'Сегодня утро начинается чуть медленнее.',
  ['replace', 'Ein neues Gerät kaufen', 'Купить новую', 'Versicherter Schaden: 10.000, +1 Glück.', 'Страховой случай: 10 000, +1 радость.', { cash: -10000, insured: true, happiness: 1 }],
  ['repair', 'Einen Ersatzteilversuch wagen', 'Попробовать запасную деталь', '3.000 Kosten.', 'Расходы 3 000.', { cash: -3000 }]);
event('reunion', 'Ein Wiedersehen nach Jahren', 'Встреча спустя годы', 'Alte Freunde haben neue Geschichten.', 'У старых друзей появились новые истории.',
  ['host', 'Alle zu dir einladen', 'Позвать всех к себе', '5.000, +4 Glück.', '5 000, +4 радости.', { cash: -5000, happiness: 4 }],
  ['picnic', 'Ein Picknick organisieren', 'Устроить пикник', '+2 Glück.', '+2 радости.', { happiness: 2 }]);
event('windfall', 'Ein unerwarteter Geldsegen', 'Неожиданная удача', 'Ein alter Vertrag zahlt sich spät aus.', 'Старый договор наконец принёс доход.',
  ['cash', 'Den Betrag auszahlen lassen', 'Получить деньги', '+24.000.', '+24 000.', { cash: 24000 }],
  ['portfolio', 'Den Betrag anlegen', 'Вложить сумму', 'Anlagenwert +28.000.', 'Вложения +28 000.', { investments: 28000 }]);
event('health', 'Zeit, auf dich zu achten', 'Время позаботиться о себе', 'Dein Körper freut sich über einen freundlicheren Alltag.', 'Твоему телу понравится более бережный распорядок.',
  ['retreat', 'Eine Gesundheitswoche buchen', 'Неделя для здоровья', '10.000, +5 Glück.', '10 000, +5 радости.', { cash: -10000, happiness: 5 }],
  ['walk', 'Jeden Tag ein Spaziergang', 'Гулять каждый день', '+2 Glück.', '+2 радости.', { happiness: 2 }]);
event('museum', 'Ein Museum für kleine Dinge', 'Музей маленьких вещей', 'Die Stadt sucht besondere Alltagsgeschichten.', 'Город ищет необычные повседневные истории.',
  ['lend', 'Ein Erinnerungsstück verleihen', 'Одолжить памятную вещь', '+8.000 und +1 Glück.', '+8 000 и +1 радость.', { cash: 8000, happiness: 1 }],
  ['guide', 'Eine Führung mitgestalten', 'Помочь провести экскурсию', '+3 Glück.', '+3 радости.', { happiness: 3 }]);
event('scam', 'Ein verdächtig gutes Angebot', 'Подозрительно выгодное предложение', 'Nicht jede glänzende Idee hält, was sie verspricht.', 'Не всякая блестящая идея оправдывает обещания.',
  ['check', 'Die Unterlagen prüfen', 'Проверить документы', '2.000 Beratung, danach +10.000 sichere Ersparnis.', 'Консультация 2 000, затем безопасная экономия 10 000.', { cash: 8000 }],
  ['risk', 'Trotzdem ausprobieren', 'Всё же попробовать', '25 % Chance auf 35.000, sonst −12.000.', 'Шанс 25 % получить 35 000, иначе −12 000.', { gamble: { chance: 0.25, win: 35000, lose: -12000 } }]);
event('school', 'Ein Projekt für die nächste Generation', 'Проект для следующего поколения', 'Eine Schule baut ein Gewächshaus.', 'Школа строит теплицу.',
  ['donate', 'Material finanzieren', 'Купить материалы', '9.000, +4 Glück.', '9 000, +4 радости.', { cash: -9000, happiness: 4 }],
  ['teach', 'Einen Workshop geben', 'Провести занятие', '+4.000 und +2 Glück.', '+4 000 и +2 радости.', { cash: 4000, happiness: 2 }]);
event('commute', 'Eine neue Strecke zur Arbeit', 'Новая дорога на работу', 'Die Stadt baut um. Du denkst gleich mit.', 'Город меняется, и ты вместе с ним.',
  ['pass', 'Ein Jahresticket organisieren', 'Купить годовой проездной', '5.000 Kosten, +2 Glück.', 'Расходы 5 000, +2 радости.', { cash: -5000, happiness: 2 }],
  ['remote', 'Flexibel arbeiten', 'Работать гибко', '+7.000 Ersparnis.', 'Экономия 7 000.', { cash: 7000 }]);
event('harvest', 'Ein Rekordjahr im Gemeinschaftsgarten', 'Рекордный урожай общего сада', 'Die Tomaten haben dieses Jahr alles gegeben.', 'В этом году помидоры превзошли себя.',
  ['sell', 'Die Ernte vermarkten', 'Продать урожай', '+15.000.', '+15 000.', { cash: 15000 }],
  ['feast', 'Ein Erntefest ausrichten', 'Устроить праздник урожая', '+4 Glück.', '+4 радости.', { happiness: 4 }]);
event('familyDay', 'Ein Tag für deine Lieblingsmenschen', 'День для любимых людей', 'Nähe braucht manchmal einfach einen freien Nachmittag.', 'Для близости порой нужен лишь свободный день.',
  ['outing', 'Einen Ausflug planen', 'Запланировать поездку', '6.000 plus 2.000 je Kind, +4 Glück.', '6 000 плюс 2 000 за ребёнка, +4 радости.', { cash: -6000, childCash: -2000, happiness: 4 }],
  ['home', 'Zusammen kochen und spielen', 'Готовить и играть вместе', '+2 Glück.', '+2 радости.', { happiness: 2 }]);
event('scholarship', 'Du darfst jemanden fördern', 'Помочь таланту вырасти', 'Ein junges Talent braucht eine erste Chance.', 'Молодому таланту нужен первый шанс.',
  ['fund', 'Ein Stipendium ermöglichen', 'Учредить стипендию', '12.000, +5 Glück.', '12 000, +5 радости.', { cash: -12000, happiness: 5 }],
  ['mentor', 'Persönlich begleiten', 'Стать наставником', '+3 Glück.', '+3 радости.', { happiness: 3 }]);
event('photo', 'Ein Foto wird zum Stadtmotiv', 'Твоё фото стало символом города', 'Dein Blick für den Alltag trifft einen Nerv.', 'Твой взгляд на обычное тронул людей.',
  ['license', 'Das Motiv lizenzieren', 'Продать лицензию', '+17.000.', '+17 000.', { cash: 17000 }],
  ['exhibit', 'Eine freie Ausstellung machen', 'Устроить бесплатную выставку', '+4 Glück.', '+4 радости.', { happiness: 4 }]);
event('move', 'Frischer Wind in deiner Wohnung', 'Новый уют дома', 'Ein wenig Farbe verändert mehr als nur Wände.', 'Новая краска меняет не только стены.',
  ['renovate', 'Mit Freunden renovieren', 'Сделать ремонт с друзьями', '9.000, +4 Glück.', '9 000, +4 радости.', { cash: -9000, happiness: 4 }],
  ['reuse', 'Möbel tauschen statt kaufen', 'Обменять мебель', '+3.000 Ersparnis, +1 Glück.', 'Экономия 3 000, +1 радость.', { cash: 3000, happiness: 1 }]);
event('bonusJob', 'Ein Angebot für dein Können', 'Предложение для умелых рук', 'Ein besonderer Auftrag liegt genau auf deiner Wellenlänge.', 'Необычный заказ тебе точно по душе.',
  ['take', 'Den Auftrag übernehmen', 'Взяться за заказ', '+13.000.', '+13 000.', { cash: 13000 }],
  ['share', 'Eine Freundin empfehlen', 'Порекомендовать подругу', '+5.000 Vermittlung und +2 Glück.', '+5 000 за рекомендацию и +2 радости.', { cash: 5000, happiness: 2 }]);

const copy = {
  path: ['Dein Leben beginnt', 'Твоя жизнь начинается', 'Jeder Weg bietet andere Chancen. Geld und Glück zählen beide.', 'На каждом пути свои возможности. Важны и деньги, и радость.'],
  directCareer: ['Wähle deinen ersten Beruf', 'Выбери первую профессию', 'Alle drei Wege stehen dir offen. Gehälter werden beim Überqueren der goldenen Felder gezahlt.', 'Открыты все три пути. Зарплата начисляется при прохождении золотых клеток.'],
  degreeCareer: ['Dein Abschluss öffnet Türen', 'Диплом открывает двери', 'Wähle einen der drei Studienberufe.', 'Выбери одну из трёх профессий с высшим образованием.'],
  insurance: ['Ein Sicherheitsnetz für deinen Weg', 'Страховка на твоём пути', 'Die Versicherung gilt bis zum Lebensende. Sie schützt nur ausdrücklich versicherte Ereignisse.', 'Страховка действует до конца игры. Она покрывает только отмеченные страховые случаи.'],
  market: ['Dein Geld, deine Entscheidung', 'Твои деньги — твой выбор', 'Anlagen ändern ihren Wert je Zahltag: 20 % Chance auf −10 %, 50 % auf +4 %, 30 % auf +8 %. Sichere Route: −5 %, +3 %, +6 %.', 'Стоимость вложений меняется в день зарплаты: шанс 20 % на −10 %, 50 % на +4 %, 30 % на +8 %. Спокойный путь: −5 %, +3 %, +6 %.'],
};
for (const [id, args] of Object.entries(copy)) text('pending', id, ...args);
const logs = {
  start: ['Die Reise beginnt.', 'Путешествие начинается.'],
  roll: ['{name} würfelt {value} und erreicht Feld {to}.', '{name}: выпало {value}, новая клетка — {to}.'],
  payday: ['Zahltag: {amount} Gehalt, {upkeep} Unterhalt.', 'День зарплаты: {amount} дохода, {upkeep} расходов.'],
  interest: ['Kreditzinsen: {amount}.', 'Проценты по кредиту: {amount}.'],
  loan: ['Automatischer Kredit: {amount}. Restgeld bleibt verfügbar.', 'Автоматический кредит: {amount}. Остаток денег доступен.'],
  tuition: ['Studienkredit aufgenommen: {amount}.', 'Получен кредит на учёбу: {amount}.'],
  career: ['Ein neuer Beruf: {career}.', 'Новая профессия: {career}.'],
  choice: ['Entscheidung: {choice}.', 'Выбор: {choice}.'],
  cash: ['Geld verändert sich um {amount}.', 'Деньги изменились на {amount}.'],
  insured: ['Die Versicherung übernimmt {amount}.', 'Страховка покрывает {amount}.'],
  investment: ['Anlagenentwicklung: {amount}.', 'Изменение вложений: {amount}.'],
  repayment: ['Kredit getilgt: {amount}.', 'Кредит погашен: {amount}.'],
  grant: ['Forschungsprämie: {amount}.', 'Исследовательская премия: {amount}.'],
  retire: ['{name} ist im Ruhestand.', '{name} выходит на пенсию.'],
  finished: ['Alle sind angekommen. Zeit für eure Lebensbilanz!', 'Все пришли к финишу. Время подвести итоги жизни!'],
};
for (const [id, [de, ru]] of Object.entries(logs)) words(`log.${id}`, de, ru);
for (const [id, de, ru] of [
  ['invalidAction', 'Diese Aktion ist gerade nicht möglich.', 'Сейчас это действие невозможно.'],
  ['notYourTurn', 'Die andere Person ist am Zug.', 'Сейчас ход другого игрока.'],
  ['finished', 'Diese Partie ist bereits beendet.', 'Эта партия уже закончена.'],
  ['invalidChoice', 'Diese Entscheidung steht nicht zur Verfügung.', 'Этот вариант недоступен.'],
  ['invalidPlayers', 'Genau zwei verschiedene Spieler werden benötigt.', 'Нужны ровно два разных игрока.'],
  ['invalidRandom', 'Die Zufallsquelle hat einen ungültigen Wert geliefert.', 'Источник случайности вернул неверное значение.'],
  ['invalidState', 'Der Spielstand ist ungültig.', 'Состояние игры неверно.'],
  ['staleAction', 'Der Spielstand hat sich inzwischen geändert.', 'Состояние игры уже изменилось.'],
]) words(`errors.${id}`, de, ru);

// Freeze shared input data as a guard against accidental browser-side mutation.
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
for (const catalogue of [CAREERS, HOUSES, MILESTONES, BOARD, ROUTES, CHOICES, EVENTS, TRANSLATIONS]) deepFreeze(catalogue);
