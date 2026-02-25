
# PROJECT_OVERVIEW.md

...existing project overview content...

---

## PM Chat Reboot Entry Point

PM_BOOTSTRAP.md is the canonical entrypoint for rebooting PM chat sessions. It lists the authoritative documents to load and the authority order for Caliber PM operations.

---

## Runtime & Module Resolution Contract

Caliber enforces deterministic engines. Determinism requires a stable and explicit module resolution contract.

The following runtime assumptions are mandatory:

### Environment

- Development environment: GitHub Codespaces
- Runtime: Node.js (version defined in package.json / devcontainer)
- Framework: Next.js (application runtime)

### Module System Strategy

Caliber uses a single, consistent module resolution strategy.

- No hybrid ESM/CommonJS patterns.
- Tests and runtime must resolve modules identically.
- No mixed extension imports (.ts in one place, .js in another).
- No implicit resolution differences between test runner and runtime.

If using ESM:
- tsconfig must use NodeNext or Bundler resolution consistently.
- Imports must follow the chosen extension discipline (.js where required).

If using Bundler-controlled resolution (Next.js default):
- moduleResolution must be "bundler".
- Imports must omit file extensions.
- Tests must run through the same transform pipeline.

### Import Discipline

- Internal modules must be imported consistently.
- Tokenization, alignment, and deterministic engines must not rely on environment-specific resolution behavior.
- Whole-word matching helpers must be resolvable in both test and runtime without conditional imports.

### Determinism Requirement

Identical input must produce identical output in:

- Test environment
- Runtime environment
- CI environment

If resolution differs across environments, the implementation is incomplete.

Infrastructure inconsistency is treated as a determinism violation.

---

