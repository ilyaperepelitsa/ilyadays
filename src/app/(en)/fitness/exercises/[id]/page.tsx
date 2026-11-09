import { ExerciseView, exerciseMetadata, exerciseParams } from "@/views/fitness/ExerciseView";

export const dynamicParams = false;
export const generateStaticParams = exerciseParams;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  return exerciseMetadata("en", (await params).id);
}

export default async function Page({ params }: Props) {
  return <ExerciseView lang="en" id={(await params).id} />;
}
