// Slack webhook notifications for new leads

const BLOCK_LABELS = {
  block1: 'Block 1 (Jan 12 - Feb 15)',
  block2: 'Block 2 (Feb 16 - Mar 22)',
  both: 'Both Blocks',
  full: 'Full 10-Week Program',
  undecided: 'Undecided'
};

/**
 * Send a Slack notification for a new lead
 * @param {Object} lead - Lead data
 * @param {string} lead.name - Lead name
 * @param {string} lead.email - Lead email
 * @param {string} lead.block_preference - Block preference
 * @param {number} lead.score - Lead score
 * @returns {Promise<boolean>} - Returns true if notification was sent successfully
 */
export async function sendSlackNotification(lead) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    // Slack not configured, skip silently
    return false;
  }

  try {
    const scoreEmoji = lead.score > 30 ? ':fire:' : lead.score > 15 ? ':star:' : ':wave:';
    const blockLabel = BLOCK_LABELS[lead.block_preference] || lead.block_preference;

    const message = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${scoreEmoji} New Lead: ${lead.name}`,
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Email:*\n${lead.email}`
            },
            {
              type: 'mrkdwn',
              text: `*Program:*\n${blockLabel}`
            },
            {
              type: 'mrkdwn',
              text: `*Lead Score:*\n${lead.score || 0}`
            },
            {
              type: 'mrkdwn',
              text: `*Source:*\n${lead.source || 'chatbot'}`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `:clock1: ${new Date().toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Toronto'
              })}`
            }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View in Dashboard',
                emoji: true
              },
              url: 'https://golf-ai-agency.vercel.app/admin.html',
              action_id: 'view_dashboard'
            }
          ]
        }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    return response.ok;
  } catch (error) {
    console.error('Slack notification error:', error);
    return false;
  }
}

export default { sendSlackNotification };
