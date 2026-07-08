"use client";

import type { ChangeEvent } from "react";
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import type { MitraFormState, Site } from "./types";
import { MitraFormIdentitySection } from "./MitraFormIdentitySection";
import { MitraFormJobSection } from "./MitraFormJobSection";
import { MitraFormBankGaransiSection } from "./MitraFormBankGaransiSection";

export interface MitraFormFieldsProps {
  readonly register: UseFormRegister<MitraFormState>;
  readonly setValue: UseFormSetValue<MitraFormState>;
  readonly watch: UseFormWatch<MitraFormState>;
  readonly errors: FieldErrors<MitraFormState>;
  readonly sites: readonly Site[];
  readonly mixradiusOwners: readonly string[];
  readonly ownerSearchTerm: string;
  readonly setOwnerSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  readonly onFileUpload: (
    e: ChangeEvent<HTMLInputElement>,
    field: string,
    onUploaded: (url: string) => void,
  ) => Promise<void>;
  readonly isEdit: boolean;
}

export function MitraFormFields({
  register,
  setValue,
  watch,
  errors,
  sites,
  mixradiusOwners,
  ownerSearchTerm,
  setOwnerSearchTerm,
  onFileUpload,
  isEdit,
}: MitraFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <MitraFormIdentitySection
        register={register}
        setValue={setValue}
        watch={watch}
        errors={errors}
        onFileUpload={onFileUpload}
        isEdit={isEdit}
      />
      <MitraFormJobSection
        register={register}
        setValue={setValue}
        watch={watch}
        sites={sites}
        mixradiusOwners={mixradiusOwners}
        ownerSearchTerm={ownerSearchTerm}
        setOwnerSearchTerm={setOwnerSearchTerm}
      />
      <MitraFormBankGaransiSection
        register={register}
        watch={watch}
        errors={errors}
      />
    </div>
  );
}
