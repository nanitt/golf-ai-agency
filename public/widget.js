(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    apiBase: window.LANDINGS_API_BASE || '',
    primaryColor: '#1a472a', // Dark green (golf course green)
    secondaryColor: '#2d5a3d',
    accentColor: '#4a7c59'
  };

  // State
  let isOpen = false;
  let messages = [];
  let isLoading = false;
  let conversationId = null;
  let showLeadForm = false;
  let leadData = { name: '', email: '', block: '' };

  // Create and inject styles
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .landings-widget-container * {
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      }

      .landings-chat-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
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
        transition: transform 0.2s, box-shadow 0.2s;
        z-index: 9999;
      }

      .landings-chat-button:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(0,0,0,0.2);
      }

      .landings-chat-button svg {
        width: 28px;
        height: 28px;
        fill: white;
      }

      .landings-chat-window {
        position: fixed;
        bottom: 90px;
        right: 20px;
        width: 380px;
        height: 520px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 9998;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
        transition: opacity 0.3s, transform 0.3s;
      }

      .landings-chat-window.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .landings-chat-header {
        background: linear-gradient(135deg, ${CONFIG.primaryColor} 0%, ${CONFIG.secondaryColor} 100%);
        color: white;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .landings-chat-header-icon {
        width: 40px;
        height: 40px;
        background: rgba(255,255,255,0.2);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .landings-chat-header-icon svg {
        width: 24px;
        height: 24px;
        fill: white;
      }

      .landings-chat-header-text h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .landings-chat-header-text p {
        margin: 2px 0 0;
        font-size: 12px;
        opacity: 0.9;
      }

      .landings-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .landings-message {
        max-width: 85%;
        padding: 12px 16px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.5;
      }

      .landings-message.bot {
        background: #f0f4f1;
        color: #1a1a1a;
        align-self: flex-start;
        border-bottom-left-radius: 4px;
      }

      .landings-message.user {
        background: ${CONFIG.primaryColor};
        color: white;
        align-self: flex-end;
        border-bottom-right-radius: 4px;
      }

      .landings-typing {
        display: flex;
        gap: 4px;
        padding: 12px 16px;
        background: #f0f4f1;
        border-radius: 16px;
        align-self: flex-start;
        border-bottom-left-radius: 4px;
      }

      .landings-typing span {
        width: 8px;
        height: 8px;
        background: ${CONFIG.accentColor};
        border-radius: 50%;
        animation: landingsTyping 1.4s infinite;
      }

      .landings-typing span:nth-child(2) { animation-delay: 0.2s; }
      .landings-typing span:nth-child(3) { animation-delay: 0.4s; }

      @keyframes landingsTyping {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-4px); }
      }

      .landings-chat-input-container {
        padding: 12px 16px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        gap: 8px;
      }

      .landings-chat-input {
        flex: 1;
        padding: 10px 14px;
        border: 1px solid #e5e7eb;
        border-radius: 24px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
      }

      .landings-chat-input:focus {
        border-color: ${CONFIG.primaryColor};
      }

      .landings-chat-send {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: ${CONFIG.primaryColor};
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      .landings-chat-send:hover {
        background: ${CONFIG.secondaryColor};
      }

      .landings-chat-send:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      .landings-chat-send svg {
        width: 18px;
        height: 18px;
        fill: white;
      }

      .landings-lead-form {
        padding: 16px;
        background: #f8faf9;
        border-top: 1px solid #e5e7eb;
      }

      .landings-lead-form h4 {
        margin: 0 0 12px;
        font-size: 14px;
        color: ${CONFIG.primaryColor};
      }

      .landings-lead-form input,
      .landings-lead-form select {
        width: 100%;
        padding: 10px 12px;
        margin-bottom: 8px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        font-size: 14px;
        outline: none;
      }

      .landings-lead-form input:focus,
      .landings-lead-form select:focus {
        border-color: ${CONFIG.primaryColor};
      }

      .landings-lead-form button {
        width: 100%;
        padding: 12px;
        background: ${CONFIG.primaryColor};
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      }

      .landings-lead-form button:hover {
        background: ${CONFIG.secondaryColor};
      }

      .landings-lead-form button:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      .landings-quick-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 0 16px 12px;
      }

      .landings-quick-action {
        padding: 8px 14px;
        background: #f0f4f1;
        border: 1px solid #e5e7eb;
        border-radius: 20px;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
      }

      .landings-quick-action:hover {
        background: #e5ebe7;
        border-color: ${CONFIG.primaryColor};
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
          bottom: 16px;
          right: 16px;
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
    golf: `<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="3"/><path d="M12 8c-2.21 0-4 1.79-4 4v8h2v-4h4v4h2v-8c0-2.21-1.79-4-4-4z"/></svg>`
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
          <div class="landings-chat-header-icon">
            ${icons.golf}
          </div>
          <div class="landings-chat-header-text">
            <h3>The Landings Golf Course</h3>
            <p>Winter Instructional Program</p>
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
          <input type="text" id="landings-lead-name" placeholder="Your Name" required>
          <input type="email" id="landings-lead-email" placeholder="Email Address" required>
          <select id="landings-lead-block">
            <option value="">Select a Block...</option>
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
          history: messages.slice(0, -1) // Exclude the message we just added
        })
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();

      messages.push({ role: 'bot', content: data.message });

      // Check if we should show lead form
      if (data.showLeadForm) {
        showLeadForm = true;
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
      chatButton.innerHTML = icons.chat;
    }
  }

  // Initialize
  function init() {
    injectStyles();
    const container = createWidget();

    // Event listeners
    container.querySelector('.landings-chat-button').addEventListener('click', toggleChat);

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
