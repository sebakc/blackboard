# Blackboard Integration Guide

This guide provides the necessary information to integrate external agents with the Blackboard server using RESTful APIs and WebSockets.

---

## 1. Project Management API (CRUD)

The REST API allows you to manage project resources. Projects serve as the organizational unit for collaboration.

**Base URL:** `http://localhost:3333`

### **List All Projects**
Retrieves a list of all active projects.

*   **Method:** `GET`
*   **Endpoint:** `/projects`
*   **Response Schema:**
    ```json
    [
      {
        "id": "uuid",
        "name": "string",
        "channelId": "uuid"
      }
    ]
    ```
*   **Status Codes:**
    *   `200 OK`: Success.

### **Create a Project**
Creates a new project, initializes its versioned blackboard data store, and provisions a communication channel.

*   **Method:** `POST`
*   **Endpoint:** `/projects`
*   **Request Body:**
    ```json
    {
      "projectName": "string" 
    }
    ```
*   **Response Schema:**
    ```json
    {
      "projectId": "uuid",
      "channelId": "uuid",
      "channelEndpoint": "ws://localhost:3333/ws"
    }
    ```
*   **Status Codes:**
    *   `200 OK`: Project created successfully.
    *   `400 Bad Request`: Missing `projectName`.
    *   `409 Conflict`: A project with this name already exists.

### **Get Project Details**
Retrieves metadata for a specific project by its ID.

*   **Method:** `GET`
*   **Endpoint:** `/projects/:id`
*   **Response Schema:**
    ```json
    {
      "id": "uuid",
      "name": "string",
      "channelId": "uuid",
      "created": 1767401949796
    }
    ```
*   **Status Codes:**
    *   `200 OK`: Success.
    *   `404 Not Found`: Invalid Project ID.

### **Delete a Project**
Permanently removes a project and its metadata.

*   **Method:** `DELETE`
*   **Endpoint:** `/projects/:id`
*   **Response Schema:**
    ```json
    {
      "message": "Project deleted successfully"
    }
    ```
*   **Status Codes:**
    *   `200 OK`: Success.
    *   `404 Not Found`: Project ID does not exist.

---

## 2. Project Data API (Versioned Blackboard)

This API manages the persistent state of a project using optimistic locking.

### **Get Current Data**
*   **Method:** `GET`
*   **Endpoint:** `/project-data/:projectId`
*   **Response:** Returns the current data record including the `version`.

### **Update Data (Optimistic Locking)**
*   **Method:** `PUT`
*   **Endpoint:** `/project-data/:projectId`
*   **Request Body:**
    ```json
    {
      "version": 1, // Must match the current version on the server
      "data": { ... } // Your data payload
    }
    ```
*   **Status Codes:**
    *   `200 OK`: Success (returns the new version).
    *   `409 Conflict`: Version mismatch. Someone else updated the data. You must GET the data again and retry.

---

## 3. WebSocket Connection Guide

The WebSocket interface provides real-time updates and low-latency communication between agents.

### **Step 1: Authentication**
All WebSocket connections must be authenticated.
1.  Register via `POST /register` to receive a JWT token.
2.  Use the token as a query parameter in the connection URL.

### **Step 2: Connecting**
Connect to the server using the following URL format:
`ws://localhost:3333/ws?token=YOUR_JWT_TOKEN`

### **Step 3: Joining a Channel**
WebSockets use a Pub/Sub model. To receive messages for a specific project, you must explicitly join its channel using the `channelId` obtained from the Project API.

**Message to Send:**
```json
{
  "type": "JOIN_CHANNEL",
  "id": "unique-request-id",
  "payload": {
    "channelId": "your-project-channel-id"
  }
}
```

### **Step 4: Real-time Communication**
Once joined, you will receive `CHANNEL_MESSAGE` events whenever any agent (including yourself) publishes to that channel.

**Receiving a Message:**
```json
{
  "type": "CHANNEL_MESSAGE",
  "senderId": "agent-uuid",
  "timestamp": 1767401949813,
  "payload": {
    "channelId": "uuid",
    "content": { ... } // The broadcasted data
  }
}
```

**Publishing a Message:**
```json
{
  "type": "CHANNEL_MESSAGE",
  "id": "unique-request-id",
  "payload": {
    "channelId": "your-project-channel-id",
    "content": { "message": "Hello world!" }
  }
}
```
