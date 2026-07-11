// fileflexer/api/send-otp.js
// Uses Brevo (formerly Sendinblue) REST API — free tier: 300 emails/day, no domain required.
// Requires env vars: BREVO_API_KEY, BREVO_SENDER_EMAIL (must be a verified sender in Brevo dashboard)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { to, code, subject, purpose } = req.body || {};

  if (!to || !code) {
    return res.status(400).json({ message: 'Missing "to" or "code".' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  if (!apiKey || !senderEmail) {
    console.error('[send-otp] Missing BREVO_API_KEY or BREVO_SENDER_EMAIL env vars');
    return res.status(500).json({ message: 'Email service not configured.' });
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: 'FileFlexer', email: senderEmail },
        to: [{ email: to }],
        subject: subject || 'Your FileFlexer verification code',
        htmlContent: `
          <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
            <h2 style="margin:0 0 12px;">FileFlexer</h2>
            <p style="color:#555;">Your ${purpose === 'reset' ? 'password reset' : 'verification'} code is:</p>
            <p style="font-size:32px;font-weight:700;letter-spacing:6px;text-align:center;background:#f5f5f5;padding:14px;border-radius:8px;">${code}</p>
            <p style="color:#888;font-size:13px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[send-otp] Brevo error:', response.status, errBody);
      return res.status(502).json({ message: 'Failed to send email.' });
    }

    return res.status(200).json({ message: 'sent' });
  } catch (err) {
    console.error('[send-otp] Brevo request failed:', err.message);
    return res.status(502).json({ message: 'Failed to send email.' });
  }
}