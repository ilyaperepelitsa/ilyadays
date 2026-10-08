import { MadeTripView } from "@/views/NewTripView";
import { travelMeta } from "@/views/meta";

export const metadata = travelMeta("ru");

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  return <MadeTripView lang="ru" id={(await params).id} />;
}
