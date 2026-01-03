// Message Schemas

const messageSchema = {
  type: 'object',
  required: ['type', 'payload'],
  properties: {
    id: { type: 'string' },
    type: { 
      type: 'string', 
      enum: ['REGISTER', 'MESSAGE', 'DISCOVER', 'ACK', 'ERROR', 'PING', 'PONG', 'JOIN_CHANNEL', 'LEAVE_CHANNEL', 'CHANNEL_MESSAGE'] 
    },
    targetId: { type: 'string' }, // For routing
    payload: { type: 'object', additionalProperties: true },
    timestamp: { type: 'integer' }
  }
};

const registerPayloadSchema = {
  type: 'object',
  required: ['peerId'],
  properties: {
    peerId: { type: 'string' },
    publicKey: { type: 'string' },
    metadata: { type: 'object' }
  }
};

const messagePayloadSchema = {
  type: 'object',
  required: ['content'],
  properties: {
    content: { type: 'string' },
    encrypted: { type: 'boolean' }
  }
};

module.exports = {
  messageSchema,
  registerPayloadSchema,
  messagePayloadSchema
};
