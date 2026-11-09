import { TrainView } from "@/views/fitness/TrainView";
import { trainMeta } from "@/views/fitness/meta";

export const metadata = trainMeta("ru");

export default function Page() {
  return <TrainView lang="ru" />;
}
