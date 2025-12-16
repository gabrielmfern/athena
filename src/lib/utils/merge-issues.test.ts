import { expect, test } from "bun:test";
import type { Issue } from "./fetch-issues-and-prs";
import { mergeIssues } from "./merge-issues";

// Helper to create a minimal Issue for testing
function createIssue(id: number, title: string, updated_at: string): Issue {
	return {
		id,
		number: id,
		title,
		updated_at,
		state: "open",
		html_url: `https://github.com/test/repo/issues/${id}`,
		repository_url: "https://api.github.com/repos/test/repo",
		labels_url: "",
		comments_url: "",
		events_url: "",
		user: {
			login: "testuser",
			id: 1,
			type: "User",
		} as Issue["user"],
	} as Issue;
}

test("mergeIssues preserves cache order and updates existing issues", () => {
	const cached = [
		createIssue(1, "Old Title 1", "2024-01-01T00:00:00Z"),
		createIssue(2, "Old Title 2", "2024-01-02T00:00:00Z"),
		createIssue(3, "Old Title 3", "2024-01-03T00:00:00Z"),
	];

	const fresh = [
		createIssue(2, "New Title 2", "2024-01-05T00:00:00Z"), // Updated
		createIssue(1, "New Title 1", "2024-01-04T00:00:00Z"), // Updated (different order in fresh)
		createIssue(3, "New Title 3", "2024-01-06T00:00:00Z"), // Updated
	];

	const result = mergeIssues(cached, fresh);

	// Should preserve cache order (1, 2, 3)
	expect(result.length).toBe(3);
	expect(result[0].id).toBe(1);
	expect(result[1].id).toBe(2);
	expect(result[2].id).toBe(3);

	// Should have updated titles
	expect(result[0].title).toBe("New Title 1");
	expect(result[1].title).toBe("New Title 2");
	expect(result[2].title).toBe("New Title 3");
});

test("mergeIssues appends new issues", () => {
	const cached = [
		createIssue(1, "Title 1", "2024-01-01T00:00:00Z"),
		createIssue(2, "Title 2", "2024-01-02T00:00:00Z"),
	];

	const fresh = [
		createIssue(1, "Title 1", "2024-01-01T00:00:00Z"),
		createIssue(2, "Title 2", "2024-01-02T00:00:00Z"),
		createIssue(4, "New Issue", "2024-01-04T00:00:00Z"), // New
		createIssue(5, "Another New", "2024-01-05T00:00:00Z"), // New
	];

	const result = mergeIssues(cached, fresh);

	expect(result.length).toBe(4);
	expect(result[0].id).toBe(1);
	expect(result[1].id).toBe(2);
	expect(result[2].id).toBe(4);
	expect(result[3].id).toBe(5);
});

test("mergeIssues removes issues not in fresh data", () => {
	const cached = [
		createIssue(1, "Title 1", "2024-01-01T00:00:00Z"),
		createIssue(2, "Title 2", "2024-01-02T00:00:00Z"),
		createIssue(3, "Title 3", "2024-01-03T00:00:00Z"), // Removed
	];

	const fresh = [
		createIssue(1, "Title 1", "2024-01-01T00:00:00Z"),
		createIssue(2, "Title 2", "2024-01-02T00:00:00Z"),
	];

	const result = mergeIssues(cached, fresh);

	expect(result.length).toBe(2);
	expect(result[0].id).toBe(1);
	expect(result[1].id).toBe(2);
	expect(result.find((i) => i.id === 3)).toBeUndefined();
});

test("mergeIssues handles empty cache with alternating pattern", () => {
	const cached: Issue[] = [];
	const fresh = [
		createIssue(1, "Title 1", "2024-01-01T00:00:00Z"), // Oldest
		createIssue(2, "Title 2", "2024-01-02T00:00:00Z"),
		createIssue(3, "Title 3", "2024-01-03T00:00:00Z"),
		createIssue(4, "Title 4", "2024-01-04T00:00:00Z"), // Newest
	];

	const result = mergeIssues(cached, fresh);

	expect(result.length).toBe(4);
	// Should alternate: oldest, newest, second-oldest, second-newest
	expect(result[0].id).toBe(1); // Oldest
	expect(result[1].id).toBe(4); // Newest
	expect(result[2].id).toBe(2); // Second-oldest
	expect(result[3].id).toBe(3); // Second-newest
});

test("mergeIssues handles empty cache with odd number of issues", () => {
	const cached: Issue[] = [];
	const fresh = [
		createIssue(1, "Title 1", "2024-01-01T00:00:00Z"), // Oldest
		createIssue(2, "Title 2", "2024-01-02T00:00:00Z"),
		createIssue(3, "Title 3", "2024-01-03T00:00:00Z"), // Newest (middle)
	];

	const result = mergeIssues(cached, fresh);

	expect(result.length).toBe(3);
	// Should alternate: oldest, newest, middle
	expect(result[0].id).toBe(1); // Oldest
	expect(result[1].id).toBe(3); // Newest
	expect(result[2].id).toBe(2); // Middle
});

test("mergeIssues handles empty fresh data", () => {
	const cached = [
		createIssue(1, "Title 1", "2024-01-01T00:00:00Z"),
		createIssue(2, "Title 2", "2024-01-02T00:00:00Z"),
	];
	const fresh: Issue[] = [];

	const result = mergeIssues(cached, fresh);

	expect(result.length).toBe(0);
});
