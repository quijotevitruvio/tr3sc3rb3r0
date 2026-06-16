// Entry para empaquetar el motor "Fake IA" y correrlo en el navegador (demo).
// El motor es puro y sin dependencias, así que bundlea a un ESM mínimo.
export { greeting, step, initState } from './engine.js';
export type { Flow, BotState, StepResult } from './engine.js';
export { EXAMPLE_FLOW } from './flow.example.js';
