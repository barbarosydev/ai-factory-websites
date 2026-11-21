package claude_test

import data.claude

test_valid_settings_passes if {
	count(claude.deny) == 0 with input as {
		"permissions": {
			"deny": [
				"Read(**/.env)",
				"Read(**/.env.*)",
				"Read(**/*.pem)",
				"Read(~/.kube/**)",
				"Write(**/.env)",
				"Write(**/*.pem)",
			],
		},
		"hooks": {
			"PreToolUse": [
				{
					"matcher": "Bash",
					"hooks": [
						{"command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/branch-guard.sh"},
						{"command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/agent-guard.sh"},
					],
				},
				{
					"matcher": "Write|Edit",
					"hooks": [
						{"command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/secret-guard.sh"},
						{"command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/site-isolation-guard.sh"},
					],
				},
			],
		},
	}
}
