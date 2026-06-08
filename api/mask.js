export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // body가 string으로 들어오는 경우 파싱
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!body) return res.status(400).json({ error: 'Empty body' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  if (body._mode === 'feedback') {
    return handleFeedback(body, res, apiKey);
  }
  return handleMasking(body, res, apiKey);
}

async function handleMasking(body, res, apiKey) {
  const { texts } = body;
  if (!texts || !Array.isArray(texts) || texts.length === 0)
    return res.status(400).json({ error: 'texts array required' });

  const numbered = texts.map((t, i) => `[${i + 1}] ${t}`).join('\n');
  const prompt = `당신은 개인정보 마스킹 전문가입니다.
입력된 텍스트 목록에서 개인정보를 찾아 마스킹하고, 반드시 JSON 형식으로만 응답하세요.

마스킹 대상: 이름(한국인 실명), 전화번호, 차량번호, 이메일, 주민등록번호, 계좌번호, 주소.

규칙:
- 이름: 성 유지, 나머지 ○로 대체 (예: 홍○○)
- 전화번호: 010-****-5678 형식
- 차량번호: 12가 **** 형식
- 이메일: ab***@naver.com 형식
- 기타: [개인정보] 로 대체
- 개인정보 없으면 원문 그대로 반환

응답 형식(JSON only):
{"results":["마스킹된 텍스트1","마스킹된 텍스트2",...]}

다음 ${texts.length}개의 텍스트를 마스킹해주세요:
${numbered}`;

  try {
    const data = await callGemini(apiKey, prompt);
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    const cleaned = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/,'').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); } catch { return res.status(200).json({ results: texts }); }
    return res.status(200).json({ results: parsed.results || texts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleFeedback(body, res, apiKey) {
  const { agentName, satAvg, satScore, evalCnt, distSummary, opinions, periodNote } = body;

  const prompt = `당신은 고객센터 품질 평가 전문가입니다.
아래 상담원의 고객 만족도 데이터와 고객 의견을 분석하여, 상담원에게 전달할 종합 피드백을 작성하세요.

[상담원 정보]
- 이름: ${agentName}
- 평가건수: ${evalCnt}건
- 만족도 평균: ${satAvg?.toFixed ? satAvg.toFixed(1) : satAvg}점
- 만족도점수 (50점 환산): ${satScore?.toFixed ? satScore.toFixed(1) : satScore}점
- 평점 분포: ${distSummary}
- 기준: ${periodNote || '전체 기간'}

[고객 의견]
${opinions}

[작성 기준]
- 300자 이내로 작성
- 상담 태도, 전문성, 친절도, 문제 해결력 측면에서 구체적 피드백
- 긍정적 강점과 개선 필요 사항을 균형 있게 기술
- 데이터 기반의 객관적 어조 유지
- 존댓말 사용, 상담원에게 직접 전달하는 형식
- JSON 없이 피드백 텍스트만 출력`;

  try {
    const data = await callGemini(apiKey, prompt);
    const feedback = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return res.status(200).json({ feedback });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function callGemini(apiKey, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
      })
    }
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini ${response.status}: ${err}`);
  }
  return response.json();
}
