import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { fetchRooms } from '../lib/api';
import { RoomSummary } from '@codecollab/shared';
import { DoorOpen, Search, User, Lock, Globe, ArrowRight } from 'lucide-react';

export const RoomsPage: React.FC = () => {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRooms = async () => {
      try {
        const data = await fetchRooms();
        setRooms(data);
      } catch (err) {
        console.error('Failed to load rooms:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadRooms();
  }, []);

  const filteredRooms = rooms.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 flex-1 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <DoorOpen className="w-8 h-8 text-indigo-600" />
              Coding Rooms
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Join active public rooms or private team workspaces to practice together.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
            />
          </div>
        </div>

        {/* Room Cards Grid */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">
            Loading rooms library...
          </div>
        ) : rooms.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2 shadow-sm">
            <DoorOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base text-slate-800 font-semibold">No coding rooms yet</h3>
            <p className="text-xs text-slate-500">Create or join a room to start collaborating.</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2 shadow-sm">
            <p className="text-base text-slate-800 font-semibold">No coding rooms match your search.</p>
            <p className="text-xs text-slate-500">Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room) => (
              <div
                key={room.id}
                className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 space-y-5 flex flex-col justify-between transition-all shadow-sm hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg text-slate-900 leading-snug">{room.name}</h3>
                    {room.isPrivate ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg flex-shrink-0">
                        <Lock className="w-3 h-3" /> Private
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex-shrink-0">
                        <Globe className="w-3 h-3" /> Public
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" /> Owner: <strong className="text-slate-800">{room.ownerUsername}</strong>
                    </span>
                    <span className="flex items-center gap-1 text-slate-700 font-medium">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> {room.memberCount} Member{room.memberCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="pt-1">
                    <span className="px-2.5 py-1 text-xs font-mono bg-slate-100 border border-slate-200 rounded-md text-indigo-700 font-semibold">
                      Language: {room.language}
                    </span>
                  </div>
                </div>

                <Link
                  to={`/rooms/${room.id}`}
                  className="w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                >
                  Join Room <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};
