import { MessageTarget } from '@/common/message-types';
import { handleGifMessage } from './gif-encoder';

interface OffscreenMessage {
  target: MessageTarget | string;
  type: string;
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener(
  (
    message: OffscreenMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void,
  ) => {
    if (message.target !== MessageTarget.Offscreen) {
      return;
    }

    // Handle GIF encoding messages
    if (handleGifMessage(message, sendResponse)) {
      return true;
    }

    sendResponse({ error: `Unknown message type: ${message.type}` });
    return false;
  },
);

console.log('Offscreen: GIF encoder handler loaded');
