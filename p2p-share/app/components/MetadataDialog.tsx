'use client'

import { FileMetadata } from '@/types'
import { formatBytes } from '@/chunking'

interface MetadataDialogProps {
  metadata: FileMetadata
  onAccept: () => void
  onReject: () => void
}

export default function MetadataDialog({ metadata, onAccept, onReject }: MetadataDialogProps) {
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return (
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m4 16 4.586-4.586a2 2 0 012.828 0L16 16m-2-2 1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    } else if (type.startsWith('video/')) {
      return (
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
    } else if (type.startsWith('audio/')) {
      return (
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      )
    } else if (type === 'application/pdf') {
      return (
        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    } else if (type.includes('zip') || type.includes('archive')) {
      return (
        <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    } else {
      return (
        <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
  }

  const estimateTransferTime = (sizeBytes: number) => {
    // Rough estimate based on typical WebRTC speeds
    const avgSpeedBytesPerSecond = 1024 * 1024 // 1 MB/s average
    const seconds = sizeBytes / avgSpeedBytesPerSecond
    
    if (seconds < 60) {
      return `~${Math.ceil(seconds)}s`
    } else if (seconds < 3600) {
      const minutes = Math.ceil(seconds / 60)
      return `~${minutes}m`
    } else {
      const hours = Math.ceil(seconds / 3600)
      return `~${hours}h`
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 lg:p-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold">Incoming File</h2>
            <button
              onClick={onReject}
              className="text-white hover:text-gray-200 transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-blue-100 mt-1 text-sm sm:text-base">
            The host wants to share a file with you
          </p>
        </div>

        {/* File Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div className="flex items-start space-x-3 sm:space-x-4 mb-4 sm:mb-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
              {getFileIcon(metadata.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-all mb-1 sm:mb-2">
                {metadata.name}
              </h3>
              
              <div className="space-y-2 text-xs sm:text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Size:</span>
                  <span className="font-medium text-gray-900">
                    {formatBytes(metadata.size)}
                  </span>
                </div>
                
                {metadata.type && (
                  <div className="flex items-center justify-between">
                    <span>Type:</span>
                    <span className="font-medium text-gray-900 truncate ml-2">
                      {metadata.type}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span>Chunks:</span>
                  <span className="font-medium text-gray-900">
                    {metadata.totalChunks.toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Est. Time:</span>
                  <span className="font-medium text-gray-900">
                    {estimateTransferTime(metadata.size)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Transfer Info */}
          <div className="bg-blue-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-start space-x-2 sm:space-x-3">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-medium text-blue-900 mb-1 text-sm sm:text-base">Transfer Details</h4>
                <ul className="text-xs sm:text-sm text-blue-700 space-y-1">
                  <li>• Direct peer-to-peer transfer (no servers)</li>
                  <li className="hidden sm:block">• Chunked streaming with pause/resume support</li>
                  <li>• File is stored locally in your browser</li>
                  <li className="hidden sm:block">• Transfer can be paused and resumed anytime</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-amber-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-start space-x-2 sm:space-x-3">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h4 className="font-medium text-amber-900 mb-1 text-sm sm:text-base">Security Notice</h4>
                <p className="text-xs sm:text-sm text-amber-700">
                  Only accept files from trusted sources. Always scan downloaded files 
                  <span className="hidden sm:inline"> with your antivirus software</span> before opening them.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={onAccept}
              className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors duration-200 flex items-center justify-center space-x-2 text-sm sm:text-base"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Accept & Download</span>
            </button>
            
            <button
              onClick={onReject}
              className="flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors duration-200 flex items-center justify-center space-x-2 text-sm sm:text-base"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Decline</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}