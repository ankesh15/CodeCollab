import { io, Socket } from 'socket.io-client';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.['VITE_API_BASE_URL']) ||
  'http://localhost:5000/api';
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');

let socketInstance: Socket | null = null;

export function getSocket(token?: string): Socket {
  if (socketInstance) {
    if (token && socketInstance.auth && typeof socketInstance.auth === 'object') {
      (socketInstance.auth as Record<string, string>)['token'] = token;
    }
    return socketInstance;
  }

  socketInstance = io(SOCKET_URL, {
    auth: {
      token: token || '',
    },
    autoConnect: false,
    transports: ['websocket', 'polling'],
  });

  return socketInstance;
}

export function connectSocket(token: string): Socket {
  const socket = getSocket(token);
  if (!socket.connected) {
    socket.auth = { token };
    socket.connect();
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
