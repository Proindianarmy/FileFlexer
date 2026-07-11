// fileflexer/api/send-otp.js
// Vercel serverless function — sends the OTP email via Resend.
// Runs on Vercel, same domain as the static site, so the frontend can call
// it with a relative path and never hits CORS.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { to, code, subject, purpose } = req.body || {};

  if (!to || !code) {
    return res.status(400).json({ message: 'Missing "to" or "code".' });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL, // e.g. "FileFlexer <noreply@yourdomain.com>"
        to,
        subject: subject || 'Your FileFlexer verification code',
        html: `
          <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
            <h2 style="margin:0 0 12px;">FileFlexer</h2>
            <p style="color:#555;">Your ${purpose === 'reset' ? 'password reset' : 'verification'} code is:</p>
            <p style="font-size:32px;font-weight:700;letter-spacing:6px;text-align:center;background:#f5f5f5;padding:14px;border-radius:8px;">${code}</p>
            <p style="color:#888;font-size:13px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('[send-otp] Resend error:', r.status, errText);
      return res.status(502).json({ message: 'Failed to send email.' });
    }

    return res.status(200).json({ message: 'sent' });
  } catch (err) {
    console.error('[send-otp] Error:', err.message);
    return res.status(500).json({ message: 'Server error sending email.' });
  }
}