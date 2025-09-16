"use client";

import { PeerInfo, PeerConnection } from "@/types";
import { formatBytes, formatSpeed } from "@/chunking";

interface PeerListProps {
  peers: PeerInfo[];
  isHost: boolean;
  connections: Map<string, PeerConnection>;
  transferProgress?: Map<string, any>;
  socket?: any;
  hostEta?: any; // host-side ETA predictor
}

export default function PeerList({
  peers,
  isHost,
  connections,
  transferProgress = new Map(),
  socket,
  hostEta,
}: PeerListProps) {
  const getConnectionState = (peerId: string) => {
    const connection = connections.get(peerId);
    return connection?.state || "disconnected";
  };

  const getPeerProgress = (peerId: string) => {
    return transferProgress.get(peerId);
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case "connected":
        return "bg-green-100 text-green-800 border-green-200";
      case "connecting":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "disconnected":
      case "failed":
      default:
        return "bg-red-100 text-red-800 border-red-200";
    }
  };

  const getStatusText = (state: string) => {
    switch (state) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting";
      case "disconnected":
        return "Disconnected";
      case "failed":
        return "Failed";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
          Peers ({peers.length})
        </h3>
        {isHost && (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
            HOST
          </span>
        )}
      </div>

      {peers.length === 0 ? (
        <div className="text-center py-6 sm:py-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <p className="text-gray-500 text-xs sm:text-sm">No peers connected</p>
          <p className="text-gray-400 text-xs mt-1">
            Share the room link to invite others
          </p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {peers.map((peer) => {
            const connectionState = getConnectionState(peer.id);
            const progress = getPeerProgress(peer.id);

            return (
              <div
                key={peer.id}
                className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors duration-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs sm:text-sm font-semibold">
                        {peer.id.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <span className="font-medium text-gray-900 text-xs sm:text-sm truncate">
                          Peer {peer.id.slice(0, 6)}
                          <span className="hidden sm:inline">
                            {peer.id.slice(6, 8)}
                          </span>
                        </span>
                        {peer.isHost && (
                          <span className="px-1 sm:px-1.5 py-0.5 bg-orange-100 text-orange-800 text-xs font-medium rounded flex-shrink-0">
                            HOST
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        <span className="sm:hidden">
                          Joined{" "}
                          {new Date(peer.joinedAt).toLocaleTimeString([], {
                            timeStyle: "short",
                          })}
                        </span>
                        <span className="hidden sm:inline">
                          Joined {new Date(peer.joinedAt).toLocaleTimeString()}
                        </span>
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-1.5 sm:px-2 py-1 text-xs font-medium rounded border ${getStatusColor(
                      connectionState
                    )} flex-shrink-0 ml-2`}
                  >
                    <span className="sm:hidden">
                      {connectionState === "connected"
                        ? "✓"
                        : connectionState === "connecting"
                        ? "..."
                        : "✗"}
                    </span>
                    <span className="hidden sm:inline">
                      {getStatusText(connectionState)}
                    </span>
                  </span>
                </div>

                {/* Transfer Progress */}
                {progress && (
                  <div className="mt-2 sm:mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium text-gray-900 font-mono">
                        {progress.percentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          progress.status === "downloading"
                            ? "bg-blue-500 progress-pulse"
                            : progress.status === "completed"
                            ? "bg-green-500"
                            : progress.status === "error"
                            ? "bg-red-500"
                            : "bg-gray-400"
                        }`}
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-900">
                      <span className="truncate mr-2">
                        <span className="sm:hidden">
                          {formatBytes(progress.receivedBytes || 0)}
                        </span>
                        <span className="hidden sm:inline">
                          {formatBytes(progress.receivedBytes || 0)} /{" "}
                          {formatBytes(progress.totalBytes || 0)}
                        </span>
                      </span>
                      {progress.speed > 0 && (
                        <span className="speed-indicator font-mono flex-shrink-0">
                          {formatSpeed(progress.speed)}
                        </span>
                      )}
                    </div>

                    {/* Enhanced ETA Display */}
                    <div className="text-xs text-gray-500 flex items-center justify-between">
                      <span className="flex items-center space-x-1">
                        <span>ETA:</span>
                        {progress.eta &&
                          progress.eta !== "calculating..." &&
                          progress.eta !== "—" && (
                            <span
                              className={`font-mono ${
                                progress.etaStable
                                  ? "text-gray-700"
                                  : "text-yellow-600"
                              }`}
                            >
                              {progress.eta}
                            </span>
                          )}
                        {progress.eta === "calculating..." && (
                          <span className="text-yellow-600">
                            calculating...
                          </span>
                        )}
                        {progress.eta === "—" && (
                          <span className="text-gray-400">—</span>
                        )}
                      </span>
                      {progress.etaStable &&
                        progress.etaLowText &&
                        progress.etaHighText && (
                          <span className="text-xs text-gray-400 hidden lg:inline">
                            ±({progress.etaLowText}-{progress.etaHighText})
                          </span>
                        )}
                    </div>

                    {progress.status === "error" && progress.error && (
                      <div className="text-xs text-red-600 bg-red-50 p-2 rounded break-all">
                        Error: {progress.error}
                      </div>
                    )}
                  </div>
                )}

                {/* Connection Stats (if available) */}
                {connectionState === "connected" && (
                  <div className="mt-2 sm:mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs text-gray-500">
                    <div className="flex justify-between sm:block">
                      <span className="font-medium">Connection</span>
                      <span className="flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                        <span className="sm:hidden">Direct</span>
                        <span className="hidden sm:inline">WebRTC Direct</span>
                      </span>
                    </div>
                    <div className="flex justify-between sm:block">
                      <span className="font-medium">Data Channel</span>
                      <span className="flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                        <span className="sm:inline">Open</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Room Stats */}
      {peers.length > 0 && (
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200">
          <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-2">
            Room Statistics
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs text-gray-600">
            <div className="text-center sm:text-left">
              <span className="block">Total Peers</span>
              <span className="font-semibold text-gray-900 text-sm sm:text-base">
                {peers.length}
              </span>
            </div>
            <div className="text-center sm:text-left">
              <span className="block">Connected</span>
              <span className="font-semibold text-green-600 text-sm sm:text-base">
                {
                  peers.filter((p) => getConnectionState(p.id) === "connected")
                    .length
                }
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
