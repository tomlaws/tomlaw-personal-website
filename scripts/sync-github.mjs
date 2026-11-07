import { writeFile } from "node:fs/promises";

const fields = [
  "name",
  "description",
  "html_url",
  "homepage",
  "language",
  "fork",
  "archived",
  "stargazers_count",
  "topics",
  "pushed_at",
];
const repositories = [];
// These public repositories are intentionally omitted from the portfolio.
const excludedRepositories = new Set(["vscode-nord-proxy"]);
let url =
  "https://api.github.com/users/tomlaws/repos?per_page=100&type=owner&sort=updated";
while (url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Tom-Law-Portfolio",
    },
  });
  if (!response.ok)
    throw new Error(`GitHub public repositories: HTTP ${response.status}`);
  const page = await response.json();
  for (const repo of page) {
    if (repo.private || excludedRepositories.has(repo.name)) continue;
    repositories.push(
      Object.fromEntries(fields.map((field) => [field, repo[field] ?? null])),
    );
  }
  url =
    response.headers.get("link")?.match(/<([^>]+)>; rel="next"/)?.[1] || null;
}
await writeFile(
  new URL("../src/data/github-repositories.json", import.meta.url),
  JSON.stringify(
    { username: "tomlaws", fetchedAt: new Date().toISOString(), repositories },
    null,
    2,
  ) + "\n",
);
console.log(
  `Synced ${repositories.length} public repositories (${repositories.filter((repo) => repo.fork).length} forks) from @tomlaws.`,
);
