'use client'

interface TransferControlsProps {
  isTransferActive?: boolean
  isPaused?: boolean
  canPause?: boolean
  canResume?: boolean
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  progress?: {
    percentage: number
    speed: number
    eta: number
  }
}

export default function TransferControls({
  isTransferActive = false,
  isPaused = false,
  canPause = false,
  canResume = false,
  onPause,
  onResume,
  onCancel,
  progress
}: TransferControlsProps) {
  if (!isTransferActive && !progress) {
    return null
  }

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '--'
    
    const kb = bytesPerSecond / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB/s`
    
    const mb = kb / 1024
    if (mb < 1024) return `${mb.toFixed(1)} MB/s`
    
    const gb = mb / 1024
    return `${gb.toFixed(1)} GB/s`
  }

  const formatEta = (seconds: number): string => {
    if (!isFinite(seconds) || seconds <= 0) return '--'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    } else {
      return `${remainingSeconds}s`
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          File Transfer
        </h3>
        <div className="flex items-center space-x-2">
          {isPaused ? (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
              Paused
            </span>
          ) : isTransferActive ? (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
              Active
            </span>
          ) : (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
              Idle
            </span>
          )}
        </div>
      </div>

      {progress && (
        <>
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span className="font-medium text-gray-900">
                {progress.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  isPaused
                    ? 'bg-yellow-500'
                    : isTransferActive
                    ? 'bg-blue-500 progress-pulse'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(progress.percentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Transfer Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <span className="block text-gray-600">Transfer Speed</span>
              <span className="font-semibold text-gray-900 speed-indicator">
                {formatSpeed(progress.speed)}
              </span>
            </div>
            <div>
              <span className="block text-gray-600">Time Remaining</span>
              <span className="font-semibold text-gray-900">
                {formatEta(progress.eta)}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Control Buttons */}
      <div className="flex space-x-3">
        {isPaused ? (
          <button
            onClick={onResume}
            disabled={!canResume}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M12 2a10 10 0 1010 10A10 10 0 0012 2z" />
            </svg>
            <span>Resume</span>
          </button>
        ) : (
          <button
            onClick={onPause}
            disabled={!canPause || !isTransferActive}
            className="flex-1 bg-yellow-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Pause</span>
          </button>
        )}

        <button
          onClick={onCancel}
          className="px-4 py-2 border border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-50 transition-colors duration-200 flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Cancel</span>
        </button>
      </div>

      {/* Status Messages */}
      {isPaused && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm text-yellow-800">
              Transfer is paused. Click Resume to continue downloading.
            </span>
          </div>
        </div>
      )}

      {!isTransferActive && !isPaused && progress && progress.percentage < 100 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-blue-800">
              Transfer will resume automatically when the host reconnects.
            </span>
          </div>
        </div>
      )}

      {progress && progress.percentage >= 100 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-green-800">
              Transfer completed successfully! File is ready for download.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}