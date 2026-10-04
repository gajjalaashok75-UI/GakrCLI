import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';

/**
 * Get storage statistics
 */
export async function handleGetStorageStats(): Promise<{
  success: boolean;
  stats?: any;
  error?: string;
}> {
  return {
    success: true,
    stats: {
      indexedPages: 0,
      totalDocuments: 0,
      totalTabs: 0,
      indexSize: 0,
      isInitialized: false,
    },
  };
}

/**
 * Clear all data
 */
export async function handleClearAllData(): Promise<{ success: boolean; error?: string }> {
  try {
    // Clear related data in chrome.storage
    try {
      const keysToRemove = ['vectorDatabaseStats', 'lastCleanupTime', 'contentIndexerStats'];
      await chrome.storage.local.remove(keysToRemove);
      console.log('Storage: Chrome storage data cleared successfully');
    } catch (storageError) {
      console.warn('Background: Failed to clear chrome storage data:', storageError);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Background: Failed to clear all data:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize storage manager module message listeners
 */
export const initStorageManagerListener = () => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === BACKGROUND_MESSAGE_TYPES.GET_STORAGE_STATS) {
      handleGetStorageStats()
        .then((result: { success: boolean; stats?: any; error?: string }) => sendResponse(result))
        .catch((error: any) => sendResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === BACKGROUND_MESSAGE_TYPES.CLEAR_ALL_DATA) {
      handleClearAllData()
        .then((result: { success: boolean; error?: string }) => sendResponse(result))
        .catch((error: any) => sendResponse({ success: false, error: error.message }));
      return true;
    }
  });
};
