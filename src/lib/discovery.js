const EventEmitter = require('events');

/**
 * Simulates a Distributed Hash Table (DHT) or Gossip-based Discovery Service.
 * In a real-world scenario, this would connect to a Kademlia DHT or a Redis cluster.
 */
class DiscoveryService extends EventEmitter {
  constructor(logger) {
    super();
    this.peers = new Map(); // Active connections: peerId -> { socket, metadata }
    this.agents = new Map(); // All known agents: peerId -> { id, name, status, lastSeen }
    this.logger = logger;
  }

  /**
   * Registers or updates an agent's status to Online.
   */
  async register(peerId, socket, metadata = {}) {
    const name = metadata.name || peerId;
    this.peers.set(peerId, { socket, metadata });
    
    this.agents.set(peerId, {
      id: peerId,
      name: name,
      status: 'online',
      lastSeen: Date.now(),
      metadata
    });

    this.logger.info({ peerId, name }, 'Peer registered and online');
    this.gossip({ type: 'PEER_ONLINE', peerId, name });
  }

  /**
   * Updates an agent's status to Offline.
   */
  async unregister(peerId) {
    if (this.peers.has(peerId)) {
      this.peers.delete(peerId);
      const agent = this.agents.get(peerId);
      if (agent) {
        agent.status = 'offline';
        agent.lastSeen = Date.now();
      }
      this.logger.info({ peerId }, 'Peer unregistered and offline');
      this.gossip({ type: 'PEER_OFFLINE', peerId });
    }
  }

  /**
   * Returns a list of all known agents.
   */
  getAllAgents() {
    return Array.from(this.agents.values());
  }

  /**
   * Finds a peer.
   * First checks local connections, then routing table (DHT).
   */
  async findPeer(peerId) {
    if (this.peers.has(peerId)) {
      return { local: true, socket: this.peers.get(peerId).socket };
    }
    
    // Simulate DHT lookup
    if (this.routingTable.has(peerId)) {
      return { local: false, route: this.routingTable.get(peerId) };
    }

    return null;
  }

  /**
   * Simulates a Gossip protocol to spread information to other nodes.
   */
  gossip(message) {
    // In a clustered environment, this would broadcast to other server nodes.
    // For this implementation, we just log the event as if it were emitted.
    this.logger.debug({ gossip: message }, 'Gossiping network state change');
    // this.emit('gossip', message);
  }

  /**
   * Maintenance loop to clean up stale peers (Ping/Pong logic usually handles connection,
   * but this cleans up the DHT/Routing table).
   */
  startMaintenance(intervalMs = 30000) {
    setInterval(() => {
      this.logger.debug('Running discovery maintenance...');
      // Implementation of bucket refreshing or pinging would go here.
    }, intervalMs);
  }
}

module.exports = DiscoveryService;
