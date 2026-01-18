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
    grayDark: '#374151'
  };

  // State
  let isOpen = false;
  let messages = [];
  let isLoading = false;
  let conversationId = null;

  // Create and inject styles
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .landings-widget-container * {
        box-sizing: border-box;
        font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        -webkit-font-smoothing: antialiased;
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
    `;
    document.head.appendChild(style);
  }

  // Icons
  const icons = {
    chat: `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h10v2H7zm0-3h10v2H7z"/></svg>`,
    close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
    send: `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`,
    golf: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`
  };

  // Generate conversation ID
  function generateId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Create the widget
  function createWidget() {
    const container = document.createElement('div');
    container.className = 'landings-widget-container';
    container.innerHTML = `
      <button class="landings-chat-button" aria-label="Open chat">
        ${icons.chat}
      </button>
      <div class="landings-chat-window">
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
        <div class="landings-chat-messages" id="landings-messages"></div>
        <div class="landings-quick-actions" id="landings-quick-actions">
          <button class="landings-quick-action" data-message="What are the program dates?">Program Dates</button>
          <button class="landings-quick-action" data-message="Who are the instructors?">Instructors</button>
          <button class="landings-quick-action" data-message="How do I sign up?">Sign Up</button>
        </div>
        <div class="landings-lead-form" id="landings-lead-form" style="display: none;">
          <h4>Register Your Interest</h4>
          <input type="text" id="landings-lead-name" placeholder="Your name" required>
          <input type="email" id="landings-lead-email" placeholder="Email address" required>
          <select id="landings-lead-block">
            <option value="">Select a block...</option>
            <option value="block1">Block 1: Jan 12 - Feb 15, 2026</option>
            <option value="block2">Block 2: Feb 16 - Mar 22, 2026</option>
            <option value="both">Both Blocks</option>
            <option value="undecided">Not Sure Yet</option>
          </select>
          <button type="button" id="landings-lead-submit">Submit Registration</button>
        </div>
        <div class="landings-chat-input-container" id="landings-input-container">
          <input type="text" class="landings-chat-input" id="landings-input" placeholder="Type your message...">
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

    messages.forEach(msg => {
      html += `<div class="landings-message ${msg.role}">${escapeHtml(msg.content)}</div>`;
    });

    if (isLoading) {
      html += `<div class="landings-typing"><span></span><span></span><span></span></div>`;
    }

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
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

    messages.push({ role: 'user', content: userMessage });
    isLoading = true;
    renderMessages();

    // Hide quick actions after first message
    document.getElementById('landings-quick-actions').style.display = 'none';

    try {
      const response = await fetch(`${CONFIG.apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationId: conversationId,
          history: messages.slice(0, -1)
        })
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();

      messages.push({ role: 'bot', content: data.message });

      // Check if we should show lead form
      if (data.showLeadForm) {
        document.getElementById('landings-lead-form').style.display = 'block';
        document.getElementById('landings-input-container').style.display = 'none';
      }

    } catch (error) {
      console.error('Chat error:', error);
      messages.push({
        role: 'bot',
        content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment, or call us directly for assistance."
      });
    } finally {
      isLoading = false;
      renderMessages();
    }
  }

  // Submit lead
  async function submitLead() {
    const name = document.getElementById('landings-lead-name').value.trim();
    const email = document.getElementById('landings-lead-email').value.trim();
    const block = document.getElementById('landings-lead-block').value;

    if (!name || !email || !block) {
      alert('Please fill in all fields');
      return;
    }

    const submitBtn = document.getElementById('landings-lead-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      const response = await fetch(`${CONFIG.apiBase}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          block,
          conversationId,
          messages: messages
        })
      });

      if (!response.ok) throw new Error('Failed to submit');

      // Hide form and show thank you message
      document.getElementById('landings-lead-form').style.display = 'none';
      document.getElementById('landings-input-container').style.display = 'flex';

      messages.push({
        role: 'bot',
        content: `Thank you, ${name}! Your registration interest has been received. Chris Barber will be in touch with you shortly at ${email} to confirm your spot and provide payment details. We're excited to have you join us this winter!`
      });
      renderMessages();

    } catch (error) {
      console.error('Lead submission error:', error);
      alert('There was an error submitting your registration. Please try again.');
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

      // Initialize conversation if needed
      if (messages.length === 0) {
        conversationId = generateId();
        messages.push({
          role: 'bot',
          content: "Welcome to The Landings Golf Course! I'm here to help you learn about our 2026 Indoor Winter Instructional Program. What would you like to know?"
        });
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

  // Initialize
  function init() {
    injectStyles();
    const container = createWidget();

    // Event listeners
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
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
