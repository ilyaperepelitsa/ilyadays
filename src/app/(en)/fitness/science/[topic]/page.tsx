import { ScienceView, scienceMetadata, scienceParams } from "@/views/fitness/ScienceView";

export const dynamicParams = false;
export const generateStaticParams = () => scienceParams("en");

type Props = { params: Promise<{ topic: string }> };

export async function generateMetadata({ params }: Props) {
  return scienceMetadata("en", (await params).topic);
}

export default async function Page({ params }: Props) {
  return <ScienceView lang="en" slug={(await params).topic} />;
}
