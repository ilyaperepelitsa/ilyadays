import { ScienceView, scienceMetadata, scienceParams } from "@/views/fitness/ScienceView";

export const dynamicParams = false;
export const generateStaticParams = () => scienceParams("ru");

type Props = { params: Promise<{ topic: string }> };

export async function generateMetadata({ params }: Props) {
  return scienceMetadata("ru", (await params).topic);
}

export default async function Page({ params }: Props) {
  return <ScienceView lang="ru" slug={(await params).topic} />;
}
