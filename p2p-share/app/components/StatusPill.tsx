"use client";

import { useMemo } from "react";

type SocketState = 'disconnected' | 'connecting' | 'connected';
type RTCConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
type DataChannelState = 'connecting' | 'open' | 'closing' | 'closed';

interface ConnectionStates {
  socket?: SocketState;
  rtcConnection?: RTCConnectionState;
  dataChannel?: DataChannelState;
}

interface StatusPillProps {
  states: ConnectionStates;
  className?: string;
  showLabels?: boolean;
}

type OverallStatus = 'connected' | 'connecting' | 'disconnected' | 'failed';

export default function StatusPill({ states, className = "", showLabels = true }: StatusPillProps) {
  
  const overallStatus: OverallStatus = useMemo(() => {
    const { socket, rtcConnection, dataChannel } = states;
    
    // Failed states take highest priority
    if (rtcConnection === 'failed') return 'failed';
    
    // Disconnected states
    if (socket === 'disconnected' || rtcConnection === 'disconnected' || rtcConnection === 'closed') {
      return 'disconnected';
    }
    
    // All must be connected for overall connected status
    if (socket === 'connected' && rtcConnection === 'connected' && dataChannel === 'open') {
      return 'connected';
    }
    
    // Otherwise we're in some connecting state
    return 'connecting';
  }, [states]);

  const getPillConfig = (status: OverallStatus) => {
    switch (status) {
      case 'connected':
        return {
          bg: 'bg-green-100',
          text: 'text-green-800',
          border: 'border-green-200',
          dot: 'bg-green-400',
          label: 'Connected',
          icon: '✓'
        };
      case 'connecting':
        return {
          bg: 'bg-yellow-100',
          text: 'text-yellow-800', 
          border: 'border-yellow-200',
          dot: 'bg-yellow-400',
          label: 'Connecting',
          icon: '...'
        };
      case 'failed':
        return {
          bg: 'bg-red-100',
          text: 'text-red-800',
          border: 'border-red-200', 
          dot: 'bg-red-400',
          label: 'Failed',
          icon: '✗'
        };
      case 'disconnected':
      default:
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-800',
          border: 'border-gray-200',
          dot: 'bg-gray-400', 
          label: 'Disconnected',
          icon: '○'
        };
    }
  };

  const config = getPillConfig(overallStatus);
  
  const getStateIcon = (state: string) => {
    switch (state) {
      case 'connected':
      case 'open':
        return '●';
      case 'connecting':
        return '◐';
      case 'failed':
        return '✗';
      case 'disconnected':
      case 'closed':
      default:
        return '○';
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'connected':
      case 'open':
        return 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      case 'failed':
        return 'text-red-600';
      case 'disconnected':
      case 'closed':
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      {/* Main Status Pill */}
      <div className={`
        inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border
        ${config.bg} ${config.text} ${config.border}
        transition-all duration-200
      `}>
        <div className={`w-2 h-2 rounded-full mr-1.5 ${config.dot} 
          ${overallStatus === 'connecting' ? 'animate-pulse' : ''}`} 
        />
        <span className="sm:hidden">{config.icon}</span>
        <span className="hidden sm:inline">{showLabels ? config.label : config.icon}</span>
      </div>

    </div>
  );
}

/**
 * Hook to extract connection states from various connection objects
 */
export function useConnectionStates(
  socket: any,
  rtcConnection: RTCPeerConnection | null,
  dataChannel: RTCDataChannel | null
): ConnectionStates {
  const socketState: SocketState = useMemo(() => {
    if (!socket) return 'disconnected';
    if (socket.connected) return 'connected';
    if (socket.connecting) return 'connecting';
    return 'disconnected';
  }, [socket?.connected, socket?.connecting]);

  const rtcState: RTCConnectionState = useMemo(() => {
    return rtcConnection?.connectionState || 'new';
  }, [rtcConnection?.connectionState]);

  const dataChannelState: DataChannelState = useMemo(() => {
    return dataChannel?.readyState || 'closed';
  }, [dataChannel?.readyState]);

  return {
    socket: socketState,
    rtcConnection: rtcState,
    dataChannel: dataChannelState,
  };
}

/**
 * Simplified status pill that takes a peer connection object directly
 */
export function PeerConnectionStatusPill({ 
  connection, 
  socket,
  className,
  showLabels = false
}: { 
  connection: { connection?: RTCPeerConnection | null; dataChannel?: RTCDataChannel | null } | null;
  socket?: any;
  className?: string; 
  showLabels?: boolean;
}) {
  const states = useConnectionStates(
    socket,
    connection?.connection || null,
    connection?.dataChannel || null
  );

  return <StatusPill states={states} className={className} showLabels={showLabels} />;
}