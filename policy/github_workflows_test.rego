package github_test

import data.github

test_valid_workflow_passes if {
	count(github.deny) == 0 with input as {
		"permissions": {"contents": "read"},
		"jobs": {"ci": {"steps": [{"uses": "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1"}]}},
	}
}

test_unpinned_action_fails if {
	count(github.deny) > 0 with input as {
		"permissions": {"contents": "read"},
		"jobs": {"ci": {"steps": [{"uses": "actions/checkout@v7"}]}},
	}
}
