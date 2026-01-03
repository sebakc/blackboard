const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const crypto = require('crypto');

class ChannelManager extends EventEmitter {
  constructor(logger, dataDir = './data') {
    super();
    this.logger = logger;
    this.channels = new Map(); // channelId -> Set(peerId)
    this.persistencePath = path.join(dataDir, 'channel-messages.jsonl');
  }

  join(channelId, peerId) {
    if (!this.channels.has(channelId)) {
      this.channels.set(channelId, new Set());
    }
    this.channels.get(channelId).add(peerId);
    this.logger.info({ peerId, channelId }, 'Peer joined channel');
  }

  leave(channelId, peerId) {
    if (this.channels.has(channelId)) {
      const subscribers = this.channels.get(channelId);
      subscribers.delete(peerId);
      if (subscribers.size === 0) {
        this.channels.delete(channelId);
      }
      this.logger.info({ peerId, channelId }, 'Peer left channel');
    }
  }

  getSubscribers(channelId) {
    if (!this.channels.has(channelId)) return [];
    return Array.from(this.channels.get(channelId));
  }

  async publish(channelId, senderId, payload) {
    const message = {
      id: crypto.randomUUID(),
      channelId,
      senderId,
      payload,
      timestamp: Date.now()
    };

    // 1. Persist (Async)
    this.persistMessage(message);

    // 2. Return for broadcasting
    return message;
  }

  persistMessage(message) {
    const line = JSON.stringify(message) + '\n';
    fs.appendFile(this.persistencePath, line, (err) => {
      if (err) {
        this.logger.error({ err }, 'Failed to persist channel message');
      }
    });
  }

  async getHistory(channelId, limit = 50) {
    // Naive implementation: Read whole file and filter. 
    // In production, use a DB or structured log files per channel.
    if (!fs.existsSync(this.persistencePath)) return [];

    const content = await fs.promises.readFile(this.persistencePath, 'utf8');
    const lines = content.trim().split('\n');
    const history = [];
    
    // Read from end
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        if (!lines[i]) continue;
        const msg = JSON.parse(lines[i]);
        if (msg.channelId === channelId) {
          history.unshift(msg);
          if (history.length >= limit) break;
        }
      } catch (e) {
        // ignore malformed lines
      }
    }
    return history;
  }
}

module.exports = ChannelManager;
