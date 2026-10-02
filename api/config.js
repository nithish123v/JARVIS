export default function handler(_req, res) {
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    deviceId: process.env.JARVIS_DEVICE_ID || 'home-pc',
    cloudConfigured: Boolean(process.env.OPENROUTER_API_KEY),
  });
}
