import { ResourceShareViewer } from "@/components/ResourceShareViewer";

export default async function ResourceSharePage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await params;
  return (
    <main className="shell min-w-0 max-w-full overflow-x-hidden">
      <ResourceShareViewer resourceId={resolvedParams.id} />
    </main>
  );
}
