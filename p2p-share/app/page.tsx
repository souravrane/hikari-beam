"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateRoomId, isValidRoomId } from "@/signaling";
import {
  getStoredHostRoom,
  clearStoredHostRoom,
  isStoredHostForRoom,
} from "@/p2p-manager-fixed";

export default function HomePage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [storedHostRoom, setStoredHostRoom] = useState<string | null>(null);

  // Check for stored host room on component mount
  useEffect(() => {
    const hostRoom = getStoredHostRoom();
    if (hostRoom && isStoredHostForRoom(hostRoom)) {
      setStoredHostRoom(hostRoom);
    }
  }, []);

  const handleCreateRoom = () => {
    const newRoomId = generateRoomId();
    router.push(`/r/${newRoomId}`);
  };

  const handleJoinRoom = () => {
    if (!roomId.trim()) {
      setError("Please enter a room ID");
      return;
    }

    if (!isValidRoomId(roomId)) {
      setError("Invalid room ID format");
      return;
    }

    router.push(`/r/${roomId}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8);
    setRoomId(value);
    if (error) setError("");
  };

  const handleReturnToHostRoom = () => {
    if (storedHostRoom) {
      router.push(`/r/${storedHostRoom}`);
    }
  };

  const handleCreateNewRoom = () => {
    // Clear the stored host room when creating a new one
    clearStoredHostRoom();
    setStoredHostRoom(null);
    const newRoomId = generateRoomId();
    router.push(`/r/${newRoomId}`);
  };

  const handleDismissHostRoom = () => {
    clearStoredHostRoom();
    setStoredHostRoom(null);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Host Room Restoration Banner */}
      {storedHostRoom && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">
                  Welcome back, Host!
                </h3>
                <p className="text-sm text-blue-700">
                  You have an active room:{" "}
                  <span className="font-mono font-bold text-gray-900">
                    {storedHostRoom}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleReturnToHostRoom}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Return to Room
              </button>
              <button
                onClick={handleDismissHostRoom}
                className="p-2 text-blue-500 hover:text-blue-700 transition-colors"
                title="Dismiss"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Share Files Directly
        </h1>
        <p className="text-xl text-gray-600 mb-2">
          Peer-to-peer file sharing with WebRTC
        </p>
        <p className="text-sm text-gray-500">
          No servers, no storage, no tracking. Just direct browser-to-browser
          transfers.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
              Get Started
            </h2>

            <div className="space-y-4">
              <button
                onClick={handleCreateNewRoom}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                <span>Create New Room</span>
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    Or join an existing room
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="roomId"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Room ID
                  </label>
                  <input
                    type="text"
                    id="roomId"
                    value={roomId}
                    onChange={handleInputChange}
                    placeholder="Enter 8-character room ID"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono tracking-wider text-gray-900"
                    maxLength={8}
                  />
                  {error && (
                    <p className="mt-1 text-sm text-red-600">{error}</p>
                  )}
                </div>

                <button
                  onClick={handleJoinRoom}
                  disabled={!roomId.trim()}
                  className="w-full bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Join Room
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Secure Transfer</h3>
          <p className="text-sm text-gray-600">
            Files are transferred directly between browsers using encrypted
            WebRTC connections.
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Fast & Direct</h3>
          <p className="text-sm text-gray-600">
            No upload to servers. Files stream directly from sender to receiver
            at full speed.
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Privacy First</h3>
          <p className="text-sm text-gray-600">
            No file storage, no tracking, no accounts. Your data stays between
            you and your peers.
          </p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          <strong>How it works:</strong> Create or join a room, share files
          directly with peers. Files are chunked and streamed in real-time with
          pause/resume support.
        </p>
      </div>
    </div>
  );
}
