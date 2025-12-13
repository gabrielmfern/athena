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
import {
  fetchIssuesAndPRs,
  type Issue,
} from "./lib/utils/fetch-issues-and-prs";
import { octokit } from "./lib/octokit";

const colors = {
  red: RGBA.fromValues(251, 43.8, 54.3),
  green: RGBA.fromValues(5.07, 223, 114),
  yellow: RGBA.fromValues(255, 185, 0),
} as const satisfies Record<string, RGBA>;

function App() {
  const [issues, setItems] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchIssuesAndPRs()
      .then((items) => {
        setItems(items);
        return Bun.write(
          "resend-issues-prs.json",
          JSON.stringify(items, null, 2),
        );
      })
      .catch((error) => setError(String(error)))
      .finally(() => setLoading(false));
  }, []);

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

  // Reset selection when filter changes
  useEffect(() => {
    setSelected(0);
  }, [searchQuery]);

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
          onChange={setSearchQuery}
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

      {!loading &&
        !error &&
        issues.length > 0 &&
        filteredIssues.length === 0 && (
          <box>
            <text attributes={TextAttributes.DIM}>
              No results matching "{searchQuery}"
            </text>
          </box>
        )}

      {!loading && !error && filteredIssues.length > 0 && (
        <select
          focused={!isSearchFocused}
          showScrollIndicator
          flexGrow={1}
          onKeyDown={async (event) => {
            if (event.raw === "r") {
              if (selected === undefined) return;
              const issue = filteredIssues[selected];
              if (issue === undefined) return;
              const refreshed = await octokit.issues.get({
                repo: getRepositoryName(issue),
                owner: "resend",
                issue_number: issue.number,
              });
              setItems((prevItems) => {
                const originalIndex = prevItems.findIndex(
                  (i) => i.id === issue.id,
                );
                if (originalIndex === -1) return prevItems;
                if (refreshed.data.state === "closed") {
                  return prevItems.filter(
                    (_, index) => index !== originalIndex,
                  );
                }
                const newItems = [...prevItems];
                newItems[originalIndex] = refreshed.data as Issue;
                return newItems;
              });
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
