import { redirect } from "next/navigation";

type SimulationResultsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function SimulationResultsPage({
  searchParams
}: SimulationResultsPageProps) {
  const rawSessionId = searchParams?.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;

  redirect(
    sessionId
      ? `/results?scope=simulation&sessionId=${encodeURIComponent(sessionId)}`
      : "/results?scope=simulation"
  );
}
