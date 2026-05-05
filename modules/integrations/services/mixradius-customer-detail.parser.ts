import type { MixRadiusCustomerDetail } from "./mixradius-types";

/** Parse customer detail HTML into DTO. */
export function parseCustomerDetailHtml(
  html: string,
  customerId: string,
): MixRadiusCustomerDetail {
  return {
    id: customerId,
    member_id: extractValue(html, "memberId"),
    username: extractValue(html, "username"),
    password: extractValue(html, "password"),
    fullname: extractValue(html, "fullname"),
    email: extractValue(html, "email"),
    phonenumber: extractValue(html, "phonenumber"),
    address: extractTextarea(html, "address"),
    remote_address: extractValue(html, "remote_address") || "Automatic",
    plan_name: extractSelectedLabel(html, "id_plan"),
    payment_type: extractSelectedValue(html, "payment_type") || "POSTPAID",
    subscription_type:
      extractCheckedRadioValue(html, "subscription_type") || "regular",
    trx_status: extractSelectedValue(html, "trx_status") || "UNPAID",
    identity_number: extractValue(html, "identity_number"),
    created_at: "",
    renewed_on: extractValue(html, "renewed_on"),
    expired_on: extractValue(html, "expired_on"),
    auth_status:
      extractSelectedValue(html, "account_status") === "enabled"
        ? "Enabled-Users"
        : "Disabled-Users",
    note: extractValue(html, "note"),
    bind_mac: extractSelectedValue(html, "bindmac"),
    mac_address: extractMacAddress(html),
    total: "",
    latitude: extractValue(html, "latitude"),
    longitude: extractValue(html, "longitude"),
    odp_name: extractSelectedLabel(html, "odp_id"),
    owner_name: extractSelectedLabel(html, "owner").replace(
      /^Saat ini\s*:\s*/i,
      "",
    ),
    service_type: extractSelectedLabel(html, "nasporttype"),
    ip_type: extractSelectedLabel(html, "ip_address_type"),
    portal_password: extractValue(html, "portalpassword"),
    expired_action: extractSelectedLabel(html, "expired_action"),
    invoices: [],
    online: /Perangkat\s*\(\s*<b>\s*online\s*<\/b>\s*\)/i.test(html),
    uptime: extractMetric(
      html,
      /<i class="icon fa fa-calendar"><\/i>\s*([^<]+)\s*<\/h4>\s*Waktu Online/i,
    ),
    quota_usage: extractMetric(
      html,
      /<i class="icon fa fa-area-chart"><\/i>\s*([^<]+)\s*<\/h4>\s*Quota Terpakai/i,
    ),
  };
}

function extractValue(html: string, name: string) {
  const inputMatch = html.match(
    new RegExp(`<input[^>]*name="${name}"[^>]*>`, "i"),
  );
  const valueMatch = inputMatch?.[0].match(/value=['"]([^'"]*)['"]/i);
  return valueMatch?.[1] ?? "";
}

function extractTextarea(html: string, name: string) {
  return (
    html.match(
      new RegExp(`name="${name}"[^>]*>([^<]*)</textarea>`, "i"),
    )?.[1] ?? ""
  );
}

function extractSelectedLabel(html: string, name: string) {
  const selectContent = extractSelectContent(html, name);
  const selectedLabel = selectContent.match(
    /<option[^>]*selected[^>]*>([\s\S]*?)<\/option>/i,
  )?.[1];
  if (selectedLabel) {
    return selectedLabel.replace(/<[^>]*>/g, "").trim();
  }

  const selectedByValue = selectContent.match(
    /<option[^>]*value="([^"]*)"[^>]*selected[^>]*>([\s\S]*?)<\/option>/i,
  )?.[2];
  return selectedByValue?.replace(/<[^>]*>/g, "").trim() ?? "";
}

function extractSelectedValue(html: string, name: string) {
  const selectContent = extractSelectContent(html, name);
  return (
    selectContent.match(
      /<option[^>]*value=['"]([^'"]*)['"][^>]*selected/i,
    )?.[1] ??
    selectContent.match(
      /<option[^>]*selected[^>]*value=['"]([^'"]*)['"]/i,
    )?.[1] ??
    ""
  );
}

function extractSelectContent(html: string, name: string) {
  return (
    html.match(
      new RegExp(`<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`, "i"),
    )?.[1] ?? ""
  );
}

function extractCheckedRadioValue(html: string, name: string) {
  return (
    html.match(
      new RegExp(
        `input[^>]*name="${name}"[^>]*value="([^"]*)"[^>]*checked`,
        "i",
      ),
    )?.[1] ?? ""
  );
}

function extractMacAddress(html: string) {
  return (
    extractValue(html, "callerid") ||
    extractMetric(
      html,
      /<i class="icon fa fa-server"><\/i>\s*([0-9A-Fa-f:]{12,17})/i,
    )
  );
}

function extractMetric(html: string, regex: RegExp) {
  return html.match(regex)?.[1]?.trim() ?? "";
}
