import React, { useEffect, useRef, useState } from "react";
import { harbourTime } from "./hong-kong-time.mjs";
import { harbourTheme } from "./harbour-theme.mjs";
import github from "./data/github-repositories.json";

const base = import.meta.env.BASE_URL;
const profile = "https://github.com/tomlaws";
const email = "contact@tomlaw.dev";
const pageParams = new URLSearchParams(location.search);
const mapParams = new URLSearchParams();
if (["webgl", "webgpu"].includes(pageParams.get("renderer")))
  mapParams.set("renderer", pageParams.get("renderer"));
if (import.meta.env.DEV && pageParams.has("profile"))
  mapParams.set("profile", pageParams.get("profile") || "idle");
if (import.meta.env.DEV && ["beauty", "shaded", "ao", "glow", "glowalpha"].includes(pageParams.get("gpuStage")))
  mapParams.set("gpuStage", pageParams.get("gpuStage"));
if (import.meta.env.DEV && pageParams.has("capture")) mapParams.set("capture", "");
if (import.meta.env.DEV && pageParams.has("qaNight")) mapParams.set("qaNight", pageParams.get("qaNight"));
if (import.meta.env.DEV && pageParams.has("qaTemporal")) mapParams.set("qaTemporal", pageParams.get("qaTemporal"));
if (import.meta.env.DEV && pageParams.get("qaThread") === "main") mapParams.set("qaThread", "main");
if (import.meta.env.DEV && pageParams.get("qaWorld") === "procedural") mapParams.set("qaWorld", "procedural");
if (import.meta.env.DEV && ["compact","reference"].includes(pageParams.get("qaLighting"))) mapParams.set("qaLighting", pageParams.get("qaLighting"));
if (import.meta.env.DEV && pageParams.has("qaFullQuality")) mapParams.set("qaFullQuality", "");
const mapQuery = mapParams.size ? `?${mapParams}` : "";
const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M6 18 18 6M6 6h12v12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const Code = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const featuredNames = ["flixhk", "wordle"];
const labels = {
  flixhk: {
    title: "FLIXHK",
    detail:
      "Find movie showtimes across Hong Kong, compare ticket prices, and browse cinemas by district or screening format.",
    stack: ["Web app", "Hong Kong cinema"],
    website: "https://flixhk.com/",
  },
  wordle: {
    title: "Multiplayer Wordle",
    detail: "A multiplayer word game for the web and console, built with Go.",
    stack: ["Go", "WebSocket", "Svelte"],
  },
};
const fallbackDescriptions = {
  tomlaws: "My GitHub profile README.",
  "tomlaw-personal-website": "My personal website and portfolio.",
};

export default function Portfolio() {
  const [now, setNow] = useState(() => harbourTime());
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const frame = useRef(null);
  const firstMapFrame = useRef(false);
  const hero = useRef(null);
  useEffect(() => {
    const update = () => setNow(harbourTime());
    const timer = setInterval(update, 1000);
    const receive = (event) => {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow
      )
        return;
      if (event.data?.type === "harbour:state" && event.data.ready) {
        setMapError(false);
        setReady(true);
        if(!firstMapFrame.current){
          firstMapFrame.current=true;
          document.documentElement.dataset.mapReadyMs=String(Math.round(performance.now()));
          if(pageParams.has("profile"))console.info('[page-map-ready]',JSON.stringify({readyMs:Math.round(performance.now())}));
        }
      }
      if (event.data?.type === "harbour:error") { setReady(false); setMapError(true); }
    };
    addEventListener("message", receive);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      removeEventListener("message", receive);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    const style = harbourTheme(now.night);
    for (const [key, value] of Object.entries(style)) {
      if (key.startsWith("--"))
        document.documentElement.style.setProperty(key, value);
      else document.documentElement.style.colorScheme = value;
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", style["--background"]);
  }, [now.night]);
  const repos = [...github.repositories].sort(
    (a, b) => Number(a.fork) - Number(b.fork) || a.name.localeCompare(b.name),
  );
  const matches = repos.filter(
    (repo) =>
      (filter === "all" || (filter === "forks" ? repo.fork : !repo.fork)) &&
      `${repo.name} ${repo.description || ""} ${repo.language || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div
        className={`world-background ${ready ? "ready" : ""}`}
      >
        <iframe
          ref={frame}
          src={`${base}harbour/${mapQuery}`}
          title="Hong Kong background scene"
          tabIndex={-1}
          loading="eager"
          aria-hidden="true"
        />
        <div className="map-loading" role="status" aria-live="polite">
          <span className="map-loading-orbit" aria-hidden="true"><i /></span>
          <span>{ready ? "" : mapError ? "Map unavailable" : "Loading Hong Kong"}</span>
        </div>
      </div>
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Tom Law home">
          tom<span>law</span>
          <i />
        </a>
        <nav aria-label="Main navigation">
          <a href="#work">Work</a>
          <a href="#about">About</a>
          <a href={profile} target="_blank" rel="noreferrer">
            GitHub <Arrow />
          </a>
        </nav>
        <div className="hk-clock">
          <span className="live-dot" />
          <span>HONG KONG</span>
          <time dateTime={now.iso}>
            {now.clock}
            <small>HKT</small>
          </time>
        </div>
      </header>
      <main id="main">
        <section ref={hero} className="hero" aria-labelledby="intro-title">
          <div className="intro-copy">
            <p className="eyebrow">
              <span className="location-mark" />
              22.2845° N · 114.1589° E
            </p>
            <h1 id="intro-title">
              Tom Law<span>.</span>
            </h1>
            <p className="intro-role">
              Full Stack Developer.
              <br />
              Based in Hong Kong.
            </p>
            <p className="intro-description">
              I build applications, make things for the web, and
              explore ideas through side projects.
            </p>
            <div className="intro-links">
              <a href="#work">
                <span>My work</span>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 5v14m-6-6 6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
              <a href={`mailto:${email}`}>
                <span>Email</span> <Arrow />
              </a>
            </div>
          </div>
          <a className="scroll-note" href="#work">
            <span>KEEP SCROLLING</span>
            <span>↓</span>
          </a>
        </section>
        <div className="page-content">
          <section
            className="work-section section-wrap"
            id="work"
            aria-labelledby="work-title"
          >
            <div className="section-heading">
              <p className="eyebrow">01 / SELECTED WORK</p>
              <h2 id="work-title">
                Things I’ve built<span>.</span>
              </h2>
              <p>
                Web apps, side projects,
                <br />
                and tools I wanted to exist.
              </p>
            </div>
            <div className="featured-projects">
              {featuredNames.map((name, index) => {
                const repo = repos.find((item) => item.name === name),
                  data = labels[name],
                  homepage = data.website || repo?.homepage;
                return (
                  <article className="featured-project" key={name}>
                    <div className="project-index">
                      0{index + 1}
                      <Code />
                    </div>
                    <div className="featured-main">
                      <h3>
                        <a
                          href={data.website || repo?.html_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {data.title}
                          <Arrow />
                        </a>
                      </h3>
                      <p>{data.detail}</p>
                      <div className="project-stack">
                        {data.stack.map((stack) => (
                          <span key={stack}>{stack}</span>
                        ))}
                      </div>
                    </div>
                    <div className="project-links">
                      {repo && (
                        <a href={repo.html_url} target="_blank" rel="noreferrer">
                          Source <Arrow />
                        </a>
                      )}
                      {homepage && (
                        <a
                          href={homepage}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Visit <Arrow />
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <section
            className="repository-section section-wrap"
            id="repositories"
            aria-labelledby="repos-title"
          >
            <div className="repo-heading">
              <div>
                <p className="eyebrow">PUBLIC REPOSITORIES</p>
                <h2 id="repos-title">
                  On GitHub <span className="repo-count">{repos.length}</span>
                </h2>
              </div>
              <a
                href={`${profile}?tab=repositories`}
                target="_blank"
                rel="noreferrer"
              >
                @tomlaws <Arrow />
              </a>
            </div>
            <div className="repo-controls">
              <div
                className="repo-filters"
                role="group"
                aria-label="Filter repositories"
              >
                {[
                  ["all", "All"],
                  ["original", "Originals"],
                  ["forks", "Forks"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    aria-pressed={filter === value}
                  >
                    {label}
                    <span>
                      {value === "all"
                        ? repos.length
                        : repos.filter((repo) =>
                            value === "forks" ? repo.fork : !repo.fork,
                          ).length}
                    </span>
                  </button>
                ))}
              </div>
              <label className="repo-search">
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
                  <circle
                    cx="10"
                    cy="10"
                    r="6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="m15 15 5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a repository"
                  aria-label="Find a repository"
                />
              </label>
            </div>
            <p className="repo-result" aria-live="polite">
              {matches.length}{" "}
              {matches.length === 1 ? "repository" : "repositories"}
            </p>
            <div className="repo-list">
              {matches.map((repo) => (
                <article className="repo-row" key={repo.name}>
                  <Code />
                  <div className="repo-info">
                    <h3>
                      <a href={repo.html_url} target="_blank" rel="noreferrer">
                        {repo.name}
                        <Arrow />
                      </a>
                      {repo.fork && <span className="fork-label">Fork</span>}
                    </h3>
                    <p>
                      {repo.description ||
                        fallbackDescriptions[repo.name] ||
                        "Public repository."}
                    </p>
                  </div>
                  <span className="repo-language">{repo.language || "—"}</span>
                </article>
              ))}
            </div>
            {matches.length === 0 && (
              <p className="empty-result">No repositories match that search.</p>
            )}
            <p className="repo-source">
              Public repository list from GitHub ·{" "}
              {new Date(github.fetchedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Hong_Kong",
              })}
            </p>
          </section>
          <section
            className="about-section section-wrap"
            id="about"
            aria-labelledby="about-title"
          >
            <div>
              <p className="eyebrow">02 / A BIT ABOUT ME</p>
              <h2 id="about-title">
                Code, curiosity,
                <br />
                and Hong Kong<span>.</span>
              </h2>
            </div>
            <div className="about-copy">
              <p>
                My work spans full-stack development.
              </p>
              <p>
                Side projects are where I try other ideas: real-time games
                and this small version of the city I call home.
              </p>
              <div className="about-links">
                <a href={profile} target="_blank" rel="noreferrer">
                  GitHub <Arrow />
                </a>
                <a href={`mailto:${email}`}>
                  Email
                  <Arrow />
                </a>
              </div>
            </div>
          </section>
          <footer className="site-footer section-wrap">
            <span>Tom Law © {new Date().getFullYear()}</span>
            <a href="#">Back to top ↑</a>
          </footer>
        </div>
      </main>
    </>
  );
}
