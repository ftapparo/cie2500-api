import 'dotenv/config';

export const CONFIG = {
  wsUrl: process.env.WS_URL ?? 'ws://127.0.0.1:12348',
  wsSubproto: process.env.WS_SUBPROTO ?? 'base46',
  ip: process.env.CIE_IP ?? '192.168.0.4',
  endereco: Number(process.env.CIE_ENDERECO ?? 0),
  password: process.env.CIE_PASSWORD ?? '444444',
  timeoutMs: Number(process.env.CIE_REQUEST_TIMEOUT ?? 3000),
};

/** formato do frame do WebSocket.
 *  Pelo console do app costuma ser JSON {event, data}, mas deixamos configurável.
 */
export type WsFrameFormat = 'object' | 'array' | 'pipe';
export const WS_FORMAT: WsFrameFormat = 'object'; // mude p/ 'array' ou 'pipe' se necessário
