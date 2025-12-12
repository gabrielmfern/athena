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
  const [items, setItems] = useState<Issue[]>([]);
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

  const selectRef = useRef<SelectRenderable>(null);

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

      {!loading && !error && items.length === 0 && (
        <box>
          <text attributes={TextAttributes.DIM}>
            No open issues or PRs found.
          </text>
        </box>
      )}

      {!loading && !error && items.length > 0 && (
        <select
          focused
          showScrollIndicator
          flexGrow={1}
          onKeyDown={async (event) => {
            if (event.raw === "r") {
              const selectedIndex = selectRef.current?.selectedIndex;
              if (selectedIndex === undefined) return;
              const issue = items[selectedIndex];
              if (issue === undefined) return;
              const refreshed = await octokit.issues.get({
                repo: issue.repository_url,
                owner: "resend",
                issue_number: issue.number,
              });
              setItems((prevItems) => {
                const newItems = [...prevItems];
                newItems[selectedIndex] = refreshed.data as Issue;
                return newItems;
              });
            }
          }}
          ref={selectRef}
          onSelect={(_, option) => {
            open(option?.value);
          }}
          options={items.map((item) => ({
            name: `${item.title}`,
            description: `#${item.number} - ${path.basename(new URL(item.repository_url).pathname)}`,
            value: item.html_url,
          }))}
        />
      )}
    </box>
  );
}

const renderer = await createCliRenderer();
const root = createRoot(renderer);
root.render(<App />);
