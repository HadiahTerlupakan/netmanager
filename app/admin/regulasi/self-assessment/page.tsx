import { redirect } from "next/navigation";

/** Menu lama diarahkan ke Jartaplok PS — satu-satunya izin sebelum ISP ada. */
export default function Page() {
  redirect("/admin/regulasi/self-assessment/jartaplok-ps");
}
