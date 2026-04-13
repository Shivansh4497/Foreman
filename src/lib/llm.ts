export async function callLLM(opts: {
  provider: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
  userTurn: string;
  expectJson?: boolean;
}): Promise<string> {
  const { provider, model, apiKey, systemPrompt, userTurn, expectJson } = opts;

  // Map presentation names from user_llm_config to actual API model identifiers.
  const modelMapping: Record<string, string> = {
    'GPT-4o (Recommended)': 'gpt-4o',
    'GPT-4o mini': 'gpt-4o-mini',
    'Claude 3.5 Sonnet': 'claude-3-5-sonnet-20240620',
    'Claude 3 Haiku': 'claude-3-haiku-20240307',
    'Gemini 1.5 Pro': 'gemini-1.5-pro-latest',
    'Gemini 1.5 Flash': 'gemini-1.5-flash-latest',
    'Llama 3.3 70B (Recommended)': 'llama-3.3-70b-versatile',
    'Llama 3.1 8B': 'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile': 'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant': 'llama-3.1-8b-instant',
    'llama 3.1 8b': 'llama-3.1-8b-instant', // Fallback for case-mismatch seen in logs
    'Llama 3': 'llama-3.3-70b-versatile', 
    'Mixtral 8x7b': 'llama-3.1-8b-instant',
  };
  const apiModel = modelMapping[model] || model;

  // Normalise provider names to expected API endpoint patterns.
  const providerLower = provider.toLowerCase();
  const isAnthropic = providerLower === 'anthropic';
  const isOpenAI = !isAnthropic; // treat anything non-anthropic as OpenAI-compatible

  if (isOpenAI) {
    let endpoint = 'https://api.openai.com/v1/chat/completions';
    if (providerLower === 'groq') {
      endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    } else if (providerLower === 'gemini') {
      endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: apiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userTurn },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM API error (provider=${providerLower}) ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content ?? '';

    if (expectJson) {
      const firstBrace = text.indexOf('{');
      const firstBracket = text.indexOf('[');
      let start = -1;
      if (firstBrace === -1) start = firstBracket;
      else if (firstBracket === -1) start = firstBrace;
      else start = Math.min(firstBrace, firstBracket);

      if (start !== -1) {
        const lastBrace = text.lastIndexOf('}');
        const lastBracket = text.lastIndexOf(']');
        let end = -1;
        if (lastBrace === -1) end = lastBracket;
        else if (lastBracket === -1) end = lastBrace;
        else end = Math.max(lastBrace, lastBracket);

        if (end !== -1 && end >= start) {
          text = text.substring(start, end + 1);
        }
      }
    }

    return text;
  }

  // Anthropic path
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: apiModel,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userTurn }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  let text = data.content?.[0]?.text ?? '';

  if (expectJson) {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    let start = -1;
    if (firstBrace === -1) start = firstBracket;
    else if (firstBracket === -1) start = firstBrace;
    else start = Math.min(firstBrace, firstBracket);

    if (start !== -1) {
      const lastBrace = text.lastIndexOf('}');
      const lastBracket = text.lastIndexOf(']');
      let end = -1;
      if (lastBrace === -1) end = lastBracket;
      else if (lastBracket === -1) end = lastBrace;
      else end = Math.max(lastBrace, lastBracket);

      if (end !== -1 && end >= start) {
        text = text.substring(start, end + 1);
      }
    }
  }

  return text;
}
