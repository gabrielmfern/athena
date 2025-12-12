import { octokit } from "../octokit";

export type Issue = Awaited<
  ReturnType<typeof octokit.rest.search.issuesAndPullRequests>
>["data"]["items"][number];

export async function fetchIssuesAndPRs() {
  // Fetch all open issues and PRs from resend organization using search API with pagination
  const [issues, prs] = await Promise.all([
    octokit.paginate(octokit.rest.search.issuesAndPullRequests, {
      q: "org:resend type:issue state:open",
      sort: "updated",
      order: "desc",
      per_page: 100,
    }),
    octokit.paginate(octokit.rest.search.issuesAndPullRequests, {
      q: "org:resend type:pr state:open",
      sort: "updated",
      order: "desc",
      per_page: 100,
    }),
  ]);

  // Combine issues and PRs, filter out bots, owners, and maintainers, then sort by updated date
  return [...issues, ...prs]
    .filter((item) => {
      if (!item.user) return true;

      const username = item.user.login.toLowerCase();
      const isBot = item.user.type === "Bot" || username.endsWith("[bot]");
      // Filter out OWNER, MEMBER, and MAINTAINER associations
      const isOrgMaintainer =
        item.author_association === "OWNER" ||
        item.author_association === "MEMBER" ||
        item.author_association === "COLLABORATOR" ||
        item.author_association === "MANNEQUIN";
      return !isBot && !isOrgMaintainer;
    })
    .sort((a, b) => {
      const dateA = new Date(a.updated_at || 0).getTime();
      const dateB = new Date(b.updated_at || 0).getTime();
      return dateB - dateA;
    });
}
