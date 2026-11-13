import { initNativeHostListener } from './native-host';
import { initStorageManagerListener } from './storage-manager';

/**
 * Background script entry point
 * Initializes all background services and listeners
 */
export default defineBackground(() => {
  // Initialize core services
  initNativeHostListener();
  initStorageManagerListener();
});
