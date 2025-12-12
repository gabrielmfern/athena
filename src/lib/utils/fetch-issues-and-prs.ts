import { octokit } from "../octokit";

export interface IssueOrPR {
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

export async function fetchIssuesAndPRs() {
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

  return allItems;
}

