package github

deny contains msg if {
	object.get(input, ["permissions", "contents"], null) != "read"
	msg := "workflow must set top-level `permissions:` with `contents: read`, so GITHUB_TOKEN is read-only"
}

deny contains msg if {
	input.permissions == "write-all"
	msg := "workflow sets `permissions: write-all`; grant `contents: read` only"
}

deny contains msg if {
	some scope, level in input.permissions
	level == "write"
	msg := sprintf("workflow grants `%s: write` at top level; token must stay read-only", [scope])
}

deny contains msg if {
	some job_name, job in input.jobs
	some step in job.steps
	uses := step.uses
	not startswith(uses, "./")
	not regex.match(`^[^@]+@[0-9a-f]{40}$`, uses)
	msg := sprintf("job %q uses %q; pin action to a full 40-hex commit SHA", [job_name, uses])
}
