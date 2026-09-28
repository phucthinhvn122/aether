# Aether

A calm, Claude-style AI chat for **any OpenAI-compatible endpoint** — OpenAI, OpenRouter, Groq, Together, Fireworks, DeepSeek, Ollama, LM Studio, vLLM, and more. Warm off-white UI, streaming answers with a separate “Thinking” block, an artifacts side panel, and projects with knowledge files.

Everything (settings, API key, chats, projects, files) is stored **only on your device** in IndexedDB. There is no backend and no hardcoded provider or key.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173 → **Settings** → pick a preset (or type a Base URL), paste your API key, enter a model id, then **Test connection**.

No key yet? Run the bundled mock server in a second terminal and point Aether at it:

```bash
npm run mock        # http://localhost:8788/v1, model "mock-1", no key needed
```

Ask it to “build an html counter app” to see an artifact.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (includes the CORS proxy at `/api/proxy`) |
| `npm run build` | Type-check + production build into `dist/` |
| `npm run preview` | Serve `dist/` with the proxy |
| `npm run serve` | Tiny Node server: `dist/` + proxy, binds `0.0.0.0:$PORT` (default 8787) |
| `npm run typecheck` | Strict TypeScript check |
| `npm run mock` | Local OpenAI-compatible mock (streaming + reasoning + artifacts) |
| `npm run icons` | Regenerate the PNG app icons (+ iOS icon/splash) |
| `npm run ios:sync` | Build web app and copy it into the iOS project |
| `npm run ios:open` / `ios:run` | Open in Xcode / run on simulator (macOS only) |

## Pointing Aether at a provider

Aether calls `POST {baseUrl}/chat/completions` with `stream: true`, and `GET {baseUrl}/models` for the model list / connection test. The `Authorization: Bearer …` header is only sent when a key is set.

### Groq

- Base URL: `https://api.groq.com/openai/v1`
- API key: from https://console.groq.com/keys
- Model: e.g. `llama-3.3-70b-versatile` (or click **Load models**)
- Reasoning models such as `deepseek-r1-distill-llama-70b` / `qwen/qwen3-32b` stream their thoughts into the Thinking block.

### OpenRouter

- Base URL: `https://openrouter.ai/api/v1`
- API key: from https://openrouter.ai/keys
- Model: e.g. `openai/gpt-4o-mini`, `anthropic/claude-sonnet-4`, `deepseek/deepseek-r1`
- `delta.reasoning` from reasoning models is shown in the Thinking block. Aether sends `HTTP-Referer` / `X-Title` automatically.

### Ollama (local)

```bash
ollama pull llama3.2
ollama serve
```

- Base URL: `http://localhost:11434/v1`
- API key: leave empty
- Model: `llama3.2` (or any pulled model; **Load models** lists them)
- DeepSeek-R1 style `<think>…</think>` output is split into the Thinking block automatically.
- If the browser blocks the request, either turn on **Call via proxy** or start Ollama with `OLLAMA_ORIGINS=*`.

LM Studio works the same way with `http://localhost:1234/v1` (start the local server in LM Studio first).

## CORS and the proxy toggle

Browsers only allow cross-origin calls when the provider sends CORS headers. OpenAI, OpenRouter and Groq generally do; many self-hosted servers do not. When a request is blocked you’ll see a clear “likely CORS” error.

Turn on **Settings → Call via proxy** to route requests through the same-origin relay at `/api/proxy` (`server/proxy-core.mjs`). It streams the response back unchanged and forwards only `Authorization`, `Content-Type`, `Accept`, `HTTP-Referer` and `X-Title`.

- The proxy exists only when the app is served by `npm run dev`, `npm run preview` or `npm run serve`. A plain static host (Netlify, GitHub Pages, S3…) has no proxy.
- With the proxy your key passes through that server. Only run it on machines you trust, and don’t expose `npm run serve` publicly without adding authentication — it’s an open relay.
- An HTTPS page cannot call a plain `http://` LAN server (mixed content); use the proxy or serve both over HTTPS.

### Deploying the web app to Vercel

`vercel.json` + `api/proxy.ts` make the hosted site work like `npm run dev`:

- Static Vite build from `dist/`, plus a streaming Vercel Function at `/api/proxy` (Node runtime, `maxDuration` 300 s — the Hobby maximum; long replies beyond 5 minutes are cut off).
- When a direct browser call is blocked by CORS, Aether automatically retries through `/api/proxy` (no need to flip the toggle).
- The hosted proxy refuses localhost/private-network targets (Ollama/LM Studio need a local `npm run dev`) and cross-site browser use. Set `PROXY_ALLOWED_HOSTS=api.example.com,openrouter.ai` in Vercel → Settings → Environment Variables to limit which hosts it relays to — recommended, since the URL is public.
- Deploy: import the GitHub repo at vercel.com/new (auto-deploys on every push), or run `vercel --prod` from this folder.

## Security: never commit API keys

- Keys are typed into the Settings screen and stored in IndexedDB on the device. They are never written to files, logs or the repo.
- There is no `.env` usage. `.env*` files are git-ignored anyway, just in case.
- Don’t paste keys into project knowledge files or chat messages you plan to share.

## Features

- **Streaming chat** — SSE parsing (`data:` lines, `[DONE]`), stop via `AbortController`, regenerate, edit & resend (history after the edited message is truncated), copy, Markdown + GFM + highlight.js code blocks with language label and copy button.
- **Quick model switcher** — the model name in the composer opens a Claude-style menu (a bottom sheet on phones, a viewport-clamped popover on larger screens): search or type any model id, recent models, the provider’s `/models` list (cached per Base URL, refreshable), a Thinking effort selector (Auto sends nothing; Low/Medium/High send `reasoning_effort`, or `reasoning.effort` on OpenRouter) and the web search switch.
- **Thinking** — `delta.reasoning_content || delta.reasoning || delta.thinking` (and inline `<think>` tags) stream into a collapsible block above the answer.
- **Clear errors** — 401/403, unknown model, wrong URL (404), rate limits, CORS and network failures each get a specific message with Retry and a Settings link.
- **Conversations** — create, inline rename, pin, delete, search by title *and* message text, sorted by last activity, auto-title after the first turn (one non-streaming call, ≤ 6 words, in the user’s language).
- **Artifacts** — the hidden system prompt asks the model to wrap deliverables as `:::artifact id="…" title="…" type="html|markdown|code" language="…"`. Large ```` ```html ````/```` ```markdown ```` or long code fences also become artifacts. The right panel (full-screen sheet on mobile) has Preview / Code tabs, a sandboxed iframe (`allow-scripts`, no same-origin) for HTML, copy, download, close, and version navigation when the same id is regenerated.
- **Slides, PDF and PowerPoint** — `type="slides"` artifacts are markdown slides separated by `---` (first `#` heading = slide title, `Note:` lines = speaker notes), previewed as 16:9 slides and exported to **.pptx** (pptxgenjs) or **PDF**. Markdown and HTML artifacts export to paginated A4 **PDF** (html2canvas-pro + jsPDF, page breaks between blocks, so Vietnamese and other scripts render correctly). When the model adds `format="pdf"` the card shows a one-tap download button. HTML pages are rendered in their sandboxed iframe first (scripts, Tailwind CDN, charts) and only a static snapshot is captured. Export libraries are lazy-loaded.
- **Web search** — with **Settings → Web search** (or the globe switch in the model menu) the model gets two tools, `web_search` (DuckDuckGo HTML, no API key) and `fetch_url` (page text). The tool loop runs up to 5 rounds; searches and sources are shown above the answer. Models/providers that reject `tools` are automatically asked again without them. Search requests go through URLSession in the iOS app and through `/api/proxy` on the web — if you set `PROXY_ALLOWED_HOSTS` on Vercel, add `html.duckduckgo.com,lite.duckduckgo.com` (and pages the model reads will still be blocked unless listed).
- **Projects** — name + instructions, knowledge files (`.txt .md .json .csv .pdf .png .jpg .webp`), PDF text via pdf.js, images stored as data URLs. Project instructions and file extracts (hard cap ~80k chars, name matches first, then most recent) are added to the system prompt; project images are sent as `image_url` parts on vision models.
- **In-chat uploads** — images, PDFs and text files with removable chips. PDFs/text are appended to the message as `<document>` blocks; images go as multimodal parts (automatically retried as text-only if the model rejects images; toggle in Settings).
- **Custom instructions** — global (Settings) + project (merged on top). Technical rules (artifact format, reply in the user’s language) stay hidden from the transcript.

## Project structure

```
server/            proxy-core.mjs (shared relay), index.mjs (optional prod server)
scripts/           mock-server.mjs, generate-icons.mjs
public/            manifest, service worker, icons
src/
  lib/             openai.ts (client), sse.ts, db.ts (Dexie), files.ts, pdf.ts, router.ts, strings.ts (all UI copy)…
  components/      Button, IconButton, Field, CopyButton, PageHeader, Skeleton, Logo
  features/
    chat/          ChatView, MessageList, messages, Composer, ThinkingBlock, runner.ts, buildPrompt.ts, autoTitle.ts
    conversations/ Sidebar, list, item (rename/pin/delete), search
    artifacts/     parser, panel, preview, card, store
    markdown/      Markdown, CodeBlock, highlight
    projects/      list, detail, files, actions
    settings/      SettingsView, ModelPicker, EffortPicker, ConnectionTest, presets
    models/        ModelMenu (composer model switcher), model list cache
    layout/        UI store (drawer / collapsed sidebar)
ios/               Capacitor Xcode project (App/App/Info.plist, Assets.xcassets)
.github/workflows/ ios.yml — macOS CI build (simulator .app + unsigned .ipa)
```

UI strings live in `src/lib/strings.ts` so they can be translated later.

## iOS / PWA

- `viewport-fit=cover`, safe-area insets, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `theme-color`, apple-touch-icon and a web manifest.
- The app height follows `visualViewport`, so the composer stays above the iOS keyboard.
- 44px touch targets, no hover-only actions, 16px inputs (no zoom on focus), file pickers that work in iOS Safari.
- Add to Home Screen from Safari’s share sheet. The service worker (production builds, HTTPS or localhost only) caches the app shell for offline launch; chats are already offline in IndexedDB.

To try it on an iPhone during development, run `npm run dev` and open the “Network” URL Vite prints (same Wi-Fi). Note that plain-HTTP LAN URLs are not a secure context: the service worker and clipboard API are disabled there (Aether falls back gracefully).

## Native iOS app (Capacitor)

The Xcode project lives in `ios/` (Capacitor 8, Swift Package Manager — no CocoaPods). Bundle id `app.aether.chat` (change it in `capacitor.config.ts` **and** in Xcode → Signing & Capabilities before publishing). Icon and splash are generated by `npm run icons`.

Building iOS apps requires **macOS with Xcode 26+** — it cannot be done on Windows. Two ways:

### A. GitHub Actions (works from Windows)

`.github/workflows/ios.yml` builds on a `macos-26` runner on every push to `main` (or manually via *Actions → iOS build → Run workflow*):

- **Releases → `ios-latest` → `Aether-unsigned.ipa`** — the device build as a real `.ipa` file. Sign it with your certificate (ESign, Sideloadly, Feather, AltStore…) before installing; iOS refuses unsigned apps.
- Artifacts (GitHub zips these — unzip **once**; an `.ipa` is itself a zip, so don’t extract the `.ipa`): `Aether-ios-unsigned-ipa`, `Aether-ios-simulator` (`App.app` for `xcrun simctl install booted App.app`), and `Aether-ios-signed-ipa` when signing is configured.

#### Let CI sign the IPA with your certificate

Add three repository secrets (Settings → Secrets and variables → Actions), e.g. from PowerShell:

```powershell
gh secret set IOS_P12_BASE64 --body ([Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\cert.p12")))
gh secret set IOS_MOBILEPROVISION_BASE64 --body ([Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\profile.mobileprovision")))
gh secret set IOS_P12_PASSWORD   # prompts for the .p12 password
```

The next build runs `scripts/ios-resign.sh` and uploads `Aether-ios-signed-ipa` (kept 7 days; not published to the public release because it embeds your profile). The log shows the bundle id, profile type and expiry. Ad-hoc/development profiles only install on devices whose UDID is in the profile; App Store profiles must go through TestFlight.

```bash
git init && git add . && git commit -m "Aether"
git remote add origin https://github.com/<you>/aether.git
git push -u origin main
```

### B. On a Mac

```bash
npm install
npm run ios:sync      # vite build + cap sync ios
npm run ios:open      # opens Xcode → pick your Team under Signing → Run on a device/simulator
```

For TestFlight / App Store: Apple Developer Program membership, then in Xcode *Product → Archive → Distribute App*.

### Notes for the native build

- In the app, all model requests go through a small local plugin (`ios/App/App/NativeHttpStreamPlugin.swift`, registered in `MainViewController.swift`) that uses `URLSession`, so **CORS does not apply** and any OpenAI-compatible server works. Responses are streamed chunk by chunk into a real `ReadableStream` (`src/lib/nativeHttp.ts`), so token streaming and Stop still work. The proxy toggle is disabled because it isn’t needed. (`CapacitorHttp` isn’t used because it buffers whole responses.)
- WKWebView ignores `<a download>`, so downloads (artifact sources, PDF, PPTX) go through `ios/App/App/NativeSharePlugin.swift`: the file is written to a temp folder and the iOS share sheet opens (Save to Files, AirDrop, Keynote/PowerPoint…).
- `NSAllowsArbitraryLoads` is enabled so plain `http://` servers work; for App Store review you’ll need to justify it (user-configured AI servers) or remove it.
- `localhost` means the phone itself. For Ollama/LM Studio use your computer’s LAN IP (e.g. `http://192.168.1.20:11434/v1`, start Ollama with `OLLAMA_HOST=0.0.0.0 OLLAMA_ORIGINS=*`). `Info.plist` allows local-network HTTP (`NSAllowsLocalNetworking`) and includes the local-network, camera and photo-library usage strings.
- The API key is stored in the app’s IndexedDB. For a public App Store release consider moving it to the Keychain (secure-storage plugin).
- Re-run `npm run ios:sync` after every web change.
