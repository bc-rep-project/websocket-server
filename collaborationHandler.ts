import { WebSocket } from 'ws';
import { prisma } from '@/lib/prisma';
import { sendEmail, emailTemplates } from '@/lib/emailService';

interface CollaborationMessage {
  type: 'presence' | 'permission_change' | 'access_request';
  documentId: string;
  data: any;
}

interface Client {
  ws: WebSocket;
  userId: string;
  documentId: string;
}

class CollaborationHandler {
  private clients: Map<WebSocket, Client> = new Map();
  private documentClients: Map<string, Set<WebSocket>> = new Map();
  private heartbeats: Map<WebSocket, boolean> = new Map();

  constructor() {
    // Clean up inactive clients periodically
    setInterval(() => this.cleanupInactiveClients(), 30000);
  }

  public handleConnection(ws: WebSocket, userId: string, documentId: string) {
    // Store client information
    this.clients.set(ws, { ws, userId, documentId });

    // Add to document-specific clients
    if (!this.documentClients.has(documentId)) {
      this.documentClients.set(documentId, new Set());
    }
    this.documentClients.get(documentId)?.add(ws);

    // Set up heartbeat
    this.heartbeats.set(ws, true);
    ws.on('pong', () => {
      this.heartbeats.set(ws, true);
    });

    // Handle messages
    ws.on('message', async (message: string) => {
      try {
        const parsedMessage: CollaborationMessage = JSON.parse(message);
        await this.handleMessage(ws, parsedMessage);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    // Broadcast user presence
    this.broadcastToDocument(documentId, {
      type: 'presence',
      documentId,
      data: {
        userId,
        action: 'join',
      },
    });
  }

  private async handleMessage(ws: WebSocket, message: CollaborationMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case 'presence':
        // Handle presence updates
        this.broadcastToDocument(message.documentId, message, ws);
        break;

      case 'permission_change':
        // Validate permission change
        const canChangePermissions = await this.validatePermission(
          client.userId,
          message.documentId,
          'admin'
        );
        if (!canChangePermissions) return;

        // Update permissions in database
        await this.updatePermissions(message.data);

        // Broadcast permission change
        this.broadcastToDocument(message.documentId, message);
        break;

      case 'access_request':
        // Handle access request
        await this.handleAccessRequest(client, message.data);
        break;
    }
  }

  private handleDisconnection(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client) return;

    // Remove from document clients
    this.documentClients.get(client.documentId)?.delete(ws);
    if (this.documentClients.get(client.documentId)?.size === 0) {
      this.documentClients.delete(client.documentId);
    }

    // Remove client
    this.clients.delete(ws);
    this.heartbeats.delete(ws);

    // Broadcast departure
    this.broadcastToDocument(client.documentId, {
      type: 'presence',
      documentId: client.documentId,
      data: {
        userId: client.userId,
        action: 'leave',
      },
    });
  }

  private cleanupInactiveClients() {
    for (const [ws] of this.clients) {
      if (!this.heartbeats.get(ws)) {
        ws.terminate();
        continue;
      }

      this.heartbeats.set(ws, false);
      ws.ping();
    }
  }

  private broadcastToDocument(
    documentId: string,
    message: CollaborationMessage,
    exclude?: WebSocket
  ) {
    const clients = this.documentClients.get(documentId);
    if (!clients) return;

    const messageStr = JSON.stringify(message);
    for (const client of clients) {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }
  }

  private async validatePermission(
    userId: string,
    documentId: string,
    requiredRole: string
  ) {
    const collaborator = await prisma.documentCollaborator.findFirst({
      where: {
        userId,
        documentId,
        role: requiredRole,
      },
    });

    return !!collaborator;
  }

  private async updatePermissions(data: {
    userId: string;
    documentId: string;
    role: string;
  }) {
    await prisma.documentCollaborator.update({
      where: {
        documentId_userId: {
          documentId: data.documentId,
          userId: data.userId,
        },
      },
      data: {
        role: data.role,
      },
    });

    // Log the permission change
    await prisma.accessLog.create({
      data: {
        documentId: data.documentId,
        action: 'modified',
        performedBy: data.userId,
        details: `Changed role to ${data.role}`,
      },
    });
  }

  private async handleAccessRequest(
    client: Client,
    data: { documentId: string; requestedRole: string }
  ) {
    try {
      // Get document details
      const document = await prisma.document.findUnique({
        where: { id: data.documentId },
        select: { title: true },
      });

      if (!document) {
        console.error('Document not found:', data.documentId);
        return;
      }

      // Get requester details
      const requester = await prisma.user.findUnique({
        where: { id: client.userId },
        select: { name: true, email: true },
      });

      if (!requester) {
        console.error('Requester not found:', client.userId);
        return;
      }

      // Find document admins
      const admins = await prisma.documentCollaborator.findMany({
        where: {
          documentId: data.documentId,
          role: 'admin',
        },
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      });

      // Send email notifications to admins
      for (const admin of admins) {
        const { subject, text, html } = emailTemplates.accessRequest(
          admin.user.email,
          requester.name || requester.email,
          document.title,
          data.requestedRole
        );

        await sendEmail({
          to: admin.user.email,
          subject,
          text,
          html,
        });
      }

      // Log the access request
      await prisma.accessLog.create({
        data: {
          documentId: data.documentId,
          action: 'requested',
          performedBy: client.userId,
          details: `Requested ${data.requestedRole} access`,
        },
      });
    } catch (error) {
      console.error('Error handling access request:', error);
    }
  }
}

export const collaborationHandler = new CollaborationHandler(); 