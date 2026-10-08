import { MadeTripView } from "@/views/NewTripView";
import { travelMeta } from "@/views/meta";

export const metadata = travelMeta("en");

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  return <MadeTripView lang="en" id={(await params).id} />;
}
