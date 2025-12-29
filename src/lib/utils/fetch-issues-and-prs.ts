import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { octokit } from "../octokit";

export type Issue = Awaited<
  ReturnType<typeof octokit.rest.search.issuesAndPullRequests>
>["data"]["items"][number];

async function getArchivedRepositoryUrls(
  organization: string,
): Promise<Set<string>> {
  // If search fails, fall back to listing all org repos (works for public orgs)
  const repositories = await octokit.paginate(octokit.rest.repos.listForOrg, {
    org: organization,
    type: "public",
    per_page: 100,
  });
  return new Set(
    repositories.filter((repo) => repo.archived).map((repo) => repo.url),
  );
}

export async function fetchIssuesAndPRs(organization: string) {
  const jsonPath = join(process.cwd(), `.cache/${organization}.json`);
  if (!existsSync(jsonPath)) {
    return [];
  }

  // Load issues and PRs from JSON file
  const fileContent = await readFile(jsonPath, "utf-8");
  const issues: Issue[] = JSON.parse(fileContent);

  // Fetch repository information and filter out archived repositories
  const archivedRepos = await getArchivedRepositoryUrls(organization);

  return issues.filter((issue) => !archivedRepos.has(issue.repository_url));
}

// Keep the original fetch logic for later use
export async function fetchIssuesAndPRsFromAPI(organization: string) {
  // Fetch all open issues and PRs from resend organization using search API with pagination
  const [issues, prs] = await Promise.all([
    octokit.paginate(octokit.rest.search.issuesAndPullRequests, {
      q: `org:${organization} type:issue state:open`,
      sort: "updated",
      order: "desc",
      per_page: 100,
    }),
    octokit.paginate(octokit.rest.search.issuesAndPullRequests, {
      q: `org:${organization} type:pr state:open`,
      sort: "updated",
      order: "desc",
      per_page: 100,
    }),
  ]);

  // Combine issues and PRs, filter out bots, owners, maintainers, and archived repos, then sort by updated date
  const allItems = [...issues, ...prs];

  // Filter out bots, owners, and maintainers first
  const filteredItems = allItems.filter((item) => {
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
  });

  // Fetch repository information and filter out archived repositories
  const archivedRepos = await getArchivedRepositoryUrls(organization);

  return filteredItems
    .filter((item) => !archivedRepos.has(item.repository_url))
    .sort((a, b) => {
      const dateA = new Date(a.updated_at || 0).getTime();
      const dateB = new Date(b.updated_at || 0).getTime();
      return dateB - dateA;
    });
}
