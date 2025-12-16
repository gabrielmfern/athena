import path from "node:path";
import {
	createCliRenderer,
	RGBA,
	SelectRenderable,
	TextAttributes,
} from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import open from "open";
import { useEffect, useRef, useState } from "react";
import { useIssuesAndPRs } from "./lib/hooks/useIssuesAndPRs";
import type { Issue } from "./lib/utils/fetch-issues-and-prs";

const colors = {
	red: RGBA.fromValues(251, 43.8, 54.3),
	green: RGBA.fromValues(5.07, 223, 114),
	yellow: RGBA.fromValues(255, 185, 0),
} as const satisfies Record<string, RGBA>;

function App() {
	const { issues, loading, error, refreshIssue } = useIssuesAndPRs();
	const [searchQuery, setSearchQuery] = useState("");
	const [isSearchFocused, setIsSearchFocused] = useState(false);

	const [selected, setSelected] = useState(0);

	const filteredIssues = issues.filter((issue) => {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		const title = issue.title.toLowerCase();
		const repoName = getRepositoryName(issue).toLowerCase();
		const number = String(issue.number);
		return (
			title.includes(query) ||
			repoName.includes(query) ||
			number.includes(query)
		);
	});

	useKeyboard((key) => {
		if (key.raw === "q" && !isSearchFocused) {
			root.unmount();
			renderer.stop();
			renderer.destroy();
			process.exit(0);
		}
		if (key.raw === "/" && !isSearchFocused) {
			setIsSearchFocused(true);
		}
		if (key.name === "escape" && isSearchFocused) {
			setIsSearchFocused(false);
		}
	});

	return (
		<box flexDirection="column" flexGrow={1} padding={1}>
			<box marginBottom={1}>
				<text attributes={TextAttributes.BOLD}>
					Resend Organization - Open Issues & PRs
				</text>
			</box>

			<box marginBottom={1}>
				<text attributes={TextAttributes.DIM}>Search: </text>
				<input
					focused={isSearchFocused}
					value={searchQuery}
					onChange={(value) => {
						setSearchQuery(value);
						setSelected(0);
					}}
					onSubmit={() => setIsSearchFocused(false)}
					placeholder="Type to filter... (press / to focus, Esc to unfocus)"
				/>
			</box>

			{loading && (
				<box>
					<text attributes={TextAttributes.DIM}>Loading...</text>
				</box>
			)}

			{error && (
				<box>
					<text style={{ fg: colors.red }}>Error: {error}</text>
				</box>
			)}

			{!loading && !error && issues.length === 0 && (
				<box>
					<text attributes={TextAttributes.DIM}>
						No open issues or PRs found.
					</text>
				</box>
			)}

			{!error && issues.length > 0 && filteredIssues.length === 0 && (
				<box>
					<text attributes={TextAttributes.DIM}>
						No results matching "{searchQuery}"
					</text>
				</box>
			)}

			{!error && filteredIssues.length > 0 && (
				<select
					focused={!isSearchFocused}
					showScrollIndicator
					flexGrow={1}
					onKeyDown={async (event) => {
						if (event.raw === "r") {
							if (selected === undefined) return;
							const issue = filteredIssues[selected];
							if (issue === undefined) return;
							await refreshIssue(issue);
						}
					}}
					selectedIndex={selected}
					onChange={(index) => {
						setSelected(index);
					}}
					onSelect={(_, option) => {
						open(option?.value);
					}}
					options={filteredIssues.map((issue) => ({
						name: `${issue.title}`,
						description: `#${issue.number} - ${getRepositoryName(issue)}`,
						value: issue.html_url,
					}))}
				/>
			)}
		</box>
	);
}

function getRepositoryName(issue: Issue) {
	const url = new URL(issue.repository_url);
	return path.basename(url.pathname);
}

const renderer = await createCliRenderer();
const root = createRoot(renderer);
root.render(<App />);

// renderer.console.toggle();
