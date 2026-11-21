package claude

required_denies := [
	"Read(**/.env)",
	"Read(**/.env.*)",
	"Read(**/*.pem)",
	"Read(~/.kube/**)",
	"Write(**/.env)",
	"Write(**/*.pem)",
]

required_hooks := {
	"branch-guard.sh": ["Bash"],
	"agent-guard.sh": ["Bash"],
	"secret-guard.sh": ["Write", "Edit"],
	"site-isolation-guard.sh": ["Write", "Edit"],
}

deny contains msg if {
	some rule in required_denies
	not rule in object.get(input, ["permissions", "deny"], [])
	msg := sprintf(".claude/settings.json: permissions.deny no longer contains %q", [rule])
}

wired(hook, tool) if {
	some entry in input.hooks.PreToolUse
	tool in split(entry.matcher, "|")
	some h in entry.hooks
	endswith(trim_right(h.command, "\""), concat("/", ["", hook]))
}

deny contains msg if {
	some hook, tools in required_hooks
	some tool in tools
	not wired(hook, tool)
	msg := sprintf(".claude/settings.json: PreToolUse hook %s is not wired for %s", [hook, tool])
}
