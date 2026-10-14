import { io } from 'socket.io-client';

const SOCKET_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : `http://${window.location.hostname}:3000`;

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
});
