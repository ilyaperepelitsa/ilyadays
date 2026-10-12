// Per-page metadata (title, canonical, EN/RU alternates, link-preview card), shared by the EN and RU routes.
import type { Metadata } from "next";
import { getFoodIndex, getRecipe, getSousVide, media, recipeSlugs } from "@/lib/content";
import { type Lang, strings } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export const homeMeta = (lang: Lang): Metadata => {
  const t = strings(lang);
  return pageMetadata({ lang, path: "/", title: t.siteTitle, absoluteTitle: true, description: t.homeDescription, image: "/share/home.jpg" });
};

export const foodMeta = (lang: Lang): Metadata => {
  const i = getFoodIndex(lang);
  return pageMetadata({ lang, path: "/food", title: i.title, description: i.description, image: media(i.share_image) });
};

export const recipeMeta = (lang: Lang, slug: string): Metadata => {
  const r = getRecipe(lang, slug);
  if (!r) return {};
  return pageMetadata({
    lang,
    path: `/food/${slug}`,
    title: r.title,
    description: r.description,
    image: media(r.share_image),
    type: "article",
  });
};

export const sousVideMeta = (lang: Lang): Metadata => {
  const s = getSousVide(lang);
  return pageMetadata({ lang, path: "/food/sous-vide", title: s.title, description: s.description, image: media(s.share_image) });
};

export const travelMeta = (lang: Lang): Metadata => {
  const t = strings(lang);
  return pageMetadata({ lang, path: "/travel", title: t.travelTitle, description: t.travelDescription, image: "/share/travel.jpg" });
};

export const yachtFoodMeta = (lang: Lang): Metadata => pageMetadata({
  lang, path:'/travel/turkey-yacht-food',
  title:lang==='ru'?'Турция: еда на яхте':'Turkey: yacht food',
  description:lang==='ru'?'Сезонные закупки для яхты из Гёчека и 12 полных рецептов в разделе «Еда», с упрощёнными версиями и всеми сашими на одной странице.':'Seasonal yacht provisioning from Göcek, with twelve full Food recipes, simplified versions and all sashimi options on one page.',
  image:'/share/turkey-yacht-food.jpg',
});

export const yachtSashimiMeta = (lang: Lang): Metadata => pageMetadata({
  lang, path:'/travel/turkey-yacht-food/sashimi',
  title:lang==='ru'?'Сашими: все варианты для яхты':'Sashimi: all yacht seafood options',
  description:lang==='ru'?'Девять вариантов сашими на одной странице: тунец, лосось, гребешки, другие морепродукты, идеи подачи и проверка поставщиков в Турции.':'Nine sashimi options on one page: tuna, salmon, scallops, specialist alternatives, serving ideas and supplier checks for a Turkey yacht trip.',
  image:'/share/turkey-yacht-food.jpg',
});

export const makeTripMeta = (lang: Lang): Metadata => {
  const t = strings(lang);
  return pageMetadata({ lang, path: "/travel/new", title: t.makeTripTitle, description: t.makeTripDescription, image: "/share/travel.jpg" });
};

export const istanbulMeta = (lang: Lang): Metadata => {
  const t = strings(lang);
  return pageMetadata({
    lang,
    path: "/travel/istanbul",
    title: t.istanbulPageTitle,
    description: t.istanbulDescription,
    image: "/share/travel.jpg",
  });
};

/** Recipe pages to prerender (the sous-vide tables have their own route). */
export const recipeParams = () => recipeSlugs().map((slug) => ({ slug }));
