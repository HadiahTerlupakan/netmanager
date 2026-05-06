import type { LogoType } from "./constants";

export interface LogoSettings {
  logoInvoice: string | null;
  logoAplikasi: string | null;
  logoLandingPage: string | null;
}

export interface LogoState {
  preview: string | null;
  file: File | null;
}

export type LogoStatesMap = Record<LogoType, LogoState>;

export interface LogoUploadResponse {
  success: boolean;
  logoPath: string;
}
