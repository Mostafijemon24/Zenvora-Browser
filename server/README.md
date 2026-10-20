# Zenvora Assistant server

Keeps your Claude and OpenRouter API keys off users' machines and forwards Assistant questions from the Zenvora app.

```bash
npm install
cp .env.example .env     # add ANTHROPIC_API_KEY and/or OPENROUTER_API_KEY, and ZENVORA_ACCESS_TOKEN
npm run start:env        # → http://localhost:8787
npm test                 # runs against fake providers, no keys or credits needed
```

Full setup, deployment and API reference: [main README → AI assistant setup](../README.md#-ai-assistant-setup).
