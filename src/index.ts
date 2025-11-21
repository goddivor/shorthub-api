import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';

import { env } from './config/env';
import { connectDatabase } from './config/database';
import { resolvers } from './graphql/resolvers';
import { getUser } from './middlewares/auth';
import { createDataLoaders } from './dataloaders';
import { pubsub, GraphQLContext } from './context';
import { logger } from './utils/logger';
import { AuthService } from './services/auth.service';
import { startAllJobs } from './jobs';
import googleDriveRoutes from './routes/googleDrive.routes';

async function startServer() {
  // Connect to MongoDB
  await connectDatabase();

  // Create default admin user
  await AuthService.createDefaultAdmin();

  // Start cron jobs
  startAllJobs();

  // Create Express app
  const app = express();
  const httpServer = http.createServer(app);

  // Read GraphQL schema
  const typeDefs = fs.readFileSync(
    path.join(__dirname, 'graphql/schema.graphql'),
    'utf-8'
  );

  // Create executable schema
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        const token = ctx.connectionParams?.authorization as string;
        const user = await getUser(token);

        return {
          user,
          dataloaders: createDataLoaders(),
          pubsub,
        };
      },
    },
    wsServer
  );

  // Apollo Server
  const server = new ApolloServer<GraphQLContext>({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  // CORS for all routes
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  // Google Drive API routes
  app.use('/api/drive', googleDriveRoutes);

  // Alias route for Google OAuth callback (for backward compatibility)
  app.use('/api/auth/google', googleDriveRoutes);

  // GraphQL Middleware
  app.use(
    '/graphql',
    bodyParser.json({ limit: '50mb' }),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const token = req.headers.authorization;
        const user = await getUser(token);

        return {
          user,
          dataloaders: createDataLoaders(),
          pubsub,
        } as GraphQLContext;
      },
    })
  );

  // Health check endpoint
  app.get('/health', (_, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // Start server
  await new Promise<void>((resolve) =>
    httpServer.listen({ port: env.PORT }, resolve)
  );

  logger.info(`🚀 Server ready at http://localhost:${env.PORT}/graphql`);
  logger.info(`🔔 Subscriptions ready at ws://localhost:${env.PORT}/graphql`);
  logger.info(`📊 GraphQL Playground: http://localhost:${env.PORT}/graphql`);
}

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
