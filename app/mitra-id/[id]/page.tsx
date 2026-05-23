import { notFound } from "next/navigation";
import { getMitraIdCardService } from "@/modules/mitra";
import IdCardClient from "./IdCardClient";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  return {
    title: await getMitraIdCardService().getIdCardTitle(id),
  };
}

export default async function MitraIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mitra = await getMitraIdCardService().getIdCardData(id);

  if (!mitra) {
    notFound();
  }

  return <IdCardClient mitra={mitra} />;
}
