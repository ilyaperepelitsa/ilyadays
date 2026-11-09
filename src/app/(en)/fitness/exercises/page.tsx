import { ExercisesView } from "@/views/fitness/ExercisesView";
import { exercisesMeta } from "@/views/fitness/meta";

export const metadata = exercisesMeta("en");

export default function Page() {
  return <ExercisesView lang="en" />;
}
