export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = req.body;
    if (!body) return res.status(400).json({ error: 'no body' });
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: 'json parse failed' }); }
    }

    // feedback 모드 → Anthropic API
    if (body._mode === 'feedback') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

      const { agentName, satAvg, satScore, evalCnt, distSummary, opinions, periodNote } = body;
      const prompt = `당신은 고객센터 품질 평가 전문가입니다. 상담원 ${agentName}에 대한 종합 피드백을 300자 이내로 작성하세요.
평가건수: ${evalCnt}건, 만족도평균: ${satAvg}점, 만족도점수: ${satScore}점
평점분포: ${distSummary}
${periodNote || ''}

고객의견:
${opinions}

상담 태도, 전문성, 친절도, 문제해결력 측면에서 구체적으로 작성하세요. 존댓말 사용, 텍스트만 출력.`;

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!r.ok) { const e = await r.text(); return res.status(r.status).json({ error: e }); }
      const d = await r.json();
      const feedback = d.content?.[0]?.text?.trim() || '';
      return res.status(200).json({ feedback });
    }

    // masking 모드 → 프론트 정규식으로 처리하므로 그대로 반환
    const { texts } = body;
    if (!texts || !Array.isArray(texts)) return res.status(400).json({ error: 'texts required' });
    return res.status(200).json({ results: texts });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
