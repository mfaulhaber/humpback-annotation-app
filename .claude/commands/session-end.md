Read and execute the workflow defined in docs/workflows/session-end.md.
Treat a direct user invocation as confirmation that any intended manual
verification is already complete.
When the task used a `feature/*` branch, rename the conversation to that branch
name before switching back to `main`.
