import { FitnessHomeView } from "@/views/fitness/FitnessHomeView";
import { fitnessMeta } from "@/views/fitness/meta";

export const metadata = fitnessMeta("en");

export default function Page() {
  return <FitnessHomeView lang="en" />;
}
