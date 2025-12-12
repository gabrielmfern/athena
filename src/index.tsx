import { createCliRenderer, TextAttributes, RGBA } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { useState, useEffect } from "react";
import { octokit } from "./lib/octokit";
import {
  fetchIssuesAndPRs,
  type IssueOrPR,
} from "./lib/utils/fetch-issues-and-prs";

const colors = {
  red: RGBA.fromValues(251, 43.8, 54.3),
  green: RGBA.fromValues(5.07, 223, 114),
  yellow: RGBA.fromValues(255, 185, 0),
} as const satisfies Record<string, RGBA>;

function App() {
  const [items, setItems] = useState<IssueOrPR[]>([]);
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
        <box flexDirection="column" flexGrow={1}>
          {items.map((item) => (
            <box key={item.number} flexDirection="row" marginBottom={1}>
              <box marginRight={1}>
                <text
                  style={{
                    fg: item.pull_request ? colors.green : colors.yellow,
                  }}
                >
                  {item.pull_request ? "[PR]" : "[Issue]"}
                </text>
              </box>
              <box marginRight={1}>
                <text attributes={TextAttributes.DIM}>#{item.number}</text>
              </box>
              <box flexGrow={1}>
                <text>{item.title}</text>
              </box>
              <box marginLeft={1}>
                <text attributes={TextAttributes.DIM}>@{item.user.login}</text>
              </box>
            </box>
          ))}
        </box>
      )}
    </box>
  );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
