"use client";

import { useEffect, useState } from "react";
import {
  fetchActiveSites,
  fetchDepartments,
  fetchRoles,
  fetchTenants,
  type ReferenceDepartment,
  type ReferenceRole,
  type ReferenceSite,
  type ReferenceTenant,
} from "./userDetailApi";
import { mergeSites } from "../[id]/user-detail-helpers";

interface UseUserReferenceDataOptions {
  canReadTenants: boolean;
}

interface UseUserReferenceDataResult {
  departments: ReferenceDepartment[];
  roles: ReferenceRole[];
  sites: ReferenceSite[];
  tenants: ReferenceTenant[];
  setSites: React.Dispatch<React.SetStateAction<ReferenceSite[]>>;
  loading: boolean;
}

/**
 * Muat seluruh data referensi yang dibutuhkan form user admin.
 * Fokus hanya pada data referensi; fetch user detail tetap di komponen
 * karena erat dengan inisialisasi state form.
 */
export function useUserReferenceData({
  canReadTenants,
}: UseUserReferenceDataOptions): UseUserReferenceDataResult {
  const [departments, setDepartments] = useState<ReferenceDepartment[]>([]);
  const [roles, setRoles] = useState<ReferenceRole[]>([]);
  const [sites, setSites] = useState<ReferenceSite[]>([]);
  const [tenants, setTenants] = useState<ReferenceTenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const tasks: Array<Promise<void>> = [
      fetchDepartments().then((value) => {
        if (active) setDepartments(value);
      }),
      fetchRoles().then((value) => {
        if (active) setRoles(value);
      }),
      fetchActiveSites().then((value) => {
        if (active) setSites((current) => mergeSites(current, value));
      }),
    ];

    if (canReadTenants) {
      tasks.push(
        fetchTenants().then((value) => {
          if (active) setTenants(value);
        }),
      );
    }

    Promise.all(tasks).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [canReadTenants]);

  return {
    departments,
    roles,
    sites,
    tenants,
    setSites,
    loading,
  };
}
