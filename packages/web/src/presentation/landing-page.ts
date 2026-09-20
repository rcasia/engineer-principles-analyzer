import { renderPage } from "./layout.ts";
import { VERSION } from "../version.ts";

export const LANDING_PAGE_TITLE = "Principled";

export const LANDING_PAGE_DESCRIPTION =
  "Principled evaluates source code against explicit engineering principles and returns evidence-backed findings — judgments you can check, not just trust.";

/**
 * The four steps of the workflow, in the order a finding is produced. The
 * copy describes the mechanism the analyzer has today; it makes no claim
 * about accuracy, only about what a finding contains.
 */
const STEPS: readonly {
  readonly title: string;
  readonly copy: string;
}[] = [
  {
    title: "Principles",
    copy: "The standard is written down: what good looks like, the decisions it guards and the cost of ignoring it. Together the principles are the engineering contract.",
  },
  {
    title: "Semantic analysis",
    copy: "Rules examine the structure of the subject — its dependencies, boundaries, members and call sites — where design problems actually live.",
  },
  {
    title: "Evidence + judgment",
    copy: "Every finding quotes the exact lines it judged, names the rule behind it and carries a confidence. Uncertain results are labeled uncertain, never hidden.",
  },
  {
    title: "Actionable finding",
    copy: "A verdict, an explanation in the principle's terms and — where the rule knows one — a suggested fix, so the next step is concrete.",
  },
];

function renderStep(step: (typeof STEPS)[number], index: number): string {
  return `<article class="panel span-6">
  <p class="panel__label">Step 0${index + 1}</p>
  <h3 class="card-title">${step.title}</h3>
  <p class="card-copy">${step.copy}</p>
</article>`;
}

/**
 * The illustrative finding (#52): the shape of a real result — status,
 * method, confidence, rule id, explanation — with made-up content, so the
 * label says it is an illustration. It is never rendered as if it were an
 * actual analysis.
 */
function renderDemoFinding(): string {
  return `<article class="panel span-6" aria-labelledby="demo-finding-heading">
  <p class="panel__label">Illustrative finding</p>
  <div class="status-row">
    <span class="badge badge--error">Violation</span>
    <span class="badge">heuristic</span>
    <span class="badge">68% confidence</span>
  </div>
  <h3 id="demo-finding-heading" class="card-title">solid.srp</h3>
  <p class="card-copy">The class carries both persistence and notification duties; extract the notifier.</p>
  <p class="type-mono">Evidence: quoted lines &middot; Fix: suggested</p>
</article>`;
}

/**
 * The landing page (`/`): what Principled is, the gap it fills next to
 * deterministic tooling, how a finding is produced and where to try it.
 * Written to be understood without any prior context (#52), and honest:
 * web analysis is single-file today, and nothing on this page claims a
 * success rate.
 */
export function renderLandingPage(): string {
  return renderPage({
    title: LANDING_PAGE_TITLE,
    description: LANDING_PAGE_DESCRIPTION,
    path: "/",
    mainClass: "playground",
    body: `<header class="intro">
  <div>
    <p class="eyebrow">Engineering judgment, made explicit</p>
    <h1>Code review arguments, written down and checked.</h1>
    <p class="lede">Principled evaluates source code against explicit engineering principles — dependency direction, single responsibility, interface design — and returns structured findings: a judgment, the code evidence behind it, and how much to trust it. It does not replace compilers, linters or tests; it covers the design questions they cannot answer.</p>
    <div class="button-row hero__actions">
      <a class="button button--primary" href="/analyze">Analyze a file →</a>
      <a class="button" href="/principles">Read the principles</a>
    </div>
  </div>
  <dl class="intro__facts">
    <div><dt>Checks</dt><dd>structure, not style</dd></div>
    <div><dt>Rules today</dt><dd>5 SOLID heuristics</dd></div>
    <div><dt>Web scope</dt><dd>single files</dd></div>
    <div><dt>Submissions</dt><dd>never stored</dd></div>
  </dl>
</header>
<section class="section" aria-labelledby="gap-heading">
  <header class="section__header">
    <span class="section__index">01 / The gap</span>
    <div>
      <h2 id="gap-heading">Certain tools, judgment calls</h2>
      <p class="section__description">Compilers say whether code builds. Linters say whether it breaks a rule with a known answer. Tests say whether behavior matches expectations. Whether the design is sound is still argued in review, as opinion — Principled exists for that argument, so it complements those tools instead of competing with them.</p>
    </div>
  </header>
  <div class="demo-grid">
    <article class="panel span-6">
      <p class="panel__label">What deterministic tools answer</p>
      <ul class="panel__list">
        <li>Does it compile?</li>
        <li>Does it match a known lint rule?</li>
        <li>Does the behavior pass the tests?</li>
      </ul>
      <p class="type-mono">Certain answers &rarr; automatic checks.</p>
    </article>
    <article class="panel span-6">
      <p class="panel__label">What design review answers</p>
      <ul class="panel__list">
        <li>Do dependencies point inward?</li>
        <li>Does this class change for one reason?</li>
        <li>Can every implementer honor this interface?</li>
      </ul>
      <p class="type-mono">Judgment calls &rarr; written standards.</p>
    </article>
  </div>
</section>
<section class="section" aria-labelledby="how-heading">
  <header class="section__header">
    <span class="section__index">02 / How it works</span>
    <div>
      <h2 id="how-heading">From principle to finding, in four steps</h2>
      <p class="section__description">Each step is inspectable: the contract says what was checked, the evidence shows what it was checked against, and the confidence states how much the judgment deserves trust.</p>
    </div>
  </header>
  <div class="demo-grid">
    ${STEPS.map(renderStep).join("\n    ")}
  </div>
</section>
<section class="section" aria-labelledby="try-heading">
  <header class="section__header">
    <span class="section__index">03 / Try it</span>
    <div>
      <h2 id="try-heading">Run it on a file you know</h2>
      <p class="section__description">The playground analyzes one source file at a time — paste it, upload it, or start from a worked example. Nothing is stored; every visit gets a fresh analysis.</p>
    </div>
  </header>
  <div class="demo-grid">
    <article class="panel span-6">
      <p class="panel__label">The analyzer</p>
      <p class="card-copy">Submit a source file and read back what the five SOLID rules find in it: the verdict per rule, the lines it judged, the confidence and — where known — the suggested fix.</p>
      <div class="button-row">
        <a class="button button--primary" href="/analyze">Open the analyzer →</a>
        <a class="button button--quiet" href="/principles">How principles work</a>
      </div>
    </article>
    ${renderDemoFinding()}
  </div>
  <p class="playground__note">Findings are judgments with visible evidence, not build failures — confirm before acting. v${VERSION}</p>
</section>`,
  });
}
