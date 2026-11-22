#!/usr/bin/env python3
"""Check references in the repo's tracked Markdown files (standard library only)."""

from __future__ import annotations

import pathlib
import re
import subprocess
import sys

KNOWN_FOLDERS = (
    "docs/",
    "scripts/",
    "tests/",
    "sites/",
    ".claude/",
    "policy/",
    ".github/",
)
SKIPPED_SCHEMES = ("http:", "https:", "mailto:")
PLACEHOLDER_CHARS = "*<{$"

LINK_RE = re.compile(r"(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
IMAGE_RE = re.compile(r"!\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
CODE_RE = re.compile(r"`([^`\n]+)`")
FENCE_RE = re.compile(r"^\s*(```|~~~)")


def tracked_markdown(root: pathlib.Path) -> list[pathlib.Path]:
    out = subprocess.run(
        ["git", "-C", str(root), "ls-files", "*.md"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return [root / line for line in out.splitlines() if line]


def link_target_exists(md_file: pathlib.Path, target: str) -> bool:
    path = target.split("#", 1)[0].split("?", 1)[0]
    if not path:
        return True
    return (md_file.parent / path).exists()


def code_path_candidate(code: str) -> str | None:
    """Return the repo path inside an inline-code span, or None when it is not a checkable path."""
    code = code.strip()
    if not code.startswith(KNOWN_FOLDERS) or any(c in code for c in PLACEHOLDER_CHARS):
        return None
    if " " in code:
        return None
    path = code.rstrip(".,;:)")
    name = path.rsplit("/", 1)[-1]
    if "." not in name.strip("."):
        return None
    return path


def is_ignored(root: pathlib.Path, path: str) -> bool:
    return (
        subprocess.run(
            ["git", "-C", str(root), "check-ignore", "-q", path], check=False
        ).returncode
        == 0
    )


def check_file(root: pathlib.Path, md_file: pathlib.Path) -> list[tuple[int, str]]:
    broken: list[tuple[int, str]] = []
    in_fence = False
    for lineno, line in enumerate(
        md_file.read_text(encoding="utf-8").splitlines(), start=1
    ):
        if FENCE_RE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for match in LINK_RE.finditer(line):
            target = match.group(1)
            if target.startswith(SKIPPED_SCHEMES) or target.startswith("#"):
                continue
            if not link_target_exists(md_file, target):
                broken.append((lineno, target))
        stripped = IMAGE_RE.sub("", LINK_RE.sub("", line))
        for match in CODE_RE.finditer(stripped):
            path = code_path_candidate(match.group(1))
            if path and not (root / path).exists() and not is_ignored(root, path):
                broken.append((lineno, path))
    return broken


def check_adr_index(root: pathlib.Path) -> list[str]:
    """Ensure every numbered ADR in docs/adr/ is linked in docs/adr/README.md."""
    adr_dir = root / "docs" / "adr"
    index = adr_dir / "README.md"
    if not index.is_file():
        return []
    text = index.read_text(encoding="utf-8")
    missing: list[str] = []
    for adr in sorted(adr_dir.glob("[0-9][0-9][0-9][0-9]-*.md")):
        if f"({adr.name})" not in text:
            missing.append(f"docs/adr/README.md: missing index link for {adr.name}")
    return missing


def main(argv: list[str]) -> int:
    root = (
        pathlib.Path(argv[1]).resolve()
        if len(argv) > 1
        else pathlib.Path(__file__).resolve().parents[2]
    )
    files = tracked_markdown(root)
    count = 0
    for md_file in files:
        for lineno, target in check_file(root, md_file):
            print(f"{md_file.relative_to(root)}:{lineno}: {target}")
            count += 1
    for msg in check_adr_index(root):
        print(msg)
        count += 1
    if count:
        return 1
    print(f"links ok: {len(files)} Markdown files checked")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
