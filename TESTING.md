# P2P File Sharing - Testing Guide

## Prerequisites

Before testing, ensure you have:
- Node.js 18+ installed
- Modern browser (Chrome, Firefox, Safari, Edge)
- Multiple browser tabs or devices available
- Test files of various sizes (recommended: 1MB, 10MB, 100MB)

## Setup Instructions

### 1. Install Dependencies

```bash
# Frontend
cd p2p-share
npm install

# Signaling Server
cd ../signaling-server
npm install
```

### 2. Start Services

```bash
# Terminal 1: Start signaling server
cd signaling-server
npm start

# Terminal 2: Start frontend development server
cd p2p-share
npm run dev
```

### 3. Verify Setup

- Signaling server: http://localhost:3001/health
- Frontend: http://localhost:3000
- Both should return success responses

## Testing Scenarios

### Basic Functionality Tests

#### Test 1: Room Creation and Joining
**Goal**: Verify basic room functionality

1. Open http://localhost:3000
2. Click "Create New Room"
3. Verify you're redirected to `/r/[roomId]`
4. Copy the room URL
5. Open a new incognito tab/window
6. Navigate to the copied URL
7. Verify both tabs show connected peers

**Expected Result**:
- First tab shows "You are the host"
- Second tab shows "Connected as peer"
- Both show 1 peer in the peer list

#### Test 2: File Selection and Metadata Preview
**Goal**: Test file selection and metadata dialog

1. As host, select a test file (1-10MB recommended)
2. Click "Start Sharing"
3. On peer tab, verify metadata dialog appears
4. Check file name, size, type are correct
5. Click "Accept & Download"

**Expected Result**:
- Metadata dialog shows correct file information
- Progress bars appear on both host and peer
- Transfer begins automatically

#### Test 3: Small File Transfer (< 1MB)
**Goal**: Verify complete transfer of small files

1. Share a small file (< 1MB)
2. Let transfer complete
3. Verify file downloads automatically

**Expected Result**:
- Transfer completes quickly (< 30 seconds)
- Downloaded file matches original exactly
- Progress shows 100% completion

### Advanced Feature Tests

#### Test 4: Large File Transfer (10MB+)
**Goal**: Test chunking and progress tracking

1. Share a larger file (10MB+)
2. Monitor transfer progress
3. Verify chunking behavior
4. Check transfer speeds

**Expected Result**:
- Progress updates smoothly
- Transfer speed is reasonable (varies by connection)
- File integrity maintained

#### Test 5: Multiple Peers
**Goal**: Test one-to-many distribution

1. Create room with host
2. Add 2-3 peer tabs/windows
3. Share a file from host
4. Verify all peers receive the file

**Expected Result**:
- All peers see metadata dialog
- All peers can download simultaneously
- Host tracks progress for all peers

#### Test 6: Host Disconnect/Reconnect
**Goal**: Test pause/resume functionality

1. Start file transfer
2. Wait until ~25% complete
3. Close host tab
4. Verify peers show "paused" status
5. Reopen host tab with same room URL
6. Verify transfer resumes

**Expected Result**:
- Peers pause when host disconnects
- Transfer resumes from correct position
- No duplicate chunks downloaded

#### Test 7: Late Joiner
**Goal**: Test joining during active transfer

1. Start file transfer between host and peer
2. Wait until ~50% complete
3. Join with a new peer tab
4. Verify new peer can download from current state

**Expected Result**:
- New peer sees metadata dialog
- New peer starts downloading from beginning
- Existing transfer continues unaffected

### Network Condition Tests

#### Test 8: Slow Network Simulation
**Goal**: Test under constrained bandwidth

1. Open Chrome DevTools → Network tab
2. Set throttling to "Slow 3G"
3. Perform file transfer
4. Monitor behavior under constraints

**Expected Result**:
- Transfer adapts to slower speeds
- Backpressure handling prevents browser freezing
- Progress updates remain smooth

#### Test 9: Connection Interruption
**Goal**: Test network resilience

1. Start file transfer
2. Disable network briefly (WiFi off/on)
3. Re-enable network
4. Verify reconnection behavior

**Expected Result**:
- Signaling reconnects automatically
- WebRTC connections re-establish
- Transfer resumes or restarts as appropriate

### Browser Compatibility Tests

#### Test 10: Cross-Browser Transfer
**Goal**: Verify browser interoperability

1. Host in Chrome, peer in Firefox
2. Host in Safari, peer in Chrome
3. Test various browser combinations

**Expected Result**:
- All modern browsers work together
- No browser-specific issues
- Consistent performance

#### Test 11: Mobile Browser Testing
**Goal**: Test mobile compatibility

1. Use Chrome on Android as peer
2. Use Safari on iOS as peer (if available)
3. Test file transfers to/from mobile

**Expected Result**:
- Mobile browsers connect successfully
- Touch interface works properly
- File downloads work on mobile

### Error Handling Tests

#### Test 12: Invalid Room ID
**Goal**: Test error handling for bad room IDs

1. Navigate to `/r/invalid123`
2. Try `/r/short`
3. Try `/r/toolongid`

**Expected Result**:
- Redirects to home page
- Shows appropriate error message

#### Test 13: File Type Restrictions
**Goal**: Test various file types

1. Try text files, images, videos, executables
2. Test very large files (100MB+)
3. Test zero-byte files

**Expected Result**:
- All file types accepted
- Large files chunk properly
- Edge cases handled gracefully

#### Test 14: Concurrent Room Testing
**Goal**: Test multiple rooms simultaneously

1. Create Room A with file transfer
2. Create Room B with different file
3. Verify rooms are isolated

**Expected Result**:
- Rooms operate independently
- No cross-room interference
- Server handles multiple rooms

### Performance Tests

#### Test 15: Transfer Speed Benchmarking
**Goal**: Measure transfer performance

1. Test with 1MB, 10MB, 50MB files
2. Record transfer times
3. Compare with expected HTTP speeds

**Expected Result**:
- P2P should approach local network speeds
- Chunking overhead should be minimal
- Speed scales with file size

#### Test 16: Memory Usage
**Goal**: Verify memory efficiency

1. Open browser DevTools → Memory tab
2. Start large file transfer
3. Monitor memory usage during transfer

**Expected Result**:
- Memory usage remains reasonable
- No memory leaks during transfer
- Chunks are processed efficiently

### Data Integrity Tests

#### Test 17: File Hash Verification
**Goal**: Verify transferred files match originals

1. Generate MD5/SHA256 of original file
2. Transfer file via P2P
3. Generate hash of downloaded file
4. Compare hashes

**Expected Result**:
- Hashes match exactly
- No corruption during transfer
- File size matches precisely

## Automated Testing

### Unit Tests (Future Enhancement)
```bash
cd p2p-share
npm run test
```

### Integration Tests
```bash
cd p2p-share
npm run test:integration
```

## Debugging Tips

### Client-Side Debugging
1. Open browser DevTools → Console
2. Look for WebRTC connection logs
3. Check IndexedDB entries in Application tab
4. Monitor Network tab for Socket.IO traffic

### Server-Side Debugging
1. Check signaling server console logs
2. Visit `/stats` endpoint for room statistics
3. Monitor connection counts

### Common Issues

#### "Failed to connect to signaling server"
- Verify server is running on port 3001
- Check CORS configuration
- Ensure firewall allows connections

#### "WebRTC connection failed"
- May indicate NAT traversal issues
- Try different network environments
- For production, consider TURN servers

#### "Transfer hangs at X%"
- Check for JavaScript errors
- Verify IndexedDB quota not exceeded
- Monitor memory usage

## Test Data Generation

### Creating Test Files
```bash
# Create files of specific sizes for testing
dd if=/dev/urandom of=test1mb.bin bs=1024 count=1024
dd if=/dev/urandom of=test10mb.bin bs=1024 count=10240
dd if=/dev/urandom of=test100mb.bin bs=1024 count=102400
```

### Verification Scripts
```bash
# Calculate file checksums
md5sum test*.bin > checksums.md5
sha256sum test*.bin > checksums.sha256
```

## Performance Benchmarks

### Expected Performance (Local Network)
- Small files (< 1MB): < 5 seconds
- Medium files (1-10MB): 10-30 seconds  
- Large files (10-100MB): 1-5 minutes
- Very large files (> 100MB): 5+ minutes

### Factors Affecting Performance
- Network bandwidth between peers
- Browser WebRTC implementation
- Available memory and CPU
- Chunk size configuration
- Number of concurrent peers

## Reporting Issues

When reporting bugs, include:
1. Browser versions (host and peer)
2. File size and type being transferred
3. Console error messages
4. Network conditions
5. Steps to reproduce
6. Expected vs actual behavior

## Success Criteria

The application passes testing if:
- ✅ Basic file transfers work reliably
- ✅ Multiple peers can download simultaneously
- ✅ Pause/resume works correctly
- ✅ Late joiners can participate
- ✅ No data corruption occurs
- ✅ UI remains responsive during transfers
- ✅ Error conditions are handled gracefully
- ✅ Browser compatibility is maintained