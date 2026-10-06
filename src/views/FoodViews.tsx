import { notFound } from "next/navigation";
import { getFoodIndex, getRecipe, getSousVide } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { FoodIndexView } from "@/components/food/FoodIndexView";
import { RecipeView } from "@/components/food/RecipeView";
import { SousVideView } from "@/components/food/SousVideView";

function FoodShell({ lang, path, children }: { lang: Lang; path: string; children: React.ReactNode }) {
  const index = getFoodIndex(lang);
  return (
    <>
      <SiteHeader lang={lang} path={path} section="food" groups={index.groups} />
      <main>{children}</main>
      <SiteFooter>{index.footer}</SiteFooter>
    </>
  );
}

export function FoodIndexPage({ lang }: { lang: Lang }) {
  return (
    <FoodShell lang={lang} path="/food">
      <FoodIndexView lang={lang} index={getFoodIndex(lang)} />
    </FoodShell>
  );
}

export function RecipePage({ lang, slug }: { lang: Lang; slug: string }) {
  const r = getRecipe(lang, slug);
  if (!r) notFound();
  return (
    <FoodShell lang={lang} path={`/food/${slug}`}>
      <RecipeView lang={lang} r={r} />
    </FoodShell>
  );
}

export function SousVidePage({ lang }: { lang: Lang }) {
  return (
    <FoodShell lang={lang} path="/food/sous-vide">
      <SousVideView lang={lang} sv={getSousVide(lang)} />
    </FoodShell>
  );
}
