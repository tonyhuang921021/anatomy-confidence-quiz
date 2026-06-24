import { ResourceShareViewer } from "@/components/ResourceShareViewer";

export default async function ResourceSharePage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await params;
  return (
    <main className="shell">
      <ResourceShareViewer resourceId={resolvedParams.id} />
    </main>
  );
}
