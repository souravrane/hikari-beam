'use client'

import { PeerInfo, PeerConnection } from '@/types'
import { formatBytes, formatSpeed } from '@/chunking'

interface PeerListProps {
  peers: PeerInfo[]
  isHost: boolean
  connections: Map<string, PeerConnection>
  transferProgress?: Map<string, any>
}

export default function PeerList({ peers, isHost, connections, transferProgress = new Map() }: PeerListProps) {
  const getConnectionState = (peerId: string) => {
    const connection = connections.get(peerId)
    return connection?.state || 'disconnected'
  }

  const getPeerProgress = (peerId: string) => {
    return transferProgress.get(peerId)
  }

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'disconnected':
      case 'failed':
      default:
        return 'bg-red-100 text-red-800 border-red-200'
    }
  }

  const getStatusText = (state: string) => {
    switch (state) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting'
      case 'disconnected':
        return 'Disconnected'
      case 'failed':
        return 'Failed'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">
          Peers ({peers.length})
        </h3>
        {isHost && (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
            HOST
          </span>
        )}
      </div>

      {peers.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">No peers connected</p>
          <p className="text-gray-400 text-xs mt-1">Share the room link to invite others</p>
        </div>
      ) : (
        <div className="space-y-3">
          {peers.map((peer) => {
            const connectionState = getConnectionState(peer.id)
            const progress = getPeerProgress(peer.id)
            
            return (
              <div
                key={peer.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors duration-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-semibold">
                        {peer.id.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          Peer {peer.id.slice(0, 8)}
                        </span>
                        {peer.isHost && (
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 text-xs font-medium rounded">
                            HOST
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Joined {new Date(peer.joinedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(connectionState)}`}>
                    {getStatusText(connectionState)}
                  </span>
                </div>

                {/* Transfer Progress */}
                {progress && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium text-gray-900">
                        {progress.percentage.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          progress.status === 'downloading'
                            ? 'bg-blue-500 progress-pulse'
                            : progress.status === 'completed'
                            ? 'bg-green-500'
                            : progress.status === 'error'
                            ? 'bg-red-500'
                            : 'bg-gray-400'
                        }`}
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-900">
                      <span>
                        {formatBytes(progress.receivedBytes || 0)} / {formatBytes(progress.totalBytes || 0)}
                      </span>
                      {progress.speed > 0 && (
                        <span className="speed-indicator">
                          {formatSpeed(progress.speed)}
                        </span>
                      )}
                    </div>

                    {progress.eta > 0 && progress.eta < Infinity && (
                      <div className="text-xs text-gray-500">
                        ETA: {Math.ceil(progress.eta / 60)}m {Math.ceil(progress.eta % 60)}s
                      </div>
                    )}

                    {progress.status === 'error' && progress.error && (
                      <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                        Error: {progress.error}
                      </div>
                    )}
                  </div>
                )}

                {/* Connection Stats (if available) */}
                {connectionState === 'connected' && (
                  <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-gray-500">
                    <div>
                      <span className="block font-medium">Connection</span>
                      <span className="flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                        WebRTC Direct
                      </span>
                    </div>
                    <div>
                      <span className="block font-medium">Data Channel</span>
                      <span className="text-green-600">Open</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Room Stats */}
      {peers.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Room Statistics</h4>
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
            <div>
              <span className="block">Total Peers</span>
              <span className="font-semibold text-gray-900">{peers.length}</span>
            </div>
            <div>
              <span className="block">Connected</span>
              <span className="font-semibold text-green-600">
                {peers.filter(p => getConnectionState(p.id) === 'connected').length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}