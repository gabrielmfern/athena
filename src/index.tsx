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

  useKeyboard((key) => {
    if (key.raw === "q") {
      root.unmount();
      renderer.stop();
      renderer.destroy();
      process.exit(0);
    }
  });

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <box marginBottom={1}>
        <text attributes={TextAttributes.BOLD}>
          Resend Organization - Open Issues & PRs
        </text>
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

      {!loading && !error && issues.length > 0 && (
        <select
          focused
          showScrollIndicator
          flexGrow={1}
          onKeyDown={async (event) => {
            if (event.raw === "r") {
              if (selected === undefined) return;
              const issue = issues[selected];
              if (issue === undefined) return;
              const refreshed = await octokit.issues.get({
                repo: getRepositoryName(issue),
                owner: "resend",
                issue_number: issue.number,
              });
              setItems((prevItems) => {
                if (refreshed.data.state === "closed") {
                  return prevItems.filter((_, index) => index !== selected);
                }
                const newItems = [...prevItems];
                newItems[selected] = refreshed.data as Issue;
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
          options={issues.map((issue) => ({
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
