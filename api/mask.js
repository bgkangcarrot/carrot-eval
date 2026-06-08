export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // body 파싱 시도
    let body = req.body;
    if (!body) return res.status(400).json({ error: 'no body' });
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: 'json parse failed: ' + e.message }); }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

    // feedback 모드
    if (body._mode === 'feedback') {
      const { agentName, satAvg, satScore, evalCnt, distSummary, opinions, periodNote } = body;
      const prompt = `당신은 고객센터 품질 평가 전문가입니다. 상담원 ${agentName}에 대한 종합 피드백을 300자 이내로 작성하세요.\n평가건수: ${evalCnt}건, 만족도평균: ${satAvg}점, 만족도점수: ${satScore}점\n평점분포: ${distSummary}\n${periodNote||''}\n\n고객의견:\n${opinions}\n\n상담 태도, 전문성, 친절도, 문제해결력 측면에서 구체적으로 작성하세요. 존댓말, 텍스트만 출력.`;

      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1024 } })
      });
      if (!r.ok) { const e = await r.text(); return res.status(r.status).json({ error: e }); }
      const d = await r.json();
      const feedback = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      return res.status(200).json({ feedback });
    }

    // masking 모드
    const { texts } = body;
    if (!texts || !Array.isArray(texts)) return res.status(400).json({ error: 'texts required' });
    return res.status(200).json({ results: texts }); // 정규식 마스킹은 프론트에서 처리

  } catch(err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.slice(0,300) });
  }
}
