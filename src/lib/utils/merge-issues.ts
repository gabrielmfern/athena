import type { Issue } from "./fetch-issues-and-prs";

/**
 * Merges cached issues with fresh issues from the API.
 * - Preserves the order of cached issues
 * - Updates existing issues in place when found in fresh data
 * - Appends new issues that weren't in cache
 * - Removes issues that are no longer in fresh data
 * - On first load (empty cache), sorts in alternating pattern: oldest, newest, oldest, newest, etc.
 */
export function mergeIssues(
	cachedIssues: Issue[],
	freshIssues: Issue[],
): Issue[] {
	// First load: sort in alternating pattern (oldest, newest, oldest, newest, etc.)
	if (cachedIssues.length === 0) {
		const sorted = [...freshIssues].sort((a, b) => {
			const dateA = new Date(a.updated_at || 0).getTime();
			const dateB = new Date(b.updated_at || 0).getTime();
			return dateA - dateB; // Sort oldest first
		});

		const alternating: Issue[] = [];
		let start = 0;
		let end = sorted.length - 1;

		while (start <= end) {
			if (start === end) {
				alternating.push(sorted[start]);
				break;
			}
			alternating.push(sorted[start]); // Oldest
			alternating.push(sorted[end]); // Newest
			start++;
			end--;
		}

		return alternating;
	}

	// Create a map of fresh issues by ID for quick lookup
	const freshIssuesMap = new Map(freshIssues.map((issue) => [issue.id, issue]));

	// Create a set to track which fresh issues we've processed
	const processedFreshIds = new Set<number>();

	// Update existing issues in cache (preserving order)
	const updatedIssues = cachedIssues
		.map((cachedIssue) => {
			const freshIssue = freshIssuesMap.get(cachedIssue.id);
			if (freshIssue) {
				processedFreshIds.add(cachedIssue.id);
				return freshIssue; // Update with fresh data
			}
			// Issue no longer exists in fresh data, remove it
			return null;
		})
		.filter((issue): issue is Issue => issue !== null);

	// Append new issues that weren't in cache
	const newIssues = freshIssues.filter(
		(issue) => !processedFreshIds.has(issue.id),
	);

	return [...updatedIssues, ...newIssues];
}
