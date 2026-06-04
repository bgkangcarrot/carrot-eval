export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { texts } = req.body;
  if (!texts || !Array.isArray(texts) || texts.length === 0)
    return res.status(400).json({ error: 'texts array required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const numbered = texts.map((t, i) => `[${i + 1}] ${t}`).join('\n');

  const prompt = `당신은 개인정보 마스킹 전문가입니다.
입력된 텍스트 목록에서 개인정보를 찾아 마스킹하고, 반드시 JSON 형식으로만 응답하세요.

마스킹 대상: 이름(한국인 실명), 전화번호, 차량번호, 이메일, 주민등록번호, 계좌번호, 주소(도로명·지번 포함).

규칙:
- 이름: 성 유지, 나머지 ○로 대체 (예: 홍○○)
- 전화번호: 010-****-5678 형식 (뒷 4자리 유지)
- 차량번호: 12가 **** 형식
- 이메일: ab***@naver.com 형식
- 기타 개인정보: [개인정보] 로 대체
- 개인정보 없으면 원문 그대로 반환
- 문맥상 의미는 보존

응답 형식(JSON only, 다른 텍스트 절대 금지):
{"results":["마스킹된 텍스트1","마스킹된 텍스트2",...]}

다음 ${texts.length}개의 텍스트를 마스킹해주세요:

${numbered}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 4096 }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // ```json ... ``` 펜스 제거
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch { return res.status(200).json({ results: texts }); }

    return res.status(200).json({ results: parsed.results || texts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
