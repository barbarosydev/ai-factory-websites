#!/usr/bin/env python3
"""Check that Taskfile.yml, AGENTS.md and docs/runbook.md list the same tasks."""

from __future__ import annotations

import pathlib
import re
import sys

TASK_KEY_RE = re.compile(r"^  ([a-z0-9][a-z0-9:_-]*):\s*$")
DOC_TASK_RE = re.compile(r"`task\s+([a-z0-9][a-z0-9:_-]*)(?:\s|`|$)")


def taskfile_tasks(taskfile: pathlib.Path) -> set[str]:
    """Return all non-default top-level task names declared in Taskfile.yml."""
    tasks: set[str] = set()
    in_tasks = False
    for line in taskfile.read_text(encoding="utf-8").splitlines():
        if line.strip() == "tasks:":
            in_tasks = True
            continue
        if in_tasks and line and not line.startswith(" ") and not line.startswith("#"):
            break
        if in_tasks:
            m = TASK_KEY_RE.match(line)
            if m and m.group(1) != "default":
                tasks.add(m.group(1))
    return tasks


def doc_tasks(doc: pathlib.Path) -> set[str]:
    """Return every `task <name>` command mentioned in backticks in a Markdown file."""
    return set(DOC_TASK_RE.findall(doc.read_text(encoding="utf-8")))


def check_repo(root: pathlib.Path) -> list[str]:
    """Return a list of drift errors across Taskfile.yml, AGENTS.md and docs/runbook.md."""
    defined = taskfile_tasks(root / "Taskfile.yml")
    errors: list[str] = []
    for rel in ("AGENTS.md", "docs/runbook.md"):
        doc = root / rel
        documented = doc_tasks(doc)
        missing = sorted(defined - documented)
        unknown = sorted(documented - defined)
        if missing:
            errors.append(
                f"{rel}: missing tasks from Taskfile.yml: {', '.join(missing)}"
            )
        if unknown:
            errors.append(
                f"{rel}: unknown tasks not in Taskfile.yml: {', '.join(unknown)}"
            )
    return errors


def main() -> int:
    root = (
        pathlib.Path(sys.argv[1])
        if len(sys.argv) > 1
        else pathlib.Path(__file__).resolve().parents[2]
    )
    errors = check_repo(root)
    if errors:
        for err in errors:
            print(err, file=sys.stderr)
        return 1
    count = len(taskfile_tasks(root / "Taskfile.yml"))
    print(f"commands ok: {count} tasks match AGENTS.md and docs/runbook.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
