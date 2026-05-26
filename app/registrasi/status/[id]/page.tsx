import type { Metadata } from "next";
import { RegistrationStatusClient } from "./RegistrationStatusClient";

export const metadata: Metadata = {
  title: "Status Pendaftaran",
  description: "Cek progress pendaftaran layanan internet",
};

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RegistrationStatusClient registrationId={id} />;
}
