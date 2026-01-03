const Fastify = require('fastify');
const path = require('path');
const pino = require('pino');
const VersionedStore = require('./lib/versioned-store');

// Create Fastify instance with Pino logger
const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

// Register Plugins
fastify.register(require('./plugins/auth'), { jwtSecret: process.env.JWT_SECRET || 'dev-secret' });
fastify.register(require('./plugins/websocket'));

const projectDataStore = new VersionedStore(path.join(__dirname, '../data/project-data'));

// Simple Health Check
fastify.get('/', async (request, reply) => {
  return { status: 'ok', server: 'Blackboard P2P Server' };
});

// List all agents
fastify.get('/agents', async (request, reply) => {
  return fastify.discovery.getAllAgents();
});

// Get Channel History
fastify.get('/channels/:channelId/history', async (req, reply) => {
  const { channelId } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit) : 50;
  return fastify.channels.getHistory(channelId, limit);
});

// Project Data - Get
fastify.get('/project-data/:id', async (req, reply) => {
  const data = await projectDataStore.get(req.params.id);
  if (!data) return { id: req.params.id, version: 0, data: {} };
  return data;
});

// Project Data - Update (Optimistic Locking)
fastify.put('/project-data/:id', async (req, reply) => {
  const { version, data } = req.body;
  if (version === undefined || !data) {
    return reply.code(400).send({ error: 'version and data are required' });
  }

  try {
    const updated = await projectDataStore.update(req.params.id, version, data);
    return updated;
  } catch (err) {
    if (err.code === 'CONFLICT') {
      return reply.code(409).send({ 
        error: 'Conflict detected', 
        message: err.message, 
        currentVersion: err.currentVersion 
      });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

// Create a new Project
fastify.post('/projects', async (req, reply) => {
  const { projectName } = req.body;
  if (!projectName) return reply.code(400).send({ error: 'projectName is required' });
  
  if (!fastify.projects) {
    return reply.code(503).send({ error: 'Project service not ready' });
  }

  try {
    const project = fastify.projects.createProject(projectName);
    
    // Initialize the blackboard store for this project
    await projectDataStore.update(project.id, 0, { 
      initialized: true, 
      projectName: project.name, 
      channelId: project.channelId 
    });

    return {
      projectId: project.id,
      channelId: project.channelId,
      channelEndpoint: `ws://${req.hostname}:3000/ws`
    };
  } catch (err) {
    if (err.message === 'Project name already exists') {
      return reply.code(409).send({ error: err.message });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

// Login route to get a token (for testing purposes)
fastify.post('/login', async (req, reply) => {
  // In a real app, validate credentials here
  const { username, name } = req.body || { username: 'anon' };
  const token = fastify.jwt.sign({ id: username, name: name || username });
  return { token };
});

// Register a new agent (similar to login for now, but semantically distinct)
fastify.post('/register', async (req, reply) => {
  const { id, name, metadata } = req.body;
  if (!id || !name) {
    return reply.code(400).send({ error: 'id and name are required' });
  }

  // Generate a token for the new agent
  const token = fastify.jwt.sign({ id, name, metadata });
  
  return { message: 'Agent registered successfully', token, agent: { id, name, metadata } };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();