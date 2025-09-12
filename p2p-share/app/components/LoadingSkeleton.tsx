'use client'

import { ReactNode } from 'react'

// Base skeleton component with shimmer animation
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div 
      className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-md ${className}`}
      style={{
        backgroundImage: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite'
      }}
    />
  )
}

// Room connection skeleton
export function RoomConnectionSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="text-center space-y-4">
        <Skeleton className="w-8 h-8 rounded-full mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
        <Skeleton className="h-3 w-48 mx-auto" />
        <div className="flex justify-center space-x-2">
          <Skeleton className="w-2 h-2 rounded-full" />
          <Skeleton className="w-2 h-2 rounded-full" />
          <Skeleton className="w-2 h-2 rounded-full" />
        </div>
      </div>
    </div>
  )
}

// Peer list skeleton
export function PeerListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-24" />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-100">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-2 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// File transfer skeleton
export function FileTransferSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="flex space-x-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
    </div>
  )
}

// Loading overlay for transitions
export function LoadingOverlay({ 
  show, 
  message = "Loading...",
  children 
}: { 
  show: boolean
  message?: string
  children: ReactNode 
}) {
  if (!show) return <>{children}</>

  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
        <div className="text-center">
          <div className="inline-flex items-center space-x-2">
            <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span className="text-sm text-gray-600">{message}</span>
          </div>
        </div>
      </div>
    </div>
  )
}