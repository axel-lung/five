/**
 * Metro choisit `sessionStorage.web.ts` ou `sessionStorage.native.ts` selon la
 * plateforme. TypeScript, lui, ne connait pas cette resolution : cette
 * declaration lui donne la forme commune aux deux implementations.
 */
import type { SessionStorage } from './types';

export declare const sessionStorage: SessionStorage;
