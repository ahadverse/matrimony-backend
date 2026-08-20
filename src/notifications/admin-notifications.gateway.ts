import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { UserRole } from '../users/entities/user.entity';

interface AdminAuthedSocket extends Socket {
  data: { userId: string; role: UserRole };
}

export interface ManualTopupSubmittedPayload {
  id: string;
  amount: number;
  trxId: string | null;
  payerAccountNumber: string | null;
  submittedAt: Date;
  user: { id: string; phone: string; name: string | null };
}

export interface SupportMessageNotifyPayload {
  id: string;
  userId: string;
  senderRole: 'user' | 'admin';
  body: string;
  createdAt: Date;
  user: { id: string; phone: string; name: string | null };
}

// CORS is evaluated at class-definition time (can't inject ConfigService here), so it
// reads process.env directly — same reasoning as ChatGateway.
@WebSocketGateway({
  namespace: '/admin-notifications',
  cors: {
    origin: process.env.ADMIN_URL ?? 'http://localhost:5173',
    credentials: true,
  },
})
export class AdminNotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(socket: AdminAuthedSocket) {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      socket.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; role: UserRole }>(
        token,
      );
      if (payload.role !== UserRole.ADMIN) {
        socket.disconnect(true);
        return;
      }
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
    } catch {
      socket.disconnect(true);
      return;
    }

    void socket.join('admins');
  }

  notifyManualTopupSubmitted(payload: ManualTopupSubmittedPayload) {
    this.server.to('admins').emit('topup:manual-submitted', payload);
  }

  notifySupportMessage(payload: SupportMessageNotifyPayload) {
    this.server.to('admins').emit('support:message-new', payload);
  }
}
