import { RecipePage } from "@/views/FoodViews";
import { recipeMeta, recipeParams } from "@/views/meta";

export const dynamicParams = false;
export const generateStaticParams = recipeParams;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  return recipeMeta("ru", (await params).slug);
}

export default async function Page({ params }: Props) {
  return <RecipePage lang="ru" slug={(await params).slug} />;
}
