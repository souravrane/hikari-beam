"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Holt, ETAFormatter } from "./Holt";

interface ThroughputSample {
  timestamp: number;
  bytes: number;
}

interface ETAPrediction {
  etaText: string;
  etaLowText?: string;
  etaHighText?: string;
  stable: boolean;
  currentSpeed: number;
  forecastedSpeed: number;
}

interface ETAPredictorConfig {
  windowMs?: number; // Throughput sampling window (default: 4000ms)
  updateIntervalMs?: number; // How often to update ETA (default: 1000ms)
  stallTimeMs?: number; // Time without data to consider stalled (default: 2000ms)
  minBps?: number; // Minimum BPS to avoid division by zero (default: 1)
  maxBps?: number; // Maximum BPS cap (default: 100MB/s)
  alpha?: number; // Holt alpha parameter (default: 0.5)
  beta?: number; // Holt beta parameter (default: 0.3)
}

/**
 * React hook for per-peer ETA prediction using Holt's linear trend smoothing
 * @param peerId Unique identifier for this peer
 * @param totalBytes Total bytes to be transferred
 * @param config Configuration options
 * @returns ETA prediction object and onChunk callback
 */
export function useEtaPredictor(
  peerId: string,
  totalBytes: number,
  config: ETAPredictorConfig = {}
): ETAPrediction & { onChunk: (byteLength: number) => void } {
  const {
    windowMs = 4000,
    updateIntervalMs = 1000,
    stallTimeMs = 2000,
    minBps = 1,
    maxBps = 100 * 1024 * 1024, // 100 MB/s
    alpha = 0.5,
    beta = 0.3,
  } = config;

  const [prediction, setPrediction] = useState<ETAPrediction>({
    etaText: "calculating...",
    stable: false,
    currentSpeed: 0,
    forecastedSpeed: 0,
  });

  // State refs for performance
  const samplesRef = useRef<ThroughputSample[]>([]);
  const receivedBytesRef = useRef(0);
  const lastByteTimeRef = useRef<number>(0);
  const holtRef = useRef<Holt>(new Holt({ alpha, beta }));
  const intervalRef = useRef<NodeJS.Timeout>();

  /**
   * Add a new chunk to the throughput calculation
   */
  const onChunk = useCallback((byteLength: number) => {
    const now = Date.now();
    receivedBytesRef.current += byteLength;
    lastByteTimeRef.current = now;

    // Add sample to window
    samplesRef.current.push({ timestamp: now, bytes: byteLength });

    // Remove old samples outside window
    const windowStart = now - windowMs;
    samplesRef.current = samplesRef.current.filter(
      sample => sample.timestamp >= windowStart
    );
  }, [windowMs]);

  /**
   * Calculate current throughput from sample window
   */
  const calculateCurrentThroughput = useCallback((): number => {
    const samples = samplesRef.current;
    if (samples.length === 0) return 0;

    const now = Date.now();
    const totalBytes = samples.reduce((sum, sample) => sum + sample.bytes, 0);
    const oldestTime = samples[0]?.timestamp || now;
    const timeSpanMs = Math.max(1, now - oldestTime);
    
    return (totalBytes / timeSpanMs) * 1000; // Convert to bytes per second
  }, []);

  /**
   * Update ETA prediction
   */
  const updatePrediction = useCallback(() => {
    const now = Date.now();
    const timeSinceLastByte = now - lastByteTimeRef.current;

    // Check for stall condition
    if (timeSinceLastByte > stallTimeMs && receivedBytesRef.current > 0) {
      setPrediction(prev => ({
        ...prev,
        etaText: "—",
        stable: prev.stable,
      }));
      return;
    }

    // Calculate current throughput
    const currentBps = calculateCurrentThroughput();
    
    // Update Holt model if we have meaningful throughput
    if (currentBps > 0) {
      holtRef.current.update(currentBps);
    }

    const holt = holtRef.current;
    const forecastedBps = holt.forecast(1);
    const clampedBps = Math.max(minBps, Math.min(maxBps, forecastedBps));
    
    const remainingBytes = Math.max(0, totalBytes - receivedBytesRef.current);
    const etaSeconds = remainingBytes / clampedBps;

    const isStable = holt.isStable() && receivedBytesRef.current > 0;

    // Calculate confidence bounds for uncertainty
    let etaLowText: string | undefined;
    let etaHighText: string | undefined;

    if (isStable) {
      const bounds = holt.getForecastBounds(1);
      const lowBps = Math.max(minBps, Math.min(maxBps, bounds.low));
      const highBps = Math.max(minBps, Math.min(maxBps, bounds.high));
      
      // Higher BPS = lower ETA, lower BPS = higher ETA
      const etaLow = remainingBytes / Math.max(highBps, minBps);
      const etaHigh = remainingBytes / Math.max(lowBps, minBps);
      
      etaLowText = ETAFormatter.formatETA(etaLow);
      etaHighText = ETAFormatter.formatETA(etaHigh);
    }

    setPrediction({
      etaText: isStable || receivedBytesRef.current === 0 ? 
        ETAFormatter.formatETA(etaSeconds) : "calculating...",
      etaLowText,
      etaHighText,
      stable: isStable,
      currentSpeed: currentBps,
      forecastedSpeed: forecastedBps,
    });
  }, [
    totalBytes, 
    stallTimeMs, 
    minBps, 
    maxBps, 
    calculateCurrentThroughput
  ]);

  // Start prediction update interval
  useEffect(() => {
    intervalRef.current = setInterval(updatePrediction, updateIntervalMs);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [updatePrediction, updateIntervalMs]);

  // Reset on peerId change
  useEffect(() => {
    samplesRef.current = [];
    receivedBytesRef.current = 0;
    lastByteTimeRef.current = 0;
    holtRef.current.reset();
    setPrediction({
      etaText: "calculating...",
      stable: false,
      currentSpeed: 0,
      forecastedSpeed: 0,
    });
  }, [peerId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    ...prediction,
    onChunk,
  };
}

