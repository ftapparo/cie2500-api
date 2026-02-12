import http from 'http';
import { WebSocketServer } from 'ws';

type WsEnvelope = {
  event: string;
  timestamp: string;
  data: unknown;
};

export class CieWsBroker {
  private readonly path: string;
  private readonly wss: WebSocketServer;

  constructor(server: http.Server, path = '/v1/ws') {
    this.path = path;
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      const url = request.url || '';
      if (!url.startsWith(this.path)) {
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request);
      });
    });

    this.wss.on('connection', (ws) => {
      const payload: WsEnvelope = {
        event: 'connection.established',
        timestamp: new Date().toISOString(),
        data: { ok: true },
      };
      ws.send(JSON.stringify(payload));
    });
  }

  publish(event: string, data: unknown) {
    const payload: WsEnvelope = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const text = JSON.stringify(payload);
    this.wss.clients.forEach((client: any) => {
      if (client.readyState === 1) client.send(text);
    });
  }

  close() {
    this.wss.close();
  }
}
