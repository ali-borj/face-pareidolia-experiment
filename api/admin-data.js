import { list } from '@vercel/blob';

export default async function handler(req, res) {
  const key = req.query.key;
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    return res.status(500).json({ error: 'ADMIN_KEY env var not set on Vercel.' });
  }
  if (!key || key !== adminKey) {
    return res.status(401).json({ error: 'Invalid admin key.' });
  }

  try {
    // Fetch all blobs (up to 1000)
    const { blobs } = await list({ limit: 1000 });

    // Skip test files
    const real = blobs.filter(b => !b.pathname.startsWith('TEST_'));

    // Group JSON + CSV pairs by their shared prefix (pid_savetimestamp)
    const groups = {};
    real.forEach(b => {
      const base = b.pathname.replace(/\.(json|csv)$/, '');
      if (!groups[base]) groups[base] = {};
      const ext = b.pathname.endsWith('.json') ? 'json' : 'csv';
      groups[base][ext] = { url: b.url, size: b.size, uploadedAt: b.uploadedAt };
    });

    // Build sorted session list (newest first)
    const sessions = Object.entries(groups).map(([base, files]) => {
      // base = "P_<ts>_<suffix>_<save_ts>"  — participant ID is everything before last segment
      const lastUnderscore = base.lastIndexOf('_');
      const pid = base.substring(0, lastUnderscore);
      return {
        pid,
        uploadedAt: (files.json || files.csv).uploadedAt,
        json: files.json || null,
        csv:  files.csv  || null,
      };
    }).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return res.status(200).json({ sessions });
  } catch (err) {
    console.error('admin-data error:', err);
    return res.status(500).json({ error: err.message });
  }
}
