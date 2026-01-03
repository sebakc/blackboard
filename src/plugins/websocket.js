const fp = require('fastify-plugin');
const DiscoveryService = require('../lib/discovery');
const ChannelManager = require('../lib/channel-manager');
const ProjectManager = require('../lib/project-manager');
const { messageSchema } = require('../lib/schema');

module.exports = fp(async (fastify, opts) => {
  const discovery = new DiscoveryService(fastify.log);
  const channels = new ChannelManager(fastify.log);
  const projects = new ProjectManager(fastify.log);
  
  discovery.startMaintenance();

  fastify.decorate('discovery', discovery);
  fastify.decorate('channels', channels);
  fastify.decorate('projects', projects);

  fastify.register(require('@fastify/websocket'));

  fastify.register(async function (fastify) {
    // Protect this route
    fastify.addHook('preValidation', fastify.authenticate);

    fastify.get('/ws', { websocket: true }, (connection, req) => {
      const socket = connection.socket || connection;
      const peerId = req.user.id;
      const peerName = req.user.name || peerId;

      fastify.log.info({ peerId, peerName }, 'WebSocket connection initiated');

      // Auto-register on connect
      discovery.register(peerId, socket, { ip: req.ip, name: peerName });

      // Track subscribed channels for this socket for cleanup
      const subscribedChannels = new Set();

      socket.on('message', async (message) => {
        try {
          const rawData = message.toString();
          let data;
          try {
            data = JSON.parse(rawData);
          } catch (e) {
            return sendError(socket, 'Invalid JSON');
          }

          if (!data.type) return sendError(socket, 'Missing message type');

          handleMessage(peerId, socket, data, subscribedChannels);

        } catch (err) {
          fastify.log.error(err, 'Message handling error');
        }
      });

      socket.on('close', () => {
        discovery.unregister(peerId);
        // Clean up channels
        for (const channelId of subscribedChannels) {
          channels.leave(channelId, peerId);
        }
        fastify.log.info({ peerId }, 'WebSocket disconnected');
      });

      socket.on('error', (err) => {
        fastify.log.error({ peerId, err }, 'WebSocket error');
        discovery.unregister(peerId);
        for (const channelId of subscribedChannels) {
          channels.leave(channelId, peerId);
        }
      });
    });
  });

  function sendError(socket, msg) {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify({ type: 'ERROR', payload: { message: msg } }));
    }
  }

  async function handleMessage(senderId, socket, data, subscribedChannels) {
    const { type, targetId, payload, id } = data;

    // Log event
    fastify.log.debug({ type, senderId, targetId }, 'Received message');

    switch (type) {
      case 'PING':
        socket.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        break;

      case 'MESSAGE':
        if (!targetId) return sendError(socket, 'Target ID required for MESSAGE');
        
        const target = await discovery.findPeer(targetId);
        if (target && target.local) {
          target.socket.send(JSON.stringify({
            type: 'MESSAGE',
            senderId,
            id,
            payload,
            timestamp: Date.now()
          }));
          // Ack to sender
          socket.send(JSON.stringify({ type: 'ACK', id }));
        } else if (target && !target.local) {
          fastify.log.info({ targetId, route: target.route }, 'Routing to remote peer (simulated)');
          socket.send(JSON.stringify({ type: 'ACK', id, status: 'FORWARDED' }));
        } else {
          sendError(socket, 'Target peer not found');
        }
        break;

      case 'DISCOVER':
        if (!targetId) return sendError(socket, 'Target ID required for DISCOVER');
        const found = await discovery.findPeer(targetId);
        socket.send(JSON.stringify({
          type: 'DISCOVERY_RESULT',
          targetId,
          found: !!found
        }));
        break;

      case 'JOIN_CHANNEL':
        if (!payload || !payload.channelId) return sendError(socket, 'channelId required');

        // Access Control for Project Channels
        // Removed per requirement: "the agents have access to all projects"
        // if (payload.channelId.startsWith('project-') && payload.channelId.endsWith('-blackboard')) { ... }

        channels.join(payload.channelId, senderId);
        subscribedChannels.add(payload.channelId);
        socket.send(JSON.stringify({ type: 'ACK', id, payload: { status: 'JOINED', channelId: payload.channelId } }));
        break;

      case 'LEAVE_CHANNEL':
        if (!payload || !payload.channelId) return sendError(socket, 'channelId required');
        channels.leave(payload.channelId, senderId);
        subscribedChannels.delete(payload.channelId);
        socket.send(JSON.stringify({ type: 'ACK', id, payload: { status: 'LEFT', channelId: payload.channelId } }));
        break;

      case 'CHANNEL_MESSAGE':
        if (!payload || !payload.channelId || !payload.content) return sendError(socket, 'channelId and content required');
        
        // 1. Publish and Persist
        const msg = await channels.publish(payload.channelId, senderId, payload.content);
        
        // 2. Broadcast to all subscribers
        const subscribers = channels.getSubscribers(payload.channelId);
        for (const subId of subscribers) {
          // Don't echo back to sender if we want that behavior (usually we do echo or client handles it)
          // Let's echo for simplicity or exclude sender? 
          // Chat apps usually echo via server confirmation or optimistic UI.
          // Let's send to ALL including sender to confirm receipt and ordering.
          const peer = await discovery.findPeer(subId);
          if (peer && peer.local && peer.socket.readyState === peer.socket.OPEN) {
             peer.socket.send(JSON.stringify({
               type: 'CHANNEL_MESSAGE',
               ...msg
             }));
          }
        }
        
        // Ack to sender that we processed it
        socket.send(JSON.stringify({ type: 'ACK', id }));
        break;

      default:
        // Handle other types or ignore
        break;
    }
  }
});
