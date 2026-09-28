// Local OpenAI-compatible mock for trying Aether without an API key.
// Run: npm run mock  →  Base URL http://localhost:8788/v1, model "mock-1", any (or no) key.
import { createServer } from 'node:http';

const port = Number(process.env.MOCK_PORT) || 8788;

const HTML_APP = `<!doctype html>
<html>
<head>
<title>Counter</title>
<style>
  body { font-family: system-ui; display: grid; place-items: center; height: 100vh; margin: 0; background: #faf8f5; }
  button { font-size: 2rem; padding: .5rem 1.5rem; border-radius: 12px; border: 0; background: #c45c26; color: white; }
</style>
</head>
<body>
  <button id="b">Clicked 0 times</button>
  <script>
    let n = 0;
    document.getElementById('b').onclick = (e) => { n++; e.target.textContent = 'Clicked ' + n + ' times'; };
  </script>
</body>
</html>`;

const SLIDES = `# Aether Demo Deck
Tạo slide ngay trong chat — xuất PowerPoint và PDF

---

# Why it matters
- Answers stream token by token
- Artifacts become **real files**
  - PowerPoint (.pptx)
  - PDF documents
- Works in the browser and the iOS app

Note: Mention that files open in Keynote and PowerPoint.

---

# Numbers
| Metric | Q1 | Q2 |
| --- | --- | --- |
| Users | 1,200 | 3,400 |
| Chats | 18k | 52k |

---

# Next steps
1. Try a real model
2. Ask for a deck on any topic
3. Share the file`;

const REPORT = `# Quarterly Report

## Summary
Growth continued this quarter. Tiếng Việt có dấu hiển thị đúng trong PDF.

${Array.from({ length: 14 }, (_, i) => `## Section ${i + 1}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis dapibus posuere velit aliquet. Donec ullamcorper nulla non metus auctor fringilla.\n\n- Point one for section ${i + 1}\n- Point two with **bold** text`).join('\n\n')}`;

function replyFor(messages) {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  const text = typeof last?.content === 'string' ? last.content : (last?.content ?? []).map((p) => p.text ?? '[image]').join(' ');
  const images = Array.isArray(last?.content) ? last.content.filter((p) => p.type === 'image_url').length : 0;
  if (/slide|presentation|pptx|thuyết trình/i.test(text)) {
    return {
      thinking: 'A short deck: cover, two content slides and a table.',
      content: `Here is your deck.\n\n:::artifact id="demo-deck" title="Aether Demo Deck" type="slides"\n${SLIDES}\n:::\n\nDownload it as PowerPoint or PDF below.`,
    };
  }
  if (/pdf|report|báo cáo/i.test(text)) {
    return {
      thinking: 'The user wants a PDF, so a markdown artifact with format="pdf".',
      content: `Here is the report.\n\n:::artifact id="demo-report" title="Quarterly Report" type="markdown" format="pdf"\n${REPORT}\n:::\n\nTap **PDF document** to download it.`,
    };
  }
  if (/html|app|page|counter/i.test(text)) {
    return {
      thinking: 'The user wants a small interactive page. A single self-contained HTML file fits best, so I will return it as an artifact.',
      content: `Here is a small counter app.\n\n:::artifact id="counter-app" title="Counter" type="html"\n${HTML_APP}\n:::\n\nClick the button to increment the count.`,
    };
  }
  return {
    thinking: 'Let me answer with some markdown, a table and a code block so every renderer gets exercised.',
    content: `You said: **${text.slice(0, 200) || '(attachment only)'}**${images ? `\n\nI received ${images} image(s).` : ''}\n\n| Feature | Status |\n| --- | --- |\n| Streaming | ✅ |\n| Markdown | ✅ |\n\n\`\`\`ts\nfunction greet(name: string) {\n  return \`Hello, \${name}!\`;\n}\n\`\`\`\n\nAsk me to *build an html counter app* to see an artifact.`,
  };
}

function chunkText(text, size = 6) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.end();

  if (req.url?.endsWith('/models')) {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ object: 'list', data: [{ id: 'mock-1' }, { id: 'mock-2' }] }));
  }
  if (!req.url?.endsWith('/chat/completions') || req.method !== 'POST') {
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: { message: 'Not found' } }));
  }

  let raw = '';
  for await (const c of req) raw += c;
  const body = JSON.parse(raw || '{}');
  if (body.model && !String(body.model).startsWith('mock')) {
    res.statusCode = 404;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ error: { message: `The model \`${body.model}\` does not exist.` } }));
  }

  if (!body.stream) {
    const isTitle = body.messages?.[0]?.content?.includes('short title');
    res.setHeader('content-type', 'application/json');
    return res.end(
      JSON.stringify({ choices: [{ message: { role: 'assistant', content: isTitle ? 'Mock Conversation Title' : 'pong' } }] }),
    );
  }

  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  let closed = false;
  res.on('close', () => (closed = true));
  const send = (delta) => res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}\n\n`);
  res.write(': keep-alive\n\n');

  // Tool calling: "search …" asks for web_search; once the tool result arrives, answer from it.
  const messages = body.messages ?? [];
  const lastMsg = messages[messages.length - 1];
  const lastUserText = String([...messages].reverse().find((m) => m.role === 'user')?.content ?? '');
  if (body.tools?.length && lastMsg?.role === 'user' && /\b(search|tìm|web)\b/i.test(lastUserText)) {
    const args = JSON.stringify({ query: lastUserText.replace(/^.*?(search|tìm)\s*/i, '').slice(0, 80) || lastUserText });
    send({ content: 'Let me look that up.' });
    send({ tool_calls: [{ index: 0, id: 'call_mock_1', type: 'function', function: { name: 'web_search', arguments: '' } }] });
    for (const piece of chunkText(args, 8)) send({ tool_calls: [{ index: 0, function: { arguments: piece } }] });
    res.write('data: [DONE]\n\n');
    return res.end();
  }
  if (lastMsg?.role === 'tool') {
    const lines = String(lastMsg.content).split('\n').filter(Boolean).slice(0, 6).join('\n> ');
    for (const piece of chunkText(`Here is what the web search returned:\n\n> ${lines}\n`)) {
      if (closed) return;
      send({ content: piece });
      await sleep(8);
    }
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  const { thinking, content } = replyFor(messages);
  for (const piece of chunkText(thinking)) {
    if (closed) return;
    send({ reasoning_content: piece });
    await sleep(15);
  }
  for (const piece of chunkText(content)) {
    if (closed) return;
    send({ content: piece });
    await sleep(12);
  }
  res.write('data: [DONE]\n\n');
  res.end();
}).listen(port, () => console.log(`Mock OpenAI server on http://localhost:${port}/v1 (model: mock-1)`));
