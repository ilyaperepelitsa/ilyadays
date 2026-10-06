// Two languages: English at the root, Russian under /ru. Every page exists in both, at the same path.
export type Lang = "en" | "ru";
export const LANGS: Lang[] = ["en", "ru"];

/** URL prefix of a language: "" for English, "/ru" for Russian. */
export const prefix = (lang: Lang) => (lang === "ru" ? "/ru" : "");

/** A site path ("/food/oyakodon", "/") in a language. */
export const localPath = (lang: Lang, path: string) =>
  lang === "ru" ? (path === "/" ? "/ru" : `/ru${path}`) : path;

/** localStorage key for the chosen language — shared with the embedded Istanbul app. */
export const LANG_KEY = "lang";

// Runs first in <head>, before anything paints: if the reader picked the other language, go to the same page in
// that language. On a first visit the choice is Russian if the browser prefers it — or if the link itself was a
// /ru one (so shared Russian links, and crawlers, stay on Russian). No cookies — the choice is in localStorage.
export const LANG_SCRIPT = `(function(){try{var L=${JSON.stringify(LANG_KEY)},p=location.pathname,isRu=p==='/ru'||p.indexOf('/ru/')===0,cur=isRu?'ru':'en',s=localStorage.getItem(L);
if(s!=='en'&&s!=='ru'){var n=(navigator.languages||[navigator.language||'']).join(',').toLowerCase();s=isRu||/(^|,)ru/.test(n)?'ru':'en';localStorage.setItem(L,s);}
if(s!==cur){var rest=isRu?(p.slice(3)||'/'):p;var t=s==='ru'?('/ru'+(rest==='/'?'':rest)):rest;location.replace(t+location.search+location.hash);}}catch(e){}})();`;

const STRINGS = {
  en: {
    siteTitle: "ilyadays — Ilya's homepage",
    homeTitle: "Hi, I'm Ilya.",
    homeLede: "This is my homepage — a place for the food I cook, the trips I plan and the things I build.",
    homeDescription: "Ilya's homepage: the food I cook, the places I go and the things I build.",
    food: "Food",
    travel: "Travel",
    recipes: "Recipes",
    foodCardText: "My recipes, step by step with pictures: ramen, kimchi, oyakodon, pickles, noodles and more.",
    foodCardGo: "Open recipes →",
    foodCardAlt: "Oyakodon, ramen and tamagoyaki on a wooden table",
    travelCardText: "Trip plans and logs. First up: Istanbul.",
    travelCardGo: "Open travel →",
    travelCardAlt: "Istanbul old city and a ferry at sunset from the Galata Bridge",
    aboutTitle: "About me",
    aboutText:
      "I cook a lot — mostly Japanese and Korean food, slowly and from scratch — travel when I can, and build small tools for the things I'm learning.",
    madeTitle: "Things I've made",
    typekana: "practise typing Japanese kana: a fast trainer with optional vocabulary and spaced repetition.",
    recipesProject: "This recipe collection",
    recipesProjectText: "every step drawn, with prep order and timelines.",
    travelTitle: "Travel",
    travelLede: "Trip plans and travel logs.",
    travelDescription: "Trip plans and travel logs: walking routes, maps and what I actually saw.",
    istanbulTitle: "Istanbul — Constantinople Days",
    istanbulShort: "Istanbul",
    istanbulText:
      "4-day and 2-day walking plans: Byzantine Constantinople, Ottoman palaces, gems and imperial stone, Galata and Pera. Interactive map, the stops I've ticked off, re-planned routes.",
    istanbulGo: "Open the trip →",
    istanbulPageTitle: "Constantinople Days — Istanbul on foot",
    istanbulDescription:
      "4-day and 2-day walking plans through Byzantine and Ottoman Istanbul: churches, palaces, treasuries and the sea walls, with a map and the stops already visited.",
    istanbulLoading: "Loading the map…",
    istanbulFailed: "The trip app didn't load. Reload the page to try again.",
    readOnlySignedIn: "Signed in as {email} — only the site owner can edit this trip.",
    editing: "Editing — changes are saved for everyone to see.",
    signIn: "Sign in",
    signOut: "Sign out",
    notFoundTitle: "Page not found",
    notFoundText: "There's nothing at this address.",
    backHome: "← Home",
    language: "Language",
  },
  ru: {
    siteTitle: "ilyadays — домашняя страница Ильи",
    homeTitle: "Привет, я Илья.",
    homeLede: "Это моя домашняя страница — здесь еда, которую я готовлю, поездки, которые я планирую, и то, что я делаю.",
    homeDescription: "Домашняя страница Ильи: что я готовлю, куда езжу и что делаю.",
    food: "Еда",
    travel: "Путешествия",
    recipes: "Рецепты",
    foodCardText: "Мои рецепты, шаг за шагом с картинками: рамен, кимчи, оякодон, соленья, лапша и не только.",
    foodCardGo: "Открыть рецепты →",
    foodCardAlt: "Оякодон, рамен и тамагояки на деревянном столе",
    travelCardText: "Планы поездок и путевые заметки. Первым — Стамбул.",
    travelCardGo: "Открыть путешествия →",
    travelCardAlt: "Старый город Стамбула и паром на закате с Галатского моста",
    aboutTitle: "Обо мне",
    aboutText:
      "Я много готовлю — в основном японскую и корейскую еду, не спеша и с нуля, — путешествую, когда получается, и делаю небольшие инструменты для того, чему учусь.",
    madeTitle: "Что я сделал",
    typekana: "тренажёр набора японской каны: быстрые упражнения, по желанию — слова и интервальные повторения.",
    recipesProject: "Эта коллекция рецептов",
    recipesProjectText: "каждый шаг нарисован, есть порядок подготовки и таймлайн.",
    travelTitle: "Путешествия",
    travelLede: "Планы поездок и путевые заметки.",
    travelDescription: "Планы поездок и путевые заметки: пешие маршруты, карты и то, что я на самом деле увидел.",
    istanbulTitle: "Стамбул — Дни Константинополя",
    istanbulShort: "Стамбул",
    istanbulText:
      "Пешие маршруты на 4 и 2 дня: византийский Константинополь, османские дворцы, сокровищницы и имперский камень, Галата и Пера. Интерактивная карта, отмеченные остановки, перестроенные маршруты.",
    istanbulGo: "Открыть поездку →",
    istanbulPageTitle: "Дни Константинополя — Стамбул пешком",
    istanbulDescription:
      "Пешие маршруты на 4 и 2 дня по византийскому и османскому Стамбулу: церкви, дворцы, сокровищницы и морские стены — с картой и уже пройденными остановками.",
    istanbulLoading: "Загружаю карту…",
    istanbulFailed: "Приложение поездки не загрузилось. Обновите страницу, чтобы попробовать ещё раз.",
    readOnlySignedIn: "Вы вошли как {email} — редактировать поездку может только владелец сайта.",
    editing: "Режим редактирования — изменения сохраняются и видны всем.",
    signIn: "Войти",
    signOut: "Выйти",
    notFoundTitle: "Страница не найдена",
    notFoundText: "По этому адресу ничего нет.",
    backHome: "← На главную",
    language: "Язык",
  },
} as const;

export type Strings = { [K in keyof (typeof STRINGS)["en"]]: string };
export const strings = (lang: Lang): Strings => STRINGS[lang];
