export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, name, period, html } = req.body;
  if (!to || !name || !html) return res.status(400).json({ error: 'to, name, html required' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Digital Consultation AI <onboarding@resend.dev>',
        to: [to],
        subject: `[디지털상담 AI 품질평가툴] ${name} 개인별 리포트 ${period ? '— ' + period : ''}`,
        html: `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: 'Malgun Gothic', sans-serif; background:#F7F1E9; margin:0; padding:20px; color:#1A1A1A; }
  .wrap { max-width:680px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; border:1px solid #E1D4C9; }
  .header { background:#E1D4C9; padding:20px 28px; border-bottom:3px solid #E1D4C9; }
  .header h1 { font-size:18px; font-weight:800; margin:0; color:#1A1A1A; }
  .header p  { font-size:13px; color:#555; margin:4px 0 0; }
  .body { padding:24px 28px; }
  .badge-row { display:flex; gap:8px; margin-bottom:20px; flex-wrap:wrap; }
  .badge { background:#F89B6C; color:#fff; padding:5px 14px; border-radius:20px; font-size:13px; font-weight:700; }
  .badge.sub { background:#FBB584; }
  .metrics { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:20px; }
  .metric { background:#F7F1E9; border-radius:10px; padding:12px; text-align:center; border:1px solid #E1D4C9; }
  .metric .val { font-size:20px; font-weight:800; color:#1A1A1A; }
  .metric .lbl { font-size:11px; color:#999; margin-top:2px; }
  .section-title { font-size:14px; font-weight:700; color:#1A1A1A; margin:18px 0 10px; border-bottom:1px solid #E1D4C9; padding-bottom:6px; }
  .dist-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
  .dist-bar-wrap { flex:1; background:#E1D4C9; border-radius:3px; height:10px; overflow:hidden; }
  .dist-bar { height:100%; border-radius:3px; }
  .feedback-box { background:#F7F1E9; border-radius:10px; border-left:3px solid #F89B6C; padding:14px 16px; font-size:13px; line-height:1.7; color:#333; }
  .footer { background:#F7F1E9; padding:14px 28px; text-align:center; font-size:11px; color:#999; border-top:1px solid #E1D4C9; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>디지털상담 AI 품질평가툴</h1>
    <p>한화손해보험 캐롯 · 개인별 리포트${period ? ' — ' + period : ''}</p>
  </div>
  <div class="body">
    ${html}
  </div>
  <div class="footer">본 리포트는 디지털상담 AI 품질평가툴에서 자동 발송되었습니다.</div>
</div>
</body>
</html>`
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }
    const data = await response.json();
    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
