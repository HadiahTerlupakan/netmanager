export default function PlanningDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="container mx-auto py-6">
      <div className="rounded-lg border bg-card p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Detail Planning OSP</h1>
        <p className="text-sm text-muted-foreground mb-4">ID: {params.id}</p>
        <p className="text-muted-foreground">
          UI belum diimplementasi - Backend sudah lengkap dan siap digunakan
        </p>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            TODO: Detail view dengan timeline, tasks, materials, attachments,
            dan actions
          </p>
        </div>
      </div>
    </div>
  );
}
