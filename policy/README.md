# Conftest policies for ai-factory-websites

| Package | File | Input | Enforces |
| --- | --- | --- | --- |
| `github` | `github_workflows.rego` | `.github/workflows/*.yml` | Read-only `GITHUB_TOKEN`, SHA-pinned actions |
| `claude` | `claude_settings.rego` | `.claude/settings.json` | Secret deny rules and guard hooks wired |
