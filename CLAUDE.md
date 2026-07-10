# Working with Fable 5

Fable 5 is a high-end but expensive model. When doing coding work, use judgment
to decide when consulting it is worth the cost:

- **Consult Fable 5 for:** hard architectural/design decisions, tricky
  algorithmic choices, subtle bugs you're not fully confident diagnosing
  alone, security-sensitive logic, or other genuinely high-stakes calls.
- **Don't consult it for:** routine edits, boilerplate, mechanical refactors,
  straightforward bug fixes, or anything you're already confident about.

Fable 5 acts as a **consultant, not an implementer**: ask it for analysis,
a second opinion, or a recommended approach, then do the actual coding
(file edits, commits, etc.) yourself. Don't hand it the implementation work
directly — round-tripping a full agentic coding task through a second model
costs far more than a single focused question, and it would start with no
memory of the ongoing conversation/codebase context, so its edits would need
re-review anyway. Keep the consultation narrow and self-contained (a specific
question with enough context to answer it), and fold the answer back into
your own work.
