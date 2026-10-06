import { HomeView } from "@/views/HomeView";
import { homeMeta } from "@/views/meta";

export const metadata = homeMeta("ru");

export default function Page() {
  return <HomeView lang="ru" />;
}
