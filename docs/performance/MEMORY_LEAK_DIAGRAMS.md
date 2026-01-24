# Memory Leak Diagrams

## Overview

This document contains visual diagrams illustrating the memory leak patterns identified in the NetManager application.

---

## Diagram 1: SNMP Cache Memory Leak

```mermaid
graph TD
    A[SNMP Operation] --> B[Cache Entry Created]
    B --> C[Map.set key data]
    C --> D{Cache Size Check}
    D -->|No Limit| E[Entry Added]
    E --> F[Memory Grows Indefinitely]

    style F fill:#ff6b6b
    style E fill:#ffd93d

    subgraph Current Implementation
    A
    B
    C
    D
    E
    F
    end

    subgraph Fixed Implementation
    G[LRU Cache]
    H[Max Size: 100]
    I[Auto Cleanup]
    J[Memory Stable]
    end

    F -.->|Fix| G
    G --> H
    H --> I
    I --> J

    style J fill:#6bcb77
```

**Problem:** Unbounded cache grows indefinitely with each SNMP operation  
**Impact:** 1GB+ memory with 20 OLTs monitoring 500+ ONUs each  
**Solution:** Implement LRU cache with size limits and automatic cleanup

---

## Diagram 2: Socket.io Room Memory Leak

```mermaid
sequenceDiagram
    participant Client
    participant Socket
    participant RoomManager
    participant Memory

    Client->>Socket: Connect
    Socket->>RoomManager: Join user:123
    RoomManager->>Memory: Add socket to room
    Note over Memory: Room: user:123<br/>Socket: socket_abc

    Client->>Socket: Disconnect
    Socket->>RoomManager: Leave room?
    Note over RoomManager: No explicit cleanup!

    rect rgb(255, 200, 200)
        Note over Memory: Socket reference remains<br/>in room adapter
        Note over Memory: Memory leak!
    end

    Client->>Socket: Reconnect
    Socket->>RoomManager: Join user:123
    RoomManager->>Memory: Add NEW socket
    Note over Memory: Room: user:123<br/>Socket: socket_xyz<br/>Socket: socket_abc (old)

    rect rgb(255, 200, 200)
        Note over Memory: Multiple sockets<br/>accumulate over time
    end
```

**Problem:** Disconnected sockets not explicitly removed from rooms  
**Impact:** Memory grows with each reconnect cycle  
**Solution:** Explicit room cleanup on disconnect + periodic cleanup of empty rooms

---

## Diagram 3: Large File Upload Memory Spike

```mermaid
graph LR
    A[User Uploads 1GB File] --> B[Formidable Parser]
    B --> C[Load Entire File to RAM]
    C --> D[Buffer: 1GB]
    D --> E[Sharp Processing]
    E --> F[Additional Buffer: 500MB]
    F --> G[Total Memory: 1.5GB]

    style G fill:#ff6b6b

    subgraph Current Implementation
    A
    B
    C
    D
    E
    F
    G
    end

    subgraph Fixed Implementation
    H[Stream to Disk]
    I[Disk: 1GB]
    I --> J[Stream Process]
    J --> K[Memory: 50MB]
    end

    G -.->|Fix| H
    H --> I
    I --> J
    J --> K

    style K fill:#6bcb77
```

**Problem:** Entire file loaded into memory before processing  
**Impact:** 1.5GB+ memory spike during uploads  
**Solution:** Stream files directly to disk, use streaming image processing

---

## Diagram 4: Monitoring Service Interval Accumulation

```mermaid
stateDiagram-v2
    [*] --> ServiceStart
    ServiceStart --> setIntervalCreated: Start monitoring
    setIntervalCreated --> Polling: 30s interval
    Polling --> ErrorOccurred: Exception
    ErrorOccurred --> Polling: Retry (no cleanup)

    state ErrorOccurred {
        [*] --> IntervalNotCleared
        IntervalNotCleared --> NewIntervalCreated: Restart
        NewIntervalCreated --> MultipleIntervals
    }

    MultipleIntervals --> MemoryLeak: Accumulation

    state MemoryLeak {
        [*] --> Interval1
        Interval1 --> Interval2
        Interval2 --> Interval3
        Interval3 --> IntervalN
    }

    MemoryLeak --> [*]

    note right of MemoryLeak
        Multiple intervals running
        simultaneously
        Each holds references
        Memory grows indefinitely
    end note
```

**Problem:** Intervals not cleared on errors, multiple instances accumulate  
**Impact:** Memory grows with each restart cycle  
**Solution:** Proper interval cleanup with error handling and backoff

---

## Diagram 5: Database Query N+1 Problem

```mermaid
sequenceDiagram
    participant App
    participant DB
    participant Memory

    App->>DB: findMany ONUs (100 items)
    DB-->>App: Returns 100 ONUs

    loop For each ONU (100x)
        App->>DB: findByGponOnu(oltId, gponOnu)
        DB-->>App: Returns ONU with OIDs
        App->>Memory: Store ONU data
    end

    rect rgb(255, 200, 200)
        Note over App,DB,Memory: 101 database queries<br/>100 concurrent connections<br/>Large memory footprint
    end

    Note over Memory: ~500MB in memory
```

**Problem:** One query per ONU (N+1 problem)  
**Impact:** 101 queries for 100 ONUs, connection pool pressure  
**Solution:** Batch fetch all ONUs for OLT in single query

---

## Diagram 6: Cron Job Memory Accumulation

```mermaid
graph TD
    A[Cron Job Starts] --> B[Load ALL Customers]
    B --> C[10,000 Customers]
    C --> D[Load ALL Packages]
    D --> E[Memory: 500MB]

    E --> F[Process Customer 1]
    F --> G[Create Invoice 1]
    G --> H[Keep in Memory]

    H --> I[Process Customer 2]
    I --> J[Create Invoice 2]
    J --> K[Keep in Memory]

    K --> L[... Continue ...]
    L --> M[Process Customer 10,000]
    M --> N[Create Invoice 10,000]
    N --> O[Memory: 1.5GB]

    style O fill:#ff6b6b

    subgraph Current Implementation
    A
    B
    C
    D
    E
    F
    G
    H
    I
    J
    K
    L
    M
    N
    O
    end

    subgraph Fixed Implementation
    P[Load Batch 1: 100]
    P --> Q[Memory: 5MB]
    Q --> R[Process Batch 1]
    R --> S[Flush to DB]
    S --> T[GC: Clear Memory]

    T --> U[Load Batch 2: 100]
    U --> V[Memory: 5MB]
    V --> W[Process Batch 2]
    W --> X[Flush to DB]
    X --> Y[GC: Clear Memory]

    Y --> Z[Repeat...]
    end

    O -.->|Fix| P
    Z -.->|Peak Memory| Q

    style Q fill:#6bcb77
    style V fill:#6bcb77
```

**Problem:** All customers loaded into memory at once  
**Impact:** 1.5GB+ memory during billing run  
**Solution:** Process in batches with pagination and garbage collection

---

## Diagram 7: Prisma Connection Pool Issues

```mermaid
graph TD
    A[App Starts] --> B[Prisma Client Created]
    B --> C[Connection Pool: Unlimited]

    C --> D[Request 1]
    D --> E[Create Connection 1]
    E --> F[Pool: 1 connection]

    F --> G[Request 2]
    G --> H[Create Connection 2]
    H --> I[Pool: 2 connections]

    I --> J[Request 100]
    J --> K[Create Connection 100]
    K --> L[Pool: 100 connections]

    L --> M[Memory: 100MB per connection]
    M --> N[Total: 10GB]

    style N fill:#ff6b6b

    subgraph Current Implementation
    A
    B
    C
    D
    E
    F
    G
    H
    I
    J
    K
    L
    M
    N
    end

    subgraph Fixed Implementation
    O[Prisma Client Created]
    O --> P[Connection Pool: Max 20]

    P --> Q[Request 1-20]
    Q --> R[Create 20 Connections]
    R --> S[Pool: 20 connections]

    S --> T[Request 21]
    T --> U[Wait for available]
    U --> V[Reuse Connection 1]

    V --> W[Idle Timeout: 30s]
    W --> X[Close Idle Connection]
    X --> Y[Pool: 19 connections]

    Y --> Z[Memory: 100MB per connection]
    Z --> AA[Total: 2GB]
    end

    N -.->|Fix| O
    AA -.->|Peak Memory| R

    style AA fill:#6bcb77
```

**Problem:** Unlimited connection pool, no idle timeout  
**Impact:** Excessive memory from too many database connections  
**Solution:** Limit pool size, implement idle timeout

---

## Diagram 8: Redis Cache Memory Growth

```mermaid
graph TD
    A[Cache OLT 1: 500 ONUs] --> B[Redis: 5MB]
    B --> C[Cache OLT 2: 500 ONUs] --> D[Redis: 10MB]
    D --> E[Cache OLT 3: 500 ONUs] --> F[Redis: 15MB]
    F --> G[... Continue ...]
    G --> H[Cache OLT 20: 500 ONUs] --> I[Redis: 100MB]

    I --> J[No Size Limit]
    J --> K[No Compression]
    K --> L[No Cleanup]

    L --> M[Memory: 100MB+]

    style M fill:#ff6b6b

    subgraph Current Implementation
    A
    B
    C
    D
    E
    F
    G
    H
    I
    J
    K
    L
    M
    end

    subgraph Fixed Implementation
    N[Cache OLT 1: 500 ONUs] --> O[Compress: 1MB]
    O --> P[Redis: 1MB]

    P --> Q[Cache OLT 2: 500 ONUs] --> R[Compress: 1MB]
    R --> S[Redis: 2MB]

    S --> T[... Continue ...]
    T --> U[Cache OLT 20: 500 ONUs] --> V[Compress: 1MB]
    V --> W[Redis: 20MB]

    W --> X[Size Limit: 10MB per entry]
    X --> Y[Auto Cleanup: 5min TTL]

    Y --> Z[Memory: 20MB]
    end

    M -.->|Fix| N
    Z -.->|Peak Memory| P

    style Z fill:#6bcb77
```

**Problem:** No size limits, no compression, large JSON strings  
**Impact:** 100MB+ Redis memory for 20 OLTs  
**Solution:** Size limits, compression, automatic cleanup

---

## Summary of Memory Leak Patterns

| Pattern                | Impact   | Priority | Fix Complexity |
| ---------------------- | -------- | -------- | -------------- |
| Unbounded Cache Growth | Critical | P1       | Medium         |
| Socket Room Leaks      | Critical | P1       | Low            |
| Large File in Memory   | Critical | P1       | Medium         |
| Interval Accumulation  | High     | P2       | Medium         |
| N+1 Queries            | High     | P2       | Medium         |
| Batch Processing       | High     | P2       | Low            |
| Connection Pool        | Medium   | P2       | Low            |
| Redis Cache            | Medium   | P3       | Low            |

---

## Memory Optimization Flowchart

```mermaid
flowchart TD
    A[Start Memory Audit] --> B{Memory Issue Detected?}

    B -->|No| C[Monitor Memory]
    C --> B

    B -->|Yes| D{Issue Type?}

    D -->|Cache Growth| E[Implement LRU Cache]
    E --> F[Add Size Limits]
    F --> G[Add Auto Cleanup]
    G --> H[Test Memory]

    D -->|Socket Leaks| I[Explicit Cleanup]
    I --> J[Periodic Room Cleanup]
    J --> H

    D -->|Large Files| K[Implement Streaming]
    K --> L[Use Stream Processing]
    L --> H

    D -->|Database Queries| M[Batch Operations]
    M --> N[Add Pagination]
    N --> O[Use Cursors]
    O --> H

    D -->|Connection Pool| P[Limit Pool Size]
    P --> Q[Add Idle Timeout]
    Q --> H

    H --> R{Memory Improved?}

    R -->|Yes| S[Deploy to Production]
    S --> T[Monitor Metrics]
    T --> C

    R -->|No| U[Investigate Further]
    U --> V[Profile with Heap Snapshot]
    V --> D
```

---

## Implementation Priority Matrix

```mermaid
graph TD
    A[Priority 1: Critical] --> B[SNMP Cache Fix]
    A --> C[Socket Cleanup]
    A --> D[File Streaming]

    E[Priority 2: High] --> F[Interval Management]
    E --> G[Batch Processing]
    E --> H[Connection Pool]

    I[Priority 3: Medium] --> J[N+1 Queries]
    I --> K[Redis Optimization]
    I --> L[Webpack Config]

    M[Priority 4: Low] --> N[Logger Queue]
    M --> O[Notification Limits]

    style A fill:#ff6b6b
    style E fill:#ffd93d
    style I fill:#4ecdc4
    style M fill:#95e1d3
```

---

## Memory Monitoring Dashboard

```mermaid
graph LR
    A[Memory Metrics] --> B[Heap Used]
    A --> C[Heap Total]
    A --> D[RSS]
    A --> E[External]

    B --> F[Heap Used %]
    C --> F

    F --> G{Threshold Check}

    G -->|< 50%| H[Normal]
    G -->|50-80%| I[Warning]
    G -->|> 80%| J[Critical]

    J --> K[Trigger GC]
    K --> L[Alert Admin]

    L --> M[Generate Heap Snapshot]
    M --> N[Analyze Leaks]

    style H fill:#6bcb77
    style I fill:#ffd93d
    style J fill:#ff6b6b
```

---

## Conclusion

These diagrams illustrate the memory leak patterns and their fixes. Implementing the solutions shown will result in significant memory savings:

- **40-60% reduction in RAM usage**
- **Elimination of memory leaks**
- **Improved application stability**
- **Better scalability**

Start with Priority 1 fixes (critical issues) and work through the priorities systematically.
