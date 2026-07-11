/* ============================================================
   FileFlexer — background configuration
   ------------------------------------------------------------
   This file is NOT shown to users anywhere on the site.
   Set your AI provider's API key and model here once, and
   every visitor's AI Chat will just work — no key box, no
   model dropdown on the page itself.

   Currently wired for the Google Gemini API
   (https://ai.google.dev — generateContent endpoint).
   If you switch providers later, also update the fetch call
   in tools/ai-chat.html to match that provider's request format.
   ============================================================ */
window.FF_CONFIG = {
  // ---------------------------------------------------------------------
  // Email OTP backend (used by "Create account" + "Forgot password").
  // FileFlexer is a static, client-only site, so it can't send email by
  // itself — it POSTs { to, code, subject, purpose } to this URL, and a
  // tiny serverless function you deploy (see /server/send-otp.js in this
  // project + the setup steps you were given) forwards it to Resend's
  // free email API (3,000 emails/month, no credit card).
  //
  // Leave this blank to run in DEMO MODE: OTP codes are shown directly
  // in a toast/console instead of emailed, so you can test the whole
  // signup/reset flow before setting up real email delivery.
  //
  // Once deployed, paste your function's URL here, e.g.:
  // OTP_API_URL: 'https://your-project.vercel.app/api/send-otp',
  OTP_API_URL: '/api/send-otp'
};
