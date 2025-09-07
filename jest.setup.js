import '@testing-library/jest-dom'

// Mock Web Audio API for testing
global.AudioContext = jest.fn().mockImplementation(() => ({
  createAnalyser: jest.fn(),
  createGain: jest.fn(),
  createScriptProcessor: jest.fn(),
  createMediaStreamSource: jest.fn(),
  decodeAudioData: jest.fn(),
  resume: jest.fn(),
  close: jest.fn(),
  currentTime: 0,
  state: 'running'
}))

global.webkitAudioContext = global.AudioContext

// Mock navigator.mediaDevices for testing
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: jest.fn(() => [])
    })
  }
})

// Mock URL.createObjectURL for file handling tests
global.URL.createObjectURL = jest.fn(() => 'mocked-url')
global.URL.revokeObjectURL = jest.fn()

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock Worker for audio processing tests
global.Worker = jest.fn().mockImplementation(() => ({
  postMessage: jest.fn(),
  terminate: jest.fn(),
  onmessage: null,
  onerror: null
}))