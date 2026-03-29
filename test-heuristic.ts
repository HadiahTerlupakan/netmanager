const data1 = {
  id: "d05b32bb-f441-4584-a5fe-0a9cd0ea2d87",
  name: "10Mbps",
  profilePPP: { connect: { id: "2bf2392d-63cf-49f2-999f-92aa0e2618ec" } },
};

const data2: { odpId: string | null; siteId: string } = {
  odpId: null,
  siteId: "cec1bfea-c9b2-459c-ba57-646d8971e2b8",
};

function determineInjection(dataArgs: Record<string, unknown>, tenantId: string) {
  const hasRelationPayload = Object.values(dataArgs).some(val => 
    val !== null && typeof val === 'object' && ('connect' in val || 'create' in val || 'connectOrCreate' in val)
  );

  if (hasRelationPayload) {
    return { ...dataArgs, tenant: { connect: { id: tenantId } } };
  } else {
    return { ...dataArgs, tenantId };
  }
}

console.log('data1:', determineInjection(data1, 't-123'));
console.log('data2:', determineInjection(data2, 't-123'));
