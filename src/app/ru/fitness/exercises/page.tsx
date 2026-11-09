import { ExercisesView } from "@/views/fitness/ExercisesView";
import { exercisesMeta } from "@/views/fitness/meta";

export const metadata = exercisesMeta("ru");

export default function Page() {
  return <ExercisesView lang="ru" />;
}
