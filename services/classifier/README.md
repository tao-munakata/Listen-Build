# Classifier Service

Phase 1 classification lives in `packages/core/classifier.js` and is used directly by the local API.

Phase 2 can replace this folder with a Python FastAPI service that:

- masks secrets and PII before LLM calls
- returns `tag`, `category`, `confidence`, and `reason`
- stores prompts and model responses in the audit log
