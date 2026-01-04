# Blackboard

**Blackboard** is a high-performance Node.js server built with **Fastify**, designed for real-time peer-to-peer (P2P) communication and collaborative project management. It enables "agents" (human or automated) to interact through secure WebSockets, participate in project-specific channels, and maintain synchronized data using optimistic locking.

## 🚀 Features

-   **Real-time Messaging**: Direct peer-to-peer and channel-based broadcasting (Pub/Sub) via WebSockets.
-   **Project-Specific Channels**: Automatically created communication hubs for every project (`project-<id>-blackboard`).
-   **Optimistic Locking Store**: A specialized versioned data store that prevents concurrent write conflicts without a traditional database.
-   **Agent Discovery**: Dynamic registry of online agents with status tracking (online/offline).
-   **Secure by Default**: JWT-based authentication for both API endpoints and WebSocket upgrades.
-   **Structured Logging**: Integration with `pino` and `pino-pretty` for clear, actionable logs.

## 🛠 Architecture

The system utilizes a modular, plugin-based architecture:

-   **`DiscoveryService`**: Manages the network state and peer registry.
-   **`ChannelManager`**: Handles subscriptions, message broadcasting, and persistent history (JSONL).
-   **`ProjectManager`**: Manages project lifecycle and metadata.
-   **`VersionedStore`**: A file-system based storage engine with in-memory mutexes for serialized, atomic updates per record.

## 🚦 Getting Started

### Prerequisites

-   Node.js (v18 or higher recommended)
-   npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd blackboard

# Install dependencies
npm install
```

### Running the Server

```bash
# Start the server (defaults to port 3333)
npm start
```

## 🧪 Testing & Simulation

The project includes several scripts to verify system behavior:

-   **Peer-to-Peer Simulation**: Tests agent registration and direct messaging.
    ```bash
    node test/simulation.js
    ```
-   **Concurrency Test**: Verifies the optimistic locking mechanism and conflict detection.
    ```bash
    node test/concurrency.js
    ```
-   **External Agent Workflow**: Demonstrates the full end-to-end flow for an external agent.
    ```bash
    node test/external-agent-workflow.js
    ```

## 🔌 API Reference

### HTTP Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/register` | Register a new agent and receive a JWT token. |
| `POST` | `/login` | Get a token for an existing agent (dev/test only). |
| `POST` | `/projects` | Create a new project and initialize its blackboard. |
| `GET` | `/agents` | List all registered agents and their statuses. |
| `GET` | `/project-data/:id` | Retrieve the current versioned data for a project. |
| `PUT` | `/project-data/:id` | Update project data (requires correct version). |
| `GET` | `/channels/:id/history` | Fetch message history for a specific channel. |

### WebSocket Protocol

Connect to `ws://localhost:3333/ws?token=<YOUR_JWT_TOKEN>`.

**Message Format:**
```json
{
  "type": "JOIN_CHANNEL | CHANNEL_MESSAGE | MESSAGE | PING",
  "id": "optional-request-uuid",
  "payload": { ... }
}
```

## 📂 Project Structure

```text
├── src/
│   ├── index.js          # Entry point & API Routes
│   ├── lib/              # Core Logic (Discovery, Managers, Store)
│   └── plugins/          # Fastify Plugins (WS, Auth)
├── data/                 # Persistent storage (JSON/JSONL)
├── test/                 # Simulation & verification scripts
└── package.json          # Dependencies & Scripts
```

## 📄 License

This project is licensed under the ISC License.
