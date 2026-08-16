// ==========================================================================
// This Area Of Code Is: The OmniScore barrel — one import boots the engine.
// Explanation: Importing this module registers every ingestor and renderer
// with the plugin registry (registration happens at import time). main.tsx
// imports this once; every OmniScore capability comes alive.
// In Other Words: Flip one switch and the whole music brain turns on.
// ==========================================================================

export * from './usmg';
export * from './registry';
export * from './pitch';
import './bridge';
import './omr/staffDetect';
import './acoustic/liveIngest';
