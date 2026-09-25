# Vault: Fault-Tolerant Distributed Object Storage System

Vault is a distributed, fault-tolerant object storage system inspired by the architectural principles of Ceph, MinIO, and Amazon S3. It is designed to provide high availability, data durability, automatic replica healing, and cluster resilience across independent storage nodes.

---

## 1. What Vault Is

Vault provides an S3-compatible conceptual object store with:
- **Resilient Distributed Storage**: Distributes object replicas across multiple isolated storage nodes.
- **High Availability & Quorum Consensus**: With 5 storage nodes, the cluster maintains availability even if 2 nodes fail concurrently (tolerating $f = \lfloor(N - 1)/2\rfloor$ faults).
- **Self-Healing & Integrity**: Foundation for SHA-256 integrity verification, replica corruption detection, and automatic background repair.
- **Dedicated Infrastructure Control Plane**: A sleek, dark-mode observability dashboard providing real-time telemetry on node heartbeats, storage utilization, and cluster consensus.

---

## 2. Architecture & Separation of Concerns

Vault enforces a strict layered backend architecture:

$$\text{Routes} \longrightarrow \text{Controllers} \longrightarrow \text{Services} \longrightarrow \text{Repositories} \longrightarrow \text{Prisma / SQLite}$$

- **Routes (`server/src/routes/`)**: Pure routing contracts mapping HTTP verbs to controllers.
- **Controllers (`server/src/controllers/`)**: HTTP boundary extracting requests, validating parameters, and returning standardized API responses (`sendSuccess` / `sendError`).
- **Services (`server/src/services/`)**: Core domain logic, node heartbeat management, and cluster health calculations.
- **Repositories (`server/src/repositories/`)**: Data persistence layer interfacing with SQLite through Prisma ORM.

---

## 3. Technology Stack

- **Frontend**:
  - React 18
  - Vite 6
  - TypeScript (Strict Mode)
  - Tailwind CSS 3
  - Lucide React (Infrastructure icons)
- **Backend**:
  - Node.js (v20+)
  - Express
  - TypeScript (Strict Mode)
  - Prisma ORM 5
- **Database**:
  - SQLite (Metadata, nodes, object versions, replicas, and audit events)
- **Tooling & Orchestration**:
  - `npm`
  - `tsx` (TypeScript execute & watch)
  - `concurrently` (Multi-process development orchestration)

---

## 4. Project Structure

```
vault/
├── client/                     # Vite + React + Tailwind frontend dashboard
│   ├── src/
│   │   ├── api/                # Modular API client abstraction and types
│   │   ├── components/         # Control plane UI components
│   │   │   ├── Header.tsx
│   │   │   ├── StatsOverview.tsx
│   │   │   ├── ClusterHealthCard.tsx
│   │   │   ├── NodeCard.tsx
│   │   │   ├── NodeGrid.tsx
│   │   │   └── EventsPlaceholder.tsx
│   │   ├── App.tsx             # Main dashboard view
│   │   └── index.css           # Tailwind design tokens
│   ├── package.json
│   └── vite.config.ts
├── server/                     # Express + TypeScript + Prisma backend
│   ├── prisma/
│   │   └── schema.prisma       # Node, Object, Replica, and Event schema
│   ├── src/
│   │   ├── controllers/        # HTTP controllers (Health, Node, Cluster)
│   │   ├── routes/             # REST endpoints (/api/health, /api/nodes, /api/cluster)
│   │   ├── services/           # Domain business logic
│   │   ├── repositories/       # Prisma data access layer
│   │   ├── middleware/         # Logger & Global error handler
│   │   ├── utils/              # Response formatting & BigInt serialization
│   │   ├── types/              # Domain and API types
│   │   ├── config.ts           # Type-safe environment config
│   │   └── index.ts            # Application bootstrap & graceful shutdown
│   ├── package.json
│   └── tsconfig.json
├── storage/                    # Independent logical storage volumes
│   ├── node-a/                 # Storage node volume A (10 GB)
│   ├── node-b/                 # Storage node volume B (10 GB)
│   ├── node-c/                 # Storage node volume C (10 GB)
│   ├── node-d/                 # Storage node volume D (10 GB)
│   └── node-e/                 # Storage node volume E (10 GB)
├── docs/
│   └── architecture.md         # In-depth architectural specifications
├── .env.example                # Sample environment configuration
├── .gitignore                  # Git ignore rules
├── package.json                # Monorepo scripts
└── README.md                   # Project documentation
```

---

## 5. How to Install

Ensure you have **Node.js 20+** and **npm** installed.

Clone the repository and install all dependencies:

```bash
# Install root, server, and client dependencies
npm run install:all
```

Or install individually:

```bash
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

---

## 6. How to Run Backend

1. Set up the environment file (optional, defaults work out of the box):
   ```bash
   cp .env.example .env
   ```

2. Initialize the SQLite database and Prisma schema:
   ```bash
   npm run db:push
   ```

3. Start the backend in development mode (with auto-reload):
   ```bash
   npm run dev:server
   ```

The backend starts at `http://localhost:4000`:
- Health Check: `GET http://localhost:4000/api/health`
- Node Registry: `GET http://localhost:4000/api/nodes`
- Cluster Health: `GET http://localhost:4000/api/cluster/health`

---

## 7. How to Run Frontend

Start the Vite development server:

```bash
npm run dev:client
```

Open `http://localhost:5173` in your browser.

### Run Both Concurrently

To run both backend and frontend with a single command:

```bash
npm run dev
```

---

## 8. How the Storage-Node Simulation Works

In production distributed stores like Ceph, nodes run as daemons across independent physical hosts or block devices. 

In Vault:
1. **Logical Isolation**: Five independent directories (`storage/node-a` through `storage/node-e`) act as independent physical disks.
2. **Metadata Registration**: Each node is registered in SQLite with its own capacity limit (10 GB default), used capacity, and heartbeat tracker.
3. **Partition & Failure Simulation (Planned for Part 3+)**: We can simulate disk failures, partial network partitions, or corrupt byte streams inside a specific node directory without disrupting the rest of the cluster.

---

## 9. Current Part 1 Limitations

Part 1 is strictly the foundational phase:
- **No Object Transfers Yet**: Object upload, streaming retrieval, and multi-part upload will be built in Part 2.
- **No Active Replication**: Replicas are modeled in the schema but not yet actively written to node directories.
- **Static Status**: All 5 nodes initialize to `HEALTHY`; node failure toggles and chaos injectors arrive in later modules.
- **No Authentication**: The API is open for local development without token auth.

---

## 10. Planned Future Modules

- **Part 2: Object Upload & Replication Engine**
  - Chunked object upload pipeline
  - Synchronous / asynchronous replication across 3 chosen nodes
  - SHA-256 checksum calculation and verification on write
- **Part 3: Chaos Simulation & Failure Detection**
  - Node disconnect / crash simulation
  - Network latency injection
  - Heartbeat timeout monitor and auto-marking nodes as `UNHEALTHY`
- **Part 4: Data Corruption & Inconsistency Detection**
  - Periodic background scrubber
  - Bit rot detection via checksum mismatch
- **Part 5: Automatic Healing & Rebalancing**
  - Self-healing coordinator re-replicating degraded objects to healthy nodes
  - Storage rebalancing when new nodes join or capacities skew
