import { FitnessHomeView } from "@/views/fitness/FitnessHomeView";
import { fitnessMeta } from "@/views/fitness/meta";

export const metadata = fitnessMeta("ru");

export default function Page() {
  return <FitnessHomeView lang="ru" />;
}
