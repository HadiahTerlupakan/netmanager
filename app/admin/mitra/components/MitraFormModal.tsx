"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import type { MitraFormState, Site } from "./types";
import {
  mitraAddFormSchema,
  mitraEditFormSchema,
} from "@/lib/validations/mitraFormAdapter";
import { MitraFormFields } from "./MitraFormFields";

export interface MitraFormModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly submitLabel: string;
  readonly submittingLabel: string;
  readonly saving: boolean;
  readonly onSubmit: (values: MitraFormState) => Promise<void>;
  readonly defaultValues: MitraFormState;
  readonly sites: readonly Site[];
  readonly onFileUpload: (
    e: React.ChangeEvent<HTMLInputElement>,
    field: string,
    onUploaded: (url: string) => void,
  ) => Promise<void>;
  readonly isEdit: boolean;
}

export function MitraFormModal({
  isOpen,
  onClose,
  title,
  submitLabel,
  submittingLabel,
  saving,
  onSubmit,
  defaultValues,
  sites,
  onFileUpload,
  isEdit,
}: MitraFormModalProps) {
  const resolver = zodResolver(
    isEdit ? mitraEditFormSchema : mitraAddFormSchema,
  );

  const { register, handleSubmit, reset, setValue, watch, formState } =
    useForm<MitraFormState>({
      resolver,
      defaultValues,
    });
  const { errors } = formState;

  useEffect(() => {
    if (isOpen) reset(defaultValues);
  }, [isOpen, defaultValues, reset]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <MitraFormFields
        register={register}
        setValue={setValue}
        watch={watch}
        errors={errors}
        sites={sites}
        onFileUpload={onFileUpload}
        isEdit={isEdit}
      />
      <ModalFooter>
        <button
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Batal
        </button>
        <button
          onClick={handleSubmit((values) => void onSubmit(values))}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50"
        >
          {saving ? submittingLabel : submitLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}
