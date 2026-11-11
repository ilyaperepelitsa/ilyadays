import { FitnessProviders } from "@/components/fitness/Shell";

/** Auth and the fitness store are mounted once for the section: navigation between its pages keeps them (and drafts). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <FitnessProviders>{children}</FitnessProviders>;
}
