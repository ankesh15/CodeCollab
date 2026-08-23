import React, { useState, useEffect } from 'react';
import {
  SOCKET_EVENTS,
  SafeUser,
  RoomUser,
  RoomStatePayload,
  RoomUserJoinedPayload,
  RoomUserLeftPayload,
  SocketErrorPayload,
} from '@codecollab/shared';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { API_BASE_URL } from '../lib/api';

const SEEDED_USERS = [
  { name: 'Alex Dev (Owner)', email: 'alex.rivers@example.com', pass: 'DevPassword123!' },
  { name: 'Sarah Chen (Admin)', email: 'sarah.chen@example.com', pass: 'DevPassword123!' },
  { name: 'Michael Vance (Member)', email: 'michael.vance@example.com', pass: 'DevPassword123!' },
];

const SAMPLE_ROOMS = [
  { name: 'Algo-Masterclass (Public)', id: '22222222-2222-2222-2222-222222222222' },
  { name: 'WebDev-Pairing (Private - Alex & Sarah only)', id: '33333333-3333-3333-3333-333333333333' },
];

export const RoomPresenceTest: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState(SEEDED_USERS[0]);
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [selectedRoom, setSelectedRoom] = useState(SAMPLE_ROOMS[0]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<RoomUser[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const handleLogin = async () => {
    try {
      setErrorMsg(null);
      addLog(`Logging in as ${selectedUser?.name}...`);
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: selectedUser?.email, password: selectedUser?.pass }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Login failed');
      }

      setToken(data.data.token);
      setCurrentUser(data.data.user);
      addLog(`Logged in successfully! User ID: ${data.data.user.id}`);

      // Connect Socket
      const socket = connectSocket(data.data.token);

      socket.off('connect');
      socket.off('disconnect');
      socket.off(SOCKET_EVENTS.ROOM_STATE);
      socket.off(SOCKET_EVENTS.ROOM_USER_JOINED);
      socket.off(SOCKET_EVENTS.ROOM_USER_LEFT);
      socket.off(SOCKET_EVENTS.ERROR);

      socket.on('connect', () => {
        setIsConnected(true);
        addLog(`Socket connected! Socket ID: ${socket.id}`);
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
        setActiveRoomId(null);
        setOnlineUsers([]);
        addLog('Socket disconnected.');
      });

      socket.on(SOCKET_EVENTS.ROOM_STATE, (payload: RoomStatePayload) => {
        setActiveRoomId(payload.roomId);
        setOnlineUsers(payload.users);
        addLog(`Received room state for ${payload.roomId}: ${payload.users.length} user(s) online.`);
      });

      socket.on(SOCKET_EVENTS.ROOM_USER_JOINED, (payload: RoomUserJoinedPayload) => {
        setOnlineUsers((prev) => {
          if (prev.some((u) => u.userId === payload.user.userId)) return prev;
          return [...prev, payload.user];
        });
        addLog(`🟢 User joined: ${payload.user.username}`);
      });

      socket.on(SOCKET_EVENTS.ROOM_USER_LEFT, (payload: RoomUserLeftPayload) => {
        setOnlineUsers((prev) => prev.filter((u) => u.userId !== payload.user.userId));
        addLog(`🔴 User left: ${payload.user.username}`);
      });

      socket.on(SOCKET_EVENTS.ERROR, (payload: SocketErrorPayload) => {
        setErrorMsg(`[${payload.code}] ${payload.message}`);
        addLog(`⚠️ Realtime Error: [${payload.code}] ${payload.message}`);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      addLog(`❌ Error: ${msg}`);
    }
  };

  const handleDisconnect = () => {
    disconnectSocket();
    setToken(null);
    setCurrentUser(null);
    setIsConnected(false);
    setActiveRoomId(null);
    setOnlineUsers([]);
    addLog('Logged out and disconnected socket.');
  };

  const handleJoinRoom = () => {
    if (!token || !selectedRoom) return;
    setErrorMsg(null);
    const socket = connectSocket(token);
    addLog(`Emitting room:join for ${selectedRoom.name}...`);
    socket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: selectedRoom.id });
  };

  const handleLeaveRoom = () => {
    if (!token || !activeRoomId) return;
    const socket = connectSocket(token);
    addLog(`Emitting room:leave for ${activeRoomId}...`);
    socket.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId: activeRoomId });
    setActiveRoomId(null);
    setOnlineUsers([]);
  };

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-slate-900">
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-indigo-600">⚡ Real-Time Socket.IO Room Presence Test</h2>
          <p className="text-sm text-slate-500">Test live room presence & authorization across sessions</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-3 w-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}
          />
          <span className="text-sm font-semibold text-slate-700">
            {isConnected ? 'Socket Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Auth Controls */}
      {!token ? (
        <div className="flex flex-wrap items-center gap-4 mb-6 bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <label className="text-sm text-slate-700 font-semibold">Select User:</label>
          <select
            value={selectedUser?.email}
            onChange={(e) => setSelectedUser(SEEDED_USERS.find((u) => u.email === e.target.value)!)}
            className="bg-white border border-slate-300 text-sm rounded-xl p-2 focus:ring-1 focus:ring-indigo-600 text-slate-900 font-medium"
          >
            {SEEDED_USERS.map((u) => (
              <option key={u.email} value={u.email}>
                {u.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleLogin}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-sm"
          >
            Authenticate & Connect Socket
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <div className="text-sm">
            <span className="text-slate-500">Authenticated as: </span>
            <span className="font-bold text-indigo-600">{currentUser?.username}</span>{' '}
            <span className="text-slate-400">({currentUser?.email})</span>
          </div>
          <button
            onClick={handleDisconnect}
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-sm"
          >
            Disconnect / Logout
          </button>
        </div>
      )}

      {/* Room Joining & Presence Panel */}
      {token && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-md font-semibold text-slate-800 mb-3">Room Selection</h3>
            <div className="space-y-3">
              <select
                value={selectedRoom?.id || ''}
                onChange={(e) => setSelectedRoom(SAMPLE_ROOMS.find((r) => r.id === e.target.value) || SAMPLE_ROOMS[0])}
                className="w-full bg-white border border-slate-300 text-sm rounded-xl p-2.5 text-slate-900 font-medium"
              >
                {SAMPLE_ROOMS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              <div className="flex gap-3">
                <button
                  onClick={handleJoinRoom}
                  disabled={activeRoomId === selectedRoom?.id}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-sm transition-all shadow-sm"
                >
                  Join Selected Room
                </button>
                {activeRoomId && (
                  <button
                    onClick={handleLeaveRoom}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-sm"
                  >
                    Leave Room
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-md font-semibold text-slate-800 mb-3">
              Online Users ({onlineUsers.length})
            </h3>
            {activeRoomId ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {onlineUsers.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No users in room</p>
                ) : (
                  onlineUsers.map((user) => (
                    <div
                      key={user.userId}
                      className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-xs shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-slate-800">{user.username}</span>
                      </div>
                      <span className="text-slate-500 font-mono">{user.userId.substring(0, 8)}...</span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Join a room to see online members</p>
            )}
          </div>
        </div>
      )}

      {/* Realtime Event Audit Log */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Realtime Event Stream
        </h3>
        <div className="bg-slate-900 font-mono text-xs p-3 rounded-xl h-36 overflow-y-auto border border-slate-800 space-y-1 text-slate-200">
          {logs.length === 0 ? (
            <p className="text-slate-500 italic">Event stream waiting for connection...</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="leading-tight">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
