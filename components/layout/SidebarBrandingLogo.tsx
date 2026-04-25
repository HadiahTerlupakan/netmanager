import Image from "next/image";

type SidebarBrandingLogoProps = {
  appName: string;
  logoUrl?: string | null;
};

function getMonogram(appName: string): string {
  const trimmedName = appName.trim();

  if (!trimmedName) {
    return "N";
  }

  return trimmedName.charAt(0).toUpperCase();
}

/** Menampilkan logo aplikasi pada header sidebar dengan fallback monogram. */
export function SidebarBrandingLogo({
  appName,
  logoUrl,
}: SidebarBrandingLogoProps) {
  const monogram = getMonogram(appName);

  if (logoUrl) {
    return (
      <div className="relative h-24 w-24 shrink-0">
        <Image
          src={logoUrl}
          alt={`${appName} logo`}
          fill
          sizes="96px"
          loading="eager"
          className="object-contain"
        />
      </div>
    );
  }

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-600 to-violet-500 text-white shadow-sm">
      <span className="text-3xl font-bold">{monogram}</span>
    </div>
  );
}
