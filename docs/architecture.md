# Vault: Architecture Specification

Vault is a fault-tolerant distributed object storage system engineered for high availability, self-healing, and data integrity across independent storage nodes.

## 1. System Topology Overview

```
                      +-----------------------------+
                      |       Vault Dashboard       |
                      |   (React + Vite + Tailwind) |
                      +--------------+--------------+
                                     |
                                     | HTTP / REST
                                     v
                      +-----------------------------+
                      |      Vault API Server       |
                      |   (Node.js + Express + TS)  |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               |                     |                     |
               v                     v                     v
        +-------------+       +-------------+       +-------------+
        |   Routes    |       | Middleware  |       |   Prisma    |
        +------+------+       +-------------+       +------+------+
               |                                           |
               v                                           v
        +-------------+                             +-------------+
        | Controllers |                             |   SQLite    |
        +------+------+                             |  (Metadata) |
               |                                    +-------------+
               v
        +-------------+
        |  Services   |
        +------+------+
               |
               v
        +-------------+
        |Repositories |
        +------+------+
               |
               +---------------------+---------------------+
               |                     |                     |
               v                     v                     v
        +-------------+       +-------------+       +-------------+
        | Node Repo   |       | Event Repo  |       | Object Repo |
        +-------------+       +-------------+       +-------------+
               |
               +---------------------------------------------------+
               |               Logical Storage Targets             |
               v                                                   v
   +-----------------------+                           +-----------------------+
   | storage/node-a/ (10GB)|  ... (5 Independent Nodes) | storage/node-e/ (10GB)|
   +-----------------------+                           +-----------------------+
```

## 2. Separation of Concerns (Backend)

The server enforces a strict 4-layer architecture:
1. **Routes (`server/src/routes/`)**: Pure route declarations mapping HTTP methods and endpoints to controllers. Zero business logic.
2. **Controllers (`server/src/controllers/`)**: HTTP boundary parsing request inputs, parameters, query strings, and dispatching to services. Serializes uniform responses via `sendSuccess` and `sendError`.
3. **Services (`server/src/services/`)**: Core domain logic, cluster health heuristics, node management, quorum calculation, and metric aggregation.
4. **Repositories (`server/src/repositories/`)**: Data access layer interfacing directly with Prisma ORM and the underlying SQLite database.

## 3. Storage Node Simulation

- Independent logical storage nodes are modeled as isolated directory trees:
  - `storage/node-a/`
  - `storage/node-b/`
  - `storage/node-c/`
  - `storage/node-d/`
  - `storage/node-e/`
- Each node maintains isolated status, heartbeat telemetry, and capacity accounting in the database (`Node` table).
- Node failures in future modules will be simulated by toggling node status and isolating directory access, enabling chaos testing and partial partition simulation without needing 5 physical machines or VMs.

## 4. Fault Tolerance & Quorum Mechanics

- **Total Nodes**: 5 nodes (`node-a` through `node-e`)
- **Quorum Requirement**: $\lfloor N/2 \rfloor + 1 = \lfloor 5/2 \rfloor + 1 = 3$ nodes required for healthy write/read consensus.
- **Fault Tolerance**: Up to 2 concurrent node failures tolerated without data unavailability.
- **Health States**:
  - `HEALTHY`: Node is reachable and reporting regular heartbeats.
  - `DEGRADED`: Node is experiencing performance degradation or latency warnings.
  - `UNHEALTHY`: Node has failed integrity checks or missed multiple heartbeats.
  - `OFFLINE`: Node is unreachable or manually partitioned.

## 5. Data Models (Prisma)

- **`Node`**: Tracks node identity, availability status, storage capacities (total/used), and heartbeat timestamps.
- **`Object`**: Object metadata including content type, size, SHA-256 checksum, logical version, and target replication factor.
- **`Replica`**: Maps an object to a physical node, verifying the specific node replica checksum, version, and sync status.
- **`Event`**: Immutable cluster audit stream recording cluster events, node transitions, and sync activities.
