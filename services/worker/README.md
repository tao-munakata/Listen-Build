# Worker Service

Phase 1 performs Inbox routing synchronously through the local API.

Phase 2 worker responsibilities:

- process Redis queue jobs
- run LLM classification
- create changelog drafts
- refresh embeddings
- prepare AI Scrum Master summaries
