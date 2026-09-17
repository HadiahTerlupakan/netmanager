# Caching Strategy

## Cache Layers

1. **Application cache**: In-memory (Node.js process) - untuk data yang jarang berubah
2. **Distributed cache**: Redis (shared across instances) - untuk session dan shared data
3. **Database cache**: Prisma query cache - automatic

## What to Cache

- ✅ Reference data: roles, permissions, sites, departments (TTL: 1 hour)
- ✅ Expensive queries: reports, aggregations, statistics (TTL: 5-15 minutes)
- ✅ External API responses: MikroTik topology (TTL: 5 minutes)
- ✅ Computed results: salary calculations, invoice summaries (TTL: 10 minutes)
- ❌ User-specific transactional data: cart, draft, pending approval
- ❌ Real-time data: active sessions, live status, current location

## Cache Invalidation Strategies

```typescript
// Strategy 1: TTL-based (simple, eventual consistency)
await cache.set("customers:list", data, { ttl: 300 }); // 5 minutes

// Strategy 2: Event-based (accurate, immediate consistency)
eventDispatcher.on("customer.updated", async (event) => {
  await cache.delete(`customer:${event.data.id}`);
  await cache.delete("customers:list"); // Invalidate list cache
});

// Strategy 3: Write-through (consistent, no stale data)
async function updateCustomer(id: string, data: UpdateData) {
  const customer = await repository.update(id, data);
  await cache.set(`customer:${id}`, customer, { ttl: 3600 });
  await cache.delete("customers:list"); // Invalidate list
  return customer;
}

// Strategy 4: Cache-aside (lazy loading)
async function getCustomer(id: string) {
  const cached = await cache.get(`customer:${id}`);
  if (cached) return cached;
  
  const customer = await repository.findById(id);
  if (customer) {
    await cache.set(`customer:${id}`, customer, { ttl: 3600 });
  }
  return customer;
}
```

## Cache Key Naming Convention

```typescript
// Pattern: <domain>:<entity>:<id>:<variant>
"users:user:123:detail"
"users:user:123:summary"
"finance:invoice:456:full"
"finance:invoices:list:page:1"
"network:topology:site:789"
```

## Cache Stampede Prevention

```typescript
// Use distributed lock untuk prevent multiple requests
async function getExpensiveData(key: string) {
  const cached = await cache.get(key);
  if (cached) return cached;
  
  const lock = await cache.lock(`lock:${key}`, { ttl: 10000 });
  if (!lock) {
    // Another process is computing, wait and retry
    await sleep(100);
    return cache.get(key) || getExpensiveData(key);
  }
  
  try {
    const result = await expensiveQuery();
    await cache.set(key, result, { ttl: 300 });
    return result;
  } finally {
    await lock.release();
  }
}
```
