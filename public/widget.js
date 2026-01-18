(function() {
  'use strict';

  // Configuration - The Landings Brand Colors
  const CONFIG = {
    apiBase: window.LANDINGS_API_BASE || '',
    primaryColor: '#093658',    // Navy
    primaryDark: '#0e2a42',     // Dark Navy
    primaryLight: '#103c5d',    // Navy 700
    accentColor: '#DBCDA5',     // Gold
    ctaColor: '#63a71b',        // Green CTA
    cream: '#F5F0E4',           // Cream background
    grayLight: '#F5F0E4',       // Use cream for light backgrounds
    grayMedium: '#9ca3af',
    grayDark: '#374151',
    storageTTL: 24 * 60 * 60 * 1000  // 24 hours in milliseconds
  };

  // Storage keys
  const STORAGE_KEYS = {
    conversation: 'landings_conversation',
    sessionId: 'landings_session_id',
    exitIntentShown: 'landings_exit_intent_shown'
  };

  // State
  let isOpen = false;
  let messages = [];
  let isLoading = false;
  let conversationId = null;
  let sessionId = null;
  let isReturningUser = false;
  let urgencyStats = null;
  let widgetInitialized = false;

  // Urgency configuration
  const TOTAL_CAPACITY = 50; // Total program capacity

  // Minimal styles for initial button (loaded immediately)
  function injectMinimalStyles() {
    const style = document.createElement('style');
    style.id = 'landings-minimal-styles';
    style.textContent = `
      .landings-widget-container {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .landings-chat-button {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: ${CONFIG.primaryColor};
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        transition: all 0.2s ease;
      }
      .landings-chat-button:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 20px rgba(0,0,0,0.2);
      }
      .landings-chat-button svg {
        width: 28px;
        height: 28px;
        fill: white;
      }
      .landings-chat-button.loading svg {
        animation: landings-spin 1s linear infinite;
      }
      @keyframes landings-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  // Full styles (loaded on first interaction)
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .landings-widget-container * {
        box-sizing: border-box;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      /* Screen reader only */
      .landings-widget-container .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .landings-chat-button {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${CONFIG.primaryColor} 0%, ${CONFIG.primaryLight} 100%);
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(9, 54, 88, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 9999;
      }

      .landings-chat-button::before {
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: inherit;
        animation: landings-pulse 2s infinite;
        z-index: -1;
      }

      .landings-chat-button.open::before {
        animation: none;
      }

      @keyframes landings-pulse {
        0% { transform: scale(1); opacity: 0.5; }
        50% { transform: scale(1.15); opacity: 0; }
        100% { transform: scale(1); opacity: 0; }
      }

      .landings-chat-button:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 24px rgba(9, 54, 88, 0.45);
      }

      .landings-chat-button svg {
        width: 28px;
        height: 28px;
        fill: white;
        transition: transform 0.3s ease;
      }

      .landings-chat-button.open svg {
        transform: rotate(90deg);
      }

      .landings-chat-window {
        position: fixed;
        bottom: 100px;
        right: 24px;
        width: 400px;
        height: 560px;
        background: white;
        border-radius: 20px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 9998;
        opacity: 0;
        transform: translateY(16px) scale(0.96);
        pointer-events: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .landings-chat-window.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .landings-chat-header {
        background: linear-gradient(135deg, ${CONFIG.primaryDark} 0%, ${CONFIG.primaryColor} 100%);
        color: white;
        padding: 20px 20px;
        display: flex;
        align-items: center;
        gap: 14px;
        position: relative;
      }

      .landings-chat-header-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: rgba(255,255,255,0.1);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      .landings-chat-header-close:hover {
        background: rgba(255,255,255,0.2);
      }

      .landings-chat-header-close svg {
        width: 18px;
        height: 18px;
        fill: white;
      }

      .landings-chat-header-icon {
        width: 48px;
        height: 48px;
        background: rgba(255,255,255,0.15);
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .landings-chat-header-icon svg {
        width: 26px;
        height: 26px;
        fill: ${CONFIG.accentColor};
      }

      .landings-chat-header-text h3 {
        margin: 0;
        font-size: 17px;
        font-weight: 600;
        letter-spacing: -0.01em;
        font-family: 'Playfair Display', Georgia, serif;
      }

      .landings-chat-header-status {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 4px;
        font-size: 13px;
        opacity: 0.85;
      }

      .landings-chat-header-status::before {
        content: '';
        width: 8px;
        height: 8px;
        background: ${CONFIG.accentColor};
        border-radius: 50%;
        box-shadow: 0 0 0 2px rgba(219, 205, 165, 0.4);
      }

      .landings-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        background: ${CONFIG.grayLight};
      }

      .landings-message {
        max-width: 85%;
        padding: 14px 18px;
        font-size: 14px;
        line-height: 1.55;
        animation: landings-fadeIn 0.3s ease;
      }

      @keyframes landings-fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .landings-message.bot {
        background: white;
        color: ${CONFIG.grayDark};
        align-self: flex-start;
        border-radius: 4px 18px 18px 18px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }

      .landings-message.user {
        background: ${CONFIG.primaryColor};
        color: white;
        align-self: flex-end;
        border-radius: 18px 18px 4px 18px;
      }

      .landings-typing {
        display: flex;
        gap: 5px;
        padding: 16px 20px;
        background: white;
        border-radius: 4px 18px 18px 18px;
        align-self: flex-start;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }

      .landings-typing span {
        width: 8px;
        height: 8px;
        background: ${CONFIG.grayMedium};
        border-radius: 50%;
        animation: landingsTyping 1.4s infinite;
      }

      .landings-typing span:nth-child(2) { animation-delay: 0.15s; }
      .landings-typing span:nth-child(3) { animation-delay: 0.3s; }

      @keyframes landingsTyping {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-4px); opacity: 1; }
      }

      .landings-chat-input-container {
        padding: 16px 20px;
        background: white;
        border-top: 1px solid #e5e7eb;
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .landings-chat-input {
        flex: 1;
        padding: 14px 18px;
        border: 1px solid #e5e7eb;
        border-radius: 100px;
        font-size: 14px;
        outline: none;
        transition: all 0.2s;
        background: ${CONFIG.grayLight};
      }

      .landings-chat-input:focus {
        border-color: ${CONFIG.primaryColor};
        background: white;
        box-shadow: 0 0 0 3px rgba(9, 54, 88, 0.1);
      }

      .landings-chat-input::placeholder {
        color: ${CONFIG.grayMedium};
      }

      .landings-chat-send {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: ${CONFIG.ctaColor};
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
      }

      .landings-chat-send:hover {
        transform: scale(1.05);
        background: #558f17;
        box-shadow: 0 4px 12px rgba(99, 167, 27, 0.35);
      }

      .landings-chat-send:disabled {
        background: ${CONFIG.grayMedium};
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .landings-chat-send svg {
        width: 20px;
        height: 20px;
        fill: white;
        margin-left: 2px;
      }

      .landings-lead-form {
        padding: 20px;
        background: white;
        border-top: 1px solid #e5e7eb;
      }

      .landings-lead-form h4 {
        margin: 0 0 16px;
        font-size: 15px;
        font-weight: 600;
        color: ${CONFIG.primaryColor};
      }

      .landings-lead-form input,
      .landings-lead-form select {
        width: 100%;
        padding: 12px 16px;
        margin-bottom: 10px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        font-size: 14px;
        outline: none;
        transition: all 0.2s;
        background: ${CONFIG.grayLight};
      }

      .landings-lead-form input:focus,
      .landings-lead-form select:focus {
        border-color: ${CONFIG.primaryColor};
        background: white;
        box-shadow: 0 0 0 3px rgba(9, 54, 88, 0.1);
      }

      .landings-lead-form button {
        width: 100%;
        padding: 14px;
        background: ${CONFIG.ctaColor};
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 4px;
      }

      .landings-lead-form button:hover {
        background: #558f17;
        box-shadow: 0 4px 12px rgba(99, 167, 27, 0.35);
        transform: translateY(-1px);
      }

      .landings-lead-form button:disabled {
        background: ${CONFIG.grayMedium};
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .landings-quick-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 0 20px 16px;
        background: ${CONFIG.grayLight};
      }

      .landings-quick-action {
        padding: 10px 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 100px;
        font-size: 13px;
        font-weight: 500;
        color: ${CONFIG.grayDark};
        cursor: pointer;
        transition: all 0.2s;
      }

      .landings-quick-action:hover {
        background: ${CONFIG.ctaColor};
        color: white;
        border-color: ${CONFIG.ctaColor};
      }

      .landings-powered {
        padding: 12px 20px;
        background: white;
        border-top: 1px solid #e5e7eb;
        text-align: center;
        font-size: 11px;
        color: ${CONFIG.grayMedium};
      }

      .landings-powered a {
        color: ${CONFIG.primaryColor};
        text-decoration: none;
        font-weight: 500;
      }

      .landings-powered a:hover {
        text-decoration: underline;
      }

      /* Urgency messaging */
      .landings-urgency-banner {
        background: linear-gradient(90deg, rgba(219, 205, 165, 0.15), rgba(219, 205, 165, 0.05));
        border-bottom: 1px solid rgba(219, 205, 165, 0.3);
        padding: 10px 16px;
        font-size: 12px;
        color: ${CONFIG.grayDark};
        display: flex;
        align-items: center;
        gap: 8px;
        animation: landings-urgencyPulse 3s ease-in-out infinite;
      }

      @keyframes landings-urgencyPulse {
        0%, 100% { background-color: rgba(219, 205, 165, 0.1); }
        50% { background-color: rgba(219, 205, 165, 0.2); }
      }

      .landings-urgency-banner .urgency-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      .landings-urgency-banner .urgency-text {
        flex: 1;
      }

      .landings-urgency-banner strong {
        color: ${CONFIG.primaryColor};
        font-weight: 600;
      }

      .landings-urgency-flash {
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: ${CONFIG.primaryColor};
        color: white;
        padding: 8px 16px;
        border-radius: 0 0 12px 12px;
        font-size: 11px;
        font-weight: 500;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
        z-index: 1;
      }

      .landings-urgency-flash.visible {
        opacity: 1;
      }

      @media (max-width: 480px) {
        .landings-chat-window {
          bottom: 0;
          right: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 0;
        }

        .landings-chat-button {
          bottom: 20px;
          right: 20px;
        }
      }

      /* Timestamp styles */
      .landings-timestamp {
        text-align: center;
        font-size: 11px;
        color: ${CONFIG.grayMedium};
        margin: 12px 0 4px;
        padding: 4px 12px;
        background: rgba(0,0,0,0.03);
        border-radius: 12px;
        display: inline-block;
        align-self: center;
      }

      /* Form validation styles */
      .landings-field-indicator {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .landings-field-indicator svg {
        width: 16px;
        height: 16px;
      }

      .landings-field-indicator.valid {
        color: ${CONFIG.ctaColor};
      }

      .landings-field-indicator.invalid {
        color: #dc2626;
      }

      .landings-lead-form input.valid {
        border-color: ${CONFIG.ctaColor};
        padding-right: 36px;
      }

      .landings-lead-form input.invalid {
        border-color: #dc2626;
        padding-right: 36px;
      }

      /* Form error message */
      .landings-form-error {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #dc2626;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 13px;
        margin-bottom: 10px;
        display: none;
      }

      /* Privacy consent checkbox */
      .landings-consent-wrapper {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin: 12px 0;
        font-size: 12px;
        color: ${CONFIG.grayDark};
      }

      .landings-consent-wrapper input[type="checkbox"] {
        width: 16px;
        height: 16px;
        margin: 0;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .landings-consent-wrapper a {
        color: ${CONFIG.primaryColor};
        text-decoration: underline;
      }

      /* Exit intent modal */
      .landings-exit-modal {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
        padding: 20px;
      }

      .landings-exit-modal.open {
        opacity: 1;
      }

      .landings-exit-content {
        background: white;
        border-radius: 20px;
        padding: 40px 32px;
        max-width: 380px;
        text-align: center;
        position: relative;
        transform: translateY(20px);
        transition: transform 0.3s ease;
        box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      }

      .landings-exit-modal.open .landings-exit-content {
        transform: translateY(0);
      }

      .landings-exit-close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 32px;
        height: 32px;
        border: none;
        background: ${CONFIG.grayLight};
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      .landings-exit-close:hover {
        background: #e5e7eb;
      }

      .landings-exit-close svg {
        width: 16px;
        height: 16px;
        fill: ${CONFIG.grayDark};
      }

      .landings-exit-icon {
        width: 64px;
        height: 64px;
        background: linear-gradient(135deg, ${CONFIG.primaryColor}, ${CONFIG.primaryLight});
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
      }

      .landings-exit-icon svg {
        width: 32px;
        height: 32px;
        fill: ${CONFIG.accentColor};
      }

      .landings-exit-content h3 {
        font-size: 22px;
        font-weight: 700;
        color: ${CONFIG.primaryColor};
        margin-bottom: 12px;
      }

      .landings-exit-content p {
        color: ${CONFIG.grayDark};
        font-size: 15px;
        margin-bottom: 24px;
        line-height: 1.5;
      }

      .landings-exit-cta {
        width: 100%;
        padding: 14px 24px;
        background: ${CONFIG.ctaColor};
        color: white;
        border: none;
        border-radius: 100px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 12px;
      }

      .landings-exit-cta:hover {
        background: #558f17;
        box-shadow: 0 4px 12px rgba(99, 167, 27, 0.35);
      }

      .landings-exit-dismiss {
        background: none;
        border: none;
        color: ${CONFIG.grayMedium};
        font-size: 13px;
        cursor: pointer;
        padding: 8px;
      }

      .landings-exit-dismiss:hover {
        color: ${CONFIG.grayDark};
      }
    `;
    document.head.appendChild(style);
  }

  // Icons
  const icons = {
    chat: `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h10v2H7zm0-3h10v2H7z"/></svg>`,
    close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
    send: `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`,
    golf: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`,
    fire: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-4.97 0-9-3.03-9-7 0-1.83 1.5-4.5 2.5-5.5.68-.68 1.8-.62 2.4.14.36.46.4 1.1.09 1.6-.5.8-.85 1.74-.85 2.76 0 2.21 1.79 4 4 4s4-1.79 4-4c0-1.02-.35-1.96-.85-2.76-.31-.5-.27-1.14.09-1.6.6-.76 1.72-.82 2.4-.14 1 1 2.5 3.67 2.5 5.5 0 3.97-4.03 7-9 7zm0-18c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1s1-.45 1-1V6c0-.55-.45-1-1-1z"/></svg>`
  };

  // LocalStorage helpers
  function saveConversation() {
    try {
      const data = {
        messages: messages,
        conversationId: conversationId,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEYS.conversation, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save conversation to localStorage:', e);
    }
  }

  function loadConversation() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.conversation);
      if (!stored) return null;

      const data = JSON.parse(stored);
      const age = Date.now() - data.timestamp;

      // Check if conversation is still valid (within TTL)
      if (age > CONFIG.storageTTL) {
        clearConversation();
        return null;
      }

      return data;
    } catch (e) {
      console.warn('Failed to load conversation from localStorage:', e);
      return null;
    }
  }

  function clearConversation() {
    try {
      localStorage.removeItem(STORAGE_KEYS.conversation);
    } catch (e) {
      console.warn('Failed to clear conversation from localStorage:', e);
    }
  }

  function getOrCreateSessionId() {
    try {
      let id = sessionStorage.getItem(STORAGE_KEYS.sessionId);
      if (!id) {
        id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem(STORAGE_KEYS.sessionId, id);
      }
      return id;
    } catch (e) {
      return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  }

  // Generate conversation ID
  function generateId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Create the widget
  function createWidget() {
    const container = document.createElement('div');
    container.className = 'landings-widget-container';
    container.innerHTML = `
      <button class="landings-chat-button" aria-label="Open chat assistant" role="button" tabindex="0">
        ${icons.chat}
      </button>
      <div class="landings-chat-window" role="dialog" aria-label="Chat with The Landings Golf Course" aria-modal="true">
        <div class="landings-chat-header">
          <button class="landings-chat-header-close" aria-label="Close chat">
            ${icons.close}
          </button>
          <div class="landings-chat-header-icon">
            ${icons.golf}
          </div>
          <div class="landings-chat-header-text">
            <h3>The Landings Golf Course</h3>
            <div class="landings-chat-header-status">Online now</div>
          </div>
        </div>
        <div class="landings-urgency-banner" id="landings-urgency" style="display: none;" role="status" aria-live="polite">
          <span class="urgency-icon">${icons.fire}</span>
          <span class="urgency-text" id="landings-urgency-text"></span>
        </div>
        <div class="landings-chat-messages" id="landings-messages" role="log" aria-live="polite" aria-label="Chat messages"></div>
        <nav class="landings-quick-actions" id="landings-quick-actions" role="navigation" aria-label="Quick questions">
          <button class="landings-quick-action" data-message="What are the program dates?" aria-label="Ask about program dates">Program Dates</button>
          <button class="landings-quick-action" data-message="Who are the instructors?" aria-label="Ask about instructors">Instructors</button>
          <button class="landings-quick-action" data-message="How do I sign up?" aria-label="Ask how to sign up">Sign Up</button>
        </nav>
        <form class="landings-lead-form" id="landings-lead-form" style="display: none;" role="form" aria-label="Registration form">
          <h4 id="landings-form-title">Register Your Interest</h4>
          <div style="position: relative;">
            <label for="landings-lead-name" class="sr-only">Your name</label>
            <input type="text" id="landings-lead-name" placeholder="Your name" required aria-required="true" aria-label="Your full name">
          </div>
          <div style="position: relative;">
            <label for="landings-lead-email" class="sr-only">Email address</label>
            <input type="email" id="landings-lead-email" placeholder="Email address" required aria-required="true" aria-label="Email address">
          </div>
          <label for="landings-lead-block" class="sr-only">Block preference</label>
          <select id="landings-lead-block" aria-required="true" aria-label="Select your preferred program">
            <option value="">Select your preference...</option>
            <option value="full">Full 10-Week Program (Best Value)</option>
            <option value="block1">Block 1: Jan 12 - Feb 15, 2026</option>
            <option value="block2">Block 2: Feb 16 - Mar 22, 2026</option>
            <option value="both">Both Blocks</option>
            <option value="undecided">Not Sure Yet</option>
          </select>
          <div class="landings-consent-wrapper">
            <input type="checkbox" id="landings-consent" checked aria-describedby="consent-description">
            <label for="landings-consent" id="consent-description">I agree to have my conversation stored and to receive follow-up communication. <a href="#" onclick="event.preventDefault();">Privacy Policy</a></label>
          </div>
          <button type="button" id="landings-lead-submit" disabled aria-label="Submit registration">Submit Registration</button>
        </form>
        <div class="landings-chat-input-container" id="landings-input-container" role="group" aria-label="Message input">
          <label for="landings-input" class="sr-only">Type your message</label>
          <input type="text" class="landings-chat-input" id="landings-input" placeholder="Type your message..." aria-label="Type your message">
          <button class="landings-chat-send" id="landings-send" aria-label="Send message">
            ${icons.send}
          </button>
        </div>
        <div class="landings-powered">
          Powered by <a href="https://celticgolfkingston.ca" target="_blank">Golf AI Agency</a>
        </div>
      </div>
    `;
    document.body.appendChild(container);
    return container;
  }

  // Render messages
  function renderMessages() {
    const container = document.getElementById('landings-messages');
    let html = '';

    messages.forEach((msg, index) => {
      // Add timestamp display if more than 1 minute apart from previous message
      if (index > 0 && msg.timestamp && messages[index - 1].timestamp) {
        const timeDiff = msg.timestamp - messages[index - 1].timestamp;
        if (timeDiff > 60000) { // More than 1 minute
          const timeStr = formatTimestamp(msg.timestamp);
          html += `<div class="landings-timestamp">${timeStr}</div>`;
        }
      }
      html += `<div class="landings-message ${msg.role}">${escapeHtml(msg.content)}</div>`;
    });

    if (isLoading) {
      html += `<div class="landings-typing"><span></span><span></span><span></span></div>`;
    }

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;

    // Save conversation after rendering
    saveConversation();
  }

  // Format timestamp for display
  function formatTimestamp(ts) {
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Send message to API
  async function sendMessage(userMessage) {
    if (!userMessage.trim() || isLoading) return;

    messages.push({ role: 'user', content: userMessage, timestamp: Date.now() });
    isLoading = true;
    renderMessages();

    // Hide quick actions after first message
    document.getElementById('landings-quick-actions').style.display = 'none';

    // Track message sent event
    trackEvent('message_sent', { conversationId });

    try {
      const response = await fetch(`${CONFIG.apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationId: conversationId,
          history: messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();

      messages.push({ role: 'bot', content: data.message, timestamp: Date.now() });

      // Check if we should show lead form
      if (data.showLeadForm) {
        document.getElementById('landings-lead-form').style.display = 'block';
        document.getElementById('landings-input-container').style.display = 'none';
      }

    } catch (error) {
      console.error('Chat error:', error);
      messages.push({
        role: 'bot',
        content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment, or call us directly for assistance.",
        timestamp: Date.now()
      });
    } finally {
      isLoading = false;
      renderMessages();
    }
  }

  // Track analytics event
  function trackEvent(eventType, metadata = {}) {
    try {
      fetch(`${CONFIG.apiBase}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          session_id: sessionId,
          metadata: metadata
        })
      }).catch(() => {}); // Fire and forget
    } catch (e) {
      // Silently ignore analytics errors
    }
  }

  // Fetch and display urgency messaging
  async function fetchUrgencyStats() {
    try {
      const response = await fetch(`${CONFIG.apiBase}/api/stats`);
      if (!response.ok) return;

      const data = await response.json();
      if (!data.success || !data.stats) return;

      urgencyStats = data.stats;
      updateUrgencyBanner();
    } catch (e) {
      // Silently fail - urgency is optional
    }
  }

  // Update urgency banner with current stats
  function updateUrgencyBanner() {
    const banner = document.getElementById('landings-urgency');
    const textEl = document.getElementById('landings-urgency-text');
    if (!banner || !textEl || !urgencyStats) return;

    const spotsRemaining = Math.max(0, TOTAL_CAPACITY - (urgencyStats.total || 0));
    const thisWeek = urgencyStats.thisWeek || 0;
    const lastRegistration = urgencyStats.lastRegistration;

    // Choose which urgency message to display (rotate through them)
    const messages = [];

    if (spotsRemaining <= 10 && spotsRemaining > 0) {
      messages.push(`<strong>Only ${spotsRemaining} spots remaining!</strong> Secure yours today.`);
    } else if (spotsRemaining <= 20) {
      messages.push(`<strong>${spotsRemaining} spots left</strong> - filling fast!`);
    }

    if (thisWeek > 0) {
      messages.push(`<strong>${thisWeek} people</strong> registered this week`);
    }

    if (lastRegistration && lastRegistration !== 'recently') {
      messages.push(`Last spot claimed <strong>${lastRegistration}</strong>`);
    }

    if (messages.length === 0) return;

    // Display a random urgency message
    const message = messages[Math.floor(Math.random() * messages.length)];
    textEl.innerHTML = message;
    banner.style.display = 'flex';

    // Rotate messages every 8 seconds if there are multiple
    if (messages.length > 1) {
      let index = 0;
      setInterval(() => {
        index = (index + 1) % messages.length;
        textEl.innerHTML = messages[index];
      }, 8000);
    }
  }

  // Email validation regex - stricter pattern
  const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  // Disposable email domains to block
  const DISPOSABLE_DOMAINS = [
    'mailinator.com', 'tempmail.com', 'throwaway.email', 'guerrillamail.com',
    'guerrillamail.net', 'sharklasers.com', 'grr.la', 'guerrillamail.org',
    'tempail.com', 'fakeinbox.com', 'maildrop.cc', '10minutemail.com',
    '10minutemail.net', 'temp-mail.org', 'yopmail.com', 'mailnesia.com',
    'trashmail.com', 'getnada.com', 'dispostable.com', 'tmpmail.org',
    'tmpmail.net', 'mohmal.com', 'tempinbox.com', 'fakemailgenerator.com',
    'emailondeck.com', 'getairmail.com', 'mailcatch.com', 'throwawaymail.com',
    'mytemp.email', 'temp-mail.io', 'burnermail.io', 'mailnator.com',
    'mintemail.com', 'spamgourmet.com', 'tempmailaddress.com'
  ];

  // Check if email is from a disposable domain
  function isDisposableEmail(email) {
    const domain = email.toLowerCase().split('@')[1];
    return domain && DISPOSABLE_DOMAINS.includes(domain);
  }

  // Validate form field
  function validateField(input, isValid) {
    const wrapper = input.parentElement;
    let indicator = wrapper.querySelector('.landings-field-indicator');

    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'landings-field-indicator';
      wrapper.style.position = 'relative';
      wrapper.appendChild(indicator);
    }

    if (input.value.trim() === '') {
      indicator.innerHTML = '';
      indicator.className = 'landings-field-indicator';
      input.classList.remove('valid', 'invalid');
    } else if (isValid) {
      indicator.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>';
      indicator.className = 'landings-field-indicator valid';
      input.classList.add('valid');
      input.classList.remove('invalid');
    } else {
      indicator.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>';
      indicator.className = 'landings-field-indicator invalid';
      input.classList.add('invalid');
      input.classList.remove('valid');
    }
  }

  // Show inline error message
  function showFormError(message) {
    let errorDiv = document.getElementById('landings-form-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.id = 'landings-form-error';
      errorDiv.className = 'landings-form-error';
      const form = document.getElementById('landings-lead-form');
      form.insertBefore(errorDiv, form.querySelector('button'));
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }

  // Hide form error
  function hideFormError() {
    const errorDiv = document.getElementById('landings-form-error');
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
  }

  // Check if form is valid
  function isFormValid() {
    const name = document.getElementById('landings-lead-name').value.trim();
    const email = document.getElementById('landings-lead-email').value.trim();
    const block = document.getElementById('landings-lead-block').value;

    return name.length >= 2 && EMAIL_REGEX.test(email) && !isDisposableEmail(email) && block !== '';
  }

  // Update submit button state
  function updateSubmitButton() {
    const submitBtn = document.getElementById('landings-lead-submit');
    if (submitBtn) {
      submitBtn.disabled = !isFormValid();
    }
  }

  // Submit lead
  async function submitLead() {
    hideFormError();

    const name = document.getElementById('landings-lead-name').value.trim();
    const email = document.getElementById('landings-lead-email').value.trim();
    const block = document.getElementById('landings-lead-block').value;
    const consent = document.getElementById('landings-consent');

    // Validate name
    if (name.length < 2) {
      showFormError('Please enter your full name');
      return;
    }

    // Validate email
    if (!EMAIL_REGEX.test(email)) {
      showFormError('Please enter a valid email address');
      return;
    }

    // Block disposable email domains
    if (isDisposableEmail(email)) {
      showFormError('Please use a permanent email address');
      return;
    }

    // Validate block selection
    if (!block) {
      showFormError('Please select your preferred program');
      return;
    }

    // Check consent if present
    if (consent && !consent.checked) {
      showFormError('Please agree to the privacy policy to continue');
      return;
    }

    const submitBtn = document.getElementById('landings-lead-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    // Track form submission attempt
    trackEvent('lead_submitted', { conversationId, block });

    try {
      const response = await fetch(`${CONFIG.apiBase}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          block,
          conversationId,
          messages: messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
          consent: consent ? consent.checked : true
        })
      });

      const data = await response.json();

      // Hide form
      document.getElementById('landings-lead-form').style.display = 'none';
      document.getElementById('landings-input-container').style.display = 'flex';

      if (response.status === 409 && data.error === 'duplicate_email') {
        // Duplicate email - show friendly message
        messages.push({
          role: 'bot',
          content: data.message || `It looks like ${email} is already registered. Chris will be in touch soon!`,
          timestamp: Date.now()
        });
      } else if (!response.ok) {
        throw new Error('Failed to submit');
      } else {
        // Success - clear stored conversation
        clearConversation();

        messages.push({
          role: 'bot',
          content: `Thank you, ${name}! Your registration interest has been received. Chris Barber will be in touch with you shortly at ${email} to confirm your spot and provide payment details. We're excited to have you join us this winter!`,
          timestamp: Date.now()
        });
      }
      renderMessages();

    } catch (error) {
      console.error('Lead submission error:', error);
      showFormError('There was an error submitting your registration. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Registration';
    }
  }

  // Toggle chat window
  function toggleChat() {
    isOpen = !isOpen;
    const chatWindow = document.querySelector('.landings-chat-window');
    const chatButton = document.querySelector('.landings-chat-button');

    if (isOpen) {
      chatWindow.classList.add('open');
      chatButton.classList.add('open');
      chatButton.innerHTML = icons.close;

      // Track widget open event
      trackEvent('widget_open', { returning: isReturningUser });

      // Fetch and display urgency messaging
      fetchUrgencyStats();

      // Initialize conversation if needed
      if (messages.length === 0) {
        // Try to restore from localStorage
        const savedConvo = loadConversation();

        if (savedConvo && savedConvo.messages && savedConvo.messages.length > 0) {
          // Restore conversation
          messages = savedConvo.messages;
          conversationId = savedConvo.conversationId;
          isReturningUser = true;

          // Add welcome back message
          messages.push({
            role: 'bot',
            content: "Welcome back! I remember we were chatting earlier. How can I help you today?",
            timestamp: Date.now()
          });

          // Hide quick actions since we have history
          document.getElementById('landings-quick-actions').style.display = 'none';
        } else {
          // New conversation
          conversationId = generateId();
          messages.push({
            role: 'bot',
            content: "Hey there! Welcome to The Landings Golf Course. Our 2026 Indoor Winter Program is filling up fast - spots are limited! I can tell you about the schedule, pricing, instructors, or help you register your interest. What would you like to know?",
            timestamp: Date.now()
          });
        }
        renderMessages();
      }

      // Focus input
      setTimeout(() => {
        document.getElementById('landings-input').focus();
      }, 300);
    } else {
      chatWindow.classList.remove('open');
      chatButton.classList.remove('open');
      chatButton.innerHTML = icons.chat;
    }
  }

  // Create minimal button for initial load
  function createMinimalButton() {
    const container = document.createElement('div');
    container.className = 'landings-widget-container';
    container.innerHTML = `
      <button class="landings-chat-button" aria-label="Open chat assistant">
        ${icons.chat}
      </button>
    `;
    document.body.appendChild(container);
    return container;
  }

  // Initialize full widget (called on first button click)
  function initializeFullWidget(container) {
    if (widgetInitialized) return;

    // Show loading state
    const button = container.querySelector('.landings-chat-button');
    button.classList.add('loading');

    // Inject full styles
    injectStyles();

    // Replace minimal container with full widget
    const fullWidget = createWidget();
    container.innerHTML = fullWidget.innerHTML;

    // Re-attach to body (already done by createWidget, so remove duplicate)
    fullWidget.remove();

    // Mark as initialized
    widgetInitialized = true;
    button.classList.remove('loading');

    // Setup all event listeners
    setupEventListeners(container);
  }

  // Setup event listeners for full widget
  function setupEventListeners(container) {
    container.querySelector('.landings-chat-button').addEventListener('click', toggleChat);
    container.querySelector('.landings-chat-header-close').addEventListener('click', toggleChat);

    container.querySelector('#landings-send').addEventListener('click', () => {
      const input = document.getElementById('landings-input');
      sendMessage(input.value);
      input.value = '';
    });

    container.querySelector('#landings-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage(e.target.value);
        e.target.value = '';
      }
    });

    container.querySelectorAll('.landings-quick-action').forEach(btn => {
      btn.addEventListener('click', () => {
        sendMessage(btn.dataset.message);
      });
    });

    container.querySelector('#landings-lead-submit').addEventListener('click', submitLead);

    // Form validation listeners
    const nameInput = container.querySelector('#landings-lead-name');
    const emailInput = container.querySelector('#landings-lead-email');
    const blockSelect = container.querySelector('#landings-lead-block');

    if (nameInput) {
      nameInput.addEventListener('input', () => {
        validateField(nameInput, nameInput.value.trim().length >= 2);
        updateSubmitButton();
      });
    }

    if (emailInput) {
      emailInput.addEventListener('input', () => {
        const emailVal = emailInput.value.trim();
        const isValidEmail = EMAIL_REGEX.test(emailVal) && !isDisposableEmail(emailVal);
        validateField(emailInput, isValidEmail);
        updateSubmitButton();
      });
    }

    if (blockSelect) {
      blockSelect.addEventListener('change', updateSubmitButton);
    }

    // Track form abandonment on page unload
    window.addEventListener('beforeunload', () => {
      const nameVal = nameInput?.value?.trim();
      const emailVal = emailInput?.value?.trim();
      if ((nameVal || emailVal) && document.getElementById('landings-lead-form')?.style.display !== 'none') {
        trackEvent('form_abandoned', { hasName: !!nameVal, hasEmail: !!emailVal });
      }
    });

    // Mobile keyboard handling
    setupMobileKeyboardHandling();
  }

  // Initialize (lightweight, only loads button)
  function init() {
    // Initialize session ID
    sessionId = getOrCreateSessionId();

    // Only inject minimal styles and button initially
    injectMinimalStyles();
    const container = createMinimalButton();

    // On first click, initialize full widget then toggle
    container.querySelector('.landings-chat-button').addEventListener('click', function initialClick() {
      // Remove this listener after first use
      this.removeEventListener('click', initialClick);

      // Initialize full widget
      initializeFullWidget(container);

      // Now toggle chat open
      toggleChat();
    });

    // Exit intent detection (desktop only, delayed)
    setTimeout(setupExitIntent, 3000);
  }

  // Mobile keyboard handling
  function setupMobileKeyboardHandling() {
    if (!window.visualViewport) return;

    const chatWindow = document.querySelector('.landings-chat-window');
    if (!chatWindow) return;

    let initialHeight = window.innerHeight;

    window.visualViewport.addEventListener('resize', () => {
      if (!isOpen) return;

      const currentHeight = window.visualViewport.height;
      const keyboardHeight = initialHeight - currentHeight;

      if (keyboardHeight > 100) {
        // Keyboard is open
        chatWindow.style.height = `${currentHeight - 20}px`;
        chatWindow.style.bottom = '0';

        // Scroll to latest message
        setTimeout(() => {
          const messagesContainer = document.getElementById('landings-messages');
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }, 100);
      } else {
        // Keyboard is closed
        chatWindow.style.height = '';
        chatWindow.style.bottom = '';
      }
    });

    // Reset on orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        initialHeight = window.innerHeight;
      }, 300);
    });
  }

  // Exit intent detection
  function setupExitIntent() {
    // Only on desktop
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

    let exitIntentShown = false;

    try {
      exitIntentShown = sessionStorage.getItem(STORAGE_KEYS.exitIntentShown) === 'true';
    } catch (e) {}

    if (exitIntentShown) return;

    document.addEventListener('mouseout', (e) => {
      // Check if mouse left the viewport from the top
      if (e.clientY <= 0 && !exitIntentShown && !isOpen) {
        showExitIntent();
        exitIntentShown = true;
        try {
          sessionStorage.setItem(STORAGE_KEYS.exitIntentShown, 'true');
        } catch (e) {}
      }
    });
  }

  // Show exit intent modal
  function showExitIntent() {
    const existingModal = document.getElementById('landings-exit-modal');
    if (existingModal) return;

    const modal = document.createElement('div');
    modal.id = 'landings-exit-modal';
    modal.className = 'landings-exit-modal';
    modal.innerHTML = `
      <div class="landings-exit-content">
        <button class="landings-exit-close" onclick="this.closest('.landings-exit-modal').remove()">
          ${icons.close}
        </button>
        <div class="landings-exit-icon">${icons.golf}</div>
        <h3>Wait! Don't Miss Out</h3>
        <p>Our Winter Program is filling up fast. Chat with us to secure your spot!</p>
        <button class="landings-exit-cta" onclick="this.closest('.landings-exit-modal').remove(); document.querySelector('.landings-chat-button').click();">
          Start a Conversation
        </button>
        <button class="landings-exit-dismiss" onclick="this.closest('.landings-exit-modal').remove()">
          No thanks
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    // Track exit intent shown
    trackEvent('exit_intent_shown');

    // Animate in
    requestAnimationFrame(() => {
      modal.classList.add('open');
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
