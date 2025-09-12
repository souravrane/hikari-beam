"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { isValidRoomId } from "@/signaling";
import { useP2PManager, clearStoredHostRoom } from "@/p2p-manager-fixed";
import FileSelector from "@/components/FileSelector";
import PeerList from "@/components/PeerList";
import MetadataDialog from "@/components/MetadataDialog";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const p2p = useP2PManager(roomId);

  // Validate room ID
  useEffect(() => {
    if (!isValidRoomId(roomId)) {
      router.push("/");
      return;
    }
  }, [roomId, router]);

  const copyRoomLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    // You could add a toast notification here
  };

  const handleLeaveRoom = () => {
    // Clear stored host room if leaving
    if (p2p.isHost) {
      clearStoredHostRoom();
    }
    router.push("/");
  };

  if (!isValidRoomId(roomId)) {
    return null; // Will redirect in useEffect
  }

  // Create peer data with connection status for PeerList component
  const peerData = p2p.peers.map((peerId) => ({
    id: peerId,
    isHost: false,
    joinedAt: Date.now(),
  }));

  // Convert P2PConnection map to PeerConnection map for PeerList component
  const peerConnections = new Map();
  p2p.connections.forEach((conn, peerId) => {
    const rtcState = conn.connection.connectionState;
    const dataChannelState = conn.dataChannel?.readyState;

    let state: "connecting" | "connected" | "disconnected" | "failed";
    if (rtcState === "connected" && dataChannelState === "open") {
      state = "connected";
    } else if (rtcState === "connecting" || rtcState === "new") {
      state = "connecting";
    } else if (rtcState === "failed" || rtcState === "closed") {
      state = "failed";
    } else {
      state = "connecting";
    }

    peerConnections.set(peerId, {
      id: peerId,
      connection: conn.connection,
      dataChannel: conn.dataChannel,
      state,
    });
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Room Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Room: {roomId}</h1>
            <p className="text-gray-600">
              {p2p.isHost ? "You are the host" : "Connected as peer"}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={copyRoomLink}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 flex items-center space-x-2"
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copy Link</span>
            </button>
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center space-x-2"
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span>Leave</span>
            </button>
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                p2p.isConnected
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {p2p.isConnected ? "Connected" : "Disconnected"}
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <span className="font-medium">{p2p.peers.length}</span> peer(s) in
              room
            </div>
            {p2p.error && (
              <div className="text-red-600">Error: {p2p.error}</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {p2p.isHost ? (
            <FileSelector roomId={roomId} onFileSelected={p2p.shareFile} />
          ) : (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Waiting for Host
              </h2>
              <p className="text-gray-600">
                The host will select a file to share with everyone in this room.
              </p>

              {/* Show transfer progress if receiving */}
              {p2p.fileMetadata && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900">
                    Downloading: {p2p.fileMetadata.name}
                  </h4>
                  {p2p.transferProgress.has("download") && (
                    <div className="mt-2">
                      <div className="flex justify-between text-sm text-blue-700">
                        <span>Progress</span>
                        <span>
                          {p2p.transferProgress
                            .get("download")
                            .percentage.toFixed(1)}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2 mt-1">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${
                              p2p.transferProgress.get("download").percentage
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Transfer Controls for Host */}
          {p2p.isHost && p2p.fileMetadata && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Transfer Status
              </h3>
              <div className="space-y-4">
                <div>
                  <span className="font-medium text-gray-700">File:</span>{" "}
                  <span className="text-gray-900">{p2p.fileMetadata.name}</span>
                </div>
                {p2p.transferProgress.size > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">
                      Peer Progress:
                    </h4>
                    {Array.from(p2p.transferProgress.entries()).map(
                      ([peerId, progress]) => (
                        <div key={peerId} className="mb-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-900">
                              Peer {peerId.slice(0, 8)}
                            </span>
                            <span className="text-gray-900">
                              {progress.percentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress.percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <PeerList
            peers={peerData}
            isHost={p2p.isHost}
            connections={peerConnections}
            transferProgress={p2p.isHost ? p2p.transferProgress : new Map()}
          />

          {/* Instructions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-3">How it works</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start space-x-2">
                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-blue-600">1</span>
                </div>
                <p>Host selects a file to share</p>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-blue-600">2</span>
                </div>
                <p>Peers see file info and can accept</p>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-blue-600">3</span>
                </div>
                <p>Direct transfer begins automatically</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metadata Dialog */}
      {p2p.pendingMetadata && (
        <MetadataDialog
          metadata={p2p.pendingMetadata}
          onAccept={() => p2p.acceptFile(p2p.pendingMetadata!)}
          onReject={p2p.rejectFile}
        />
      )}
    </div>
  );
}
