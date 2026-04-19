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

  return (
    <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white transform rotate-3 hover:rotate-6 transition-transform duration-300 overflow-hidden">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${appName} logo`}
          fill
          sizes="40px"
          className="object-cover"
        />
      ) : (
        <span className="font-bold text-xl">{monogram}</span>
      )}
    </div>
  );
}
