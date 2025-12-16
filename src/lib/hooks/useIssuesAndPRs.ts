import { useEffect, useState } from "react";
import {
  fetchIssuesAndPRs,
  fetchIssuesAndPRsFromAPI,
  type Issue,
} from "../utils/fetch-issues-and-prs";
import { mergeIssues } from "../utils/merge-issues";
import { octokit } from "../octokit";
import { join } from "node:path";
import path from "node:path";

export function useIssuesAndPRs() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAndFetch() {
      try {
        const cachedIssues = await fetchIssuesAndPRs();
        if (isMounted) {
          setIssues(cachedIssues);
        }

        try {
          const freshIssues = await fetchIssuesAndPRsFromAPI();

          if (isMounted) {
            const mergedIssues = mergeIssues(cachedIssues, freshIssues);
            setIssues(mergedIssues);

            // Update the cache file with merged data
            const jsonPath = join(process.cwd(), "resend-issues-prs.json");
            await Bun.write(jsonPath, JSON.stringify(mergedIssues, null, 2));
            setLoading(false);
          }
        } catch (fetchError) {
          console.error("Failed to fetch fresh data:", fetchError);
          setError(String(fetchError));
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(String(err));
          setLoading(false);
        }
      }
    }

    loadAndFetch();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshIssue = async (issue: Issue) => {
    try {
      const repoName = path.basename(new URL(issue.repository_url).pathname);
      const refreshed = await octokit.issues.get({
        repo: repoName,
        owner: "resend",
        issue_number: issue.number,
      });

      const updatedIssue = refreshed.data as Issue;
      setIssues((prevIssues) => {
        const originalIndex = prevIssues.findIndex(
          (i) => i.id === updatedIssue.id,
        );
        if (originalIndex === -1) return prevIssues;
        if (updatedIssue.state === "closed") {
          return prevIssues.filter((_, index) => index !== originalIndex);
        }
        const newIssues = [...prevIssues];
        newIssues[originalIndex] = updatedIssue;
        return newIssues;
      });
    } catch (err) {
      console.error("Failed to refresh issue:", err);
    }
  };

  return {
    issues,
    loading,
    error,
    refreshIssue,
  };
}
