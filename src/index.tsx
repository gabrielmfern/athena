import { createCliRenderer, TextAttributes, RGBA } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { useState, useEffect } from "react";
import { octokit } from "./lib/octokit";

interface IssueOrPR {
  number: number;
  title: string;
  state: string;
  html_url: string;
  updated_at?: string;
  author_association?: string;
  pull_request?: {
    url: string;
  };
  user: {
    login: string;
    type?: string;
  };
}

const colors = {
  red: RGBA.fromValues(
    251,
    43.8,
    54.3,
  ),
  green: RGBA.fromValues(
    5.07,
    223,
    114,
  ),
  yellow: RGBA.fromValues(
    255,
    185,
    0,
  )
} as const satisfies Record<string, RGBA>;

function App() {
  const [items, setItems] = useState<IssueOrPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIssuesAndPRs() {
      try {
        setLoading(true);
        setError(null);

        // Fetch open issues and PRs from resend organization using search API
        const [issuesResponse, prsResponse] = await Promise.all([
          octokit.request("GET /search/issues", {
            q: "org:resend type:issue state:open",
            per_page: 100,
            sort: "updated",
            order: "desc",
          }),
          octokit.request("GET /search/issues", {
            q: "org:resend type:pr state:open",
            per_page: 100,
            sort: "updated",
            order: "desc",
          }),
        ]);

        // Combine issues and PRs, filter out bots, owners, and maintainers, then sort by updated date
        const allItems = [
          ...(issuesResponse.data.items as IssueOrPR[]),
          ...(prsResponse.data.items as IssueOrPR[]),
        ]
          .filter((item) => {
            const username = item.user.login.toLowerCase();
            const isBot = item.user.type === "Bot" || username.endsWith("[bot]");
            // Filter out OWNER, MEMBER, and MAINTAINER associations
            const isOrgMaintainer =
              item.author_association === "OWNER" ||
              item.author_association === "MEMBER" ||
              item.author_association === "MAINTAINER";
            return !isBot && !isOrgMaintainer;
          })
          .sort((a, b) => {
            const dateA = new Date(a.updated_at || 0).getTime();
            const dateB = new Date(b.updated_at || 0).getTime();
            return dateB - dateA;
          });

        setItems(allItems);
      } catch (err: any) {
        setError(err.message || "Failed to fetch issues and PRs");
      } finally {
        setLoading(false);
      }
    }

    fetchIssuesAndPRs();
  }, []);

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <box marginBottom={1}>
        <text attributes={TextAttributes.BOLD}>Resend Organization - Open Issues & PRs</text>
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
          <text attributes={TextAttributes.DIM}>No open issues or PRs found.</text>
        </box>
      )}

      {!loading && !error && items.length > 0 && (
        <box flexDirection="column" flexGrow={1}>
          {items.map((item) => (
            <box key={item.number} flexDirection="row" marginBottom={1}>
              <box marginRight={1}>
                <text style={{ fg: item.pull_request ? colors.green : colors.yellow }}>
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
