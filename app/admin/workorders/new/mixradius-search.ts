type MixRadiusCustomer = {
  id: string;
  member_id: string;
  fullname: string;
  address: string;
  phonenumber: string;
  plan_name: string;
  remote_address: string;
  username: string;
};

type MixRadiusSearchSuccessPayload = {
  success: boolean;
  data?: {
    data?: MixRadiusCustomer[];
    error?: string;
    isConfigError?: boolean;
  };
  error?: string;
  details?: {
    isConfigError?: boolean;
  };
};

function getMixRadiusErrorMessage(payload: MixRadiusSearchSuccessPayload) {
  return (
    payload.error ||
    payload.data?.error ||
    "Gagal mencari data MixRadius. Silakan coba lagi."
  );
}

function isMixRadiusConfigErrorPayload(payload: MixRadiusSearchSuccessPayload) {
  return payload.details?.isConfigError || payload.data?.isConfigError;
}

export async function readMixRadiusSearchResponse(response: {
  ok: boolean;
  json: () => Promise<MixRadiusSearchSuccessPayload>;
}): Promise<MixRadiusCustomer[]> {
  const payload = await response.json();

  if (!response.ok || isMixRadiusConfigErrorPayload(payload)) {
    throw new Error(getMixRadiusErrorMessage(payload));
  }

  return payload.data?.data || [];
}

export type { MixRadiusCustomer };
