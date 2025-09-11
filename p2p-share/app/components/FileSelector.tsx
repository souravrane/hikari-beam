'use client'

import { useState, useRef, useCallback } from 'react'
import { formatBytes } from '@/chunking'

interface FileSelectorProps {
  roomId: string
  onFileSelected?: (file: File) => void
}

export default function FileSelector({ roomId, onFileSelected }: FileSelectorProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file)
    onFileSelected?.(file)
  }, [onFileSelected])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const startSharing = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    try {
      console.log('Starting to share file:', selectedFile.name)
      // Call the onFileSelected callback if provided
      onFileSelected?.(selectedFile)
    } catch (error) {
      console.error('Error sharing file:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Share a File</h2>

      {!selectedFile ? (
        <>
          {/* File Drop Zone */}
          <div
            className={`drop-zone border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
              isDragOver 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Drop your file here
            </h3>
            <p className="text-gray-600 mb-4">
              Or click to browse your files
            </p>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
            >
              Browse Files
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInputChange}
              className="hidden"
              accept="*/*"
            />
          </div>

          {/* File Type Info */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Supported Files</h4>
            <p className="text-sm text-blue-700">
              Any file type is supported. Large files are automatically chunked for efficient transfer 
              with pause/resume capabilities.
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Selected File Info */}
          <div className="border border-gray-200 rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg break-all">
                    {selectedFile.name}
                  </h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div>Size: <span className="font-medium">{formatBytes(selectedFile.size)}</span></div>
                    {selectedFile.type && (
                      <div>Type: <span className="font-medium">{selectedFile.type}</span></div>
                    )}
                    <div>Modified: <span className="font-medium">
                      {new Date(selectedFile.lastModified).toLocaleString()}
                    </span></div>
                  </div>
                </div>
              </div>
              
              <button
                onClick={clearFile}
                className="text-gray-500 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Share Actions */}
          <div className="flex space-x-4">
            <button
              onClick={startSharing}
              disabled={isUploading}
              className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z"></path>
                  </svg>
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                  <span>Start Sharing</span>
                </>
              )}
            </button>
            
            <button
              onClick={clearFile}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors duration-200"
            >
              Choose Different File
            </button>
          </div>

          {/* Sharing Info */}
          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">Ready to Share</h4>
            <p className="text-sm text-green-700">
              Once you start sharing, all peers in this room will be able to see and download this file. 
              The transfer happens directly between browsers - no servers involved!
            </p>
          </div>
        </>
      )}
    </div>
  )
}