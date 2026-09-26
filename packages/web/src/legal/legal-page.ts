import { escapeHtml, renderPage } from "../shared/layout.ts";

export const LEGAL_PAGE_PATHS = [
  "/imprint",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/security",
  "/ai-transparency",
  "/subprocessors",
  "/accessibility",
] as const;

export type LegalPagePath = (typeof LEGAL_PAGE_PATHS)[number];

export interface LegalContact {
  readonly operatorName: string;
  /**
   * Domicile published on the imprint. Optional for personal, non-economic
   * projects outside LSSI art.10 scope (ADR-0043): GDPR transparency is met
   * with name plus contact emails, and no home address is published.
   * Economic operators must still set it (LSSI art.10.1.a).
   */
  readonly operatorAddress?: string | undefined;
  readonly privacyEmail: string;
  readonly securityEmail: string;
}

/**
 * Legal identity is deployment configuration, not source code. Returning
 * undefined for incomplete configuration lets local tests and LocalStack boot
 * while the production Terraform precondition prevents an incomplete launch.
 *
 * Only the operator name and the two contact emails are required: the
 * domicile stays optional so a personal, free project without economic
 * activity (outside LSSI art.10 scope, ADR-0043) is not forced to publish a
 * home address. A blank address is treated as absent, not as a failure.
 */
export function legalContactFromEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): LegalContact | undefined {
  const operatorName = environment["PRINCIPLED_OPERATOR_NAME"]?.trim();
  const rawAddress = environment["PRINCIPLED_OPERATOR_ADDRESS"]?.trim();
  const operatorAddress =
    rawAddress === undefined || rawAddress.length === 0
      ? undefined
      : rawAddress;
  const privacyEmail = environment["PRINCIPLED_PRIVACY_EMAIL"]?.trim();
  const securityEmail = environment["PRINCIPLED_SECURITY_EMAIL"]?.trim();

  if (
    operatorName === undefined ||
    operatorName.length === 0 ||
    !isEmail(privacyEmail) ||
    !isEmail(securityEmail)
  ) {
    return undefined;
  }

  return { operatorName, operatorAddress, privacyEmail, securityEmail };
}

function isEmail(value: string | undefined): value is string {
  return value !== undefined && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function contactBlock(contact: LegalContact): string {
  const address =
    contact.operatorAddress === undefined
      ? ""
      : `  <p>${escapeHtml(contact.operatorAddress).replaceAll("\n", "<br>")}</p>\n`;
  return `<div class="legal-contact">
  <p><strong>${escapeHtml(contact.operatorName)}</strong></p>
${address}  <p>Privacy: <a href="mailto:${escapeHtml(contact.privacyEmail)}">${escapeHtml(contact.privacyEmail)}</a></p>
  <p>Security: <a href="mailto:${escapeHtml(contact.securityEmail)}">${escapeHtml(contact.securityEmail)}</a></p>
</div>`;
}

function notice(copy: string): string {
  return `<aside class="notice" role="note"><div><strong>Important</strong><p>${copy}</p></div></aside>`;
}

function documentShell(options: {
  readonly title: string;
  readonly description: string;
  readonly path: LegalPagePath;
  readonly body: string;
},
): string {
  return renderPage({
    title: `${options.title} | Principled`,
    description: options.description,
    path: options.path,
    body: `<header class="page-header">
  <p class="eyebrow">Legal and trust</p>
  <h1>${options.title}</h1>
  <p class="lede">Last updated 26 September 2026.</p>
</header>
${options.body}
<p class="legal-contact-link">Questions? <a href="/imprint">View operator and contact details</a>.</p>`,
  });
}

function imprintPage(contact: LegalContact): string {
  return documentShell({
    title: "Imprint",
    description: "Operator identity and contact details for Principled.",
    path: "/imprint",
    body: `<section class="legal-section" aria-labelledby="operator-heading">
  <h2 id="operator-heading">Operator</h2>
  ${contactBlock(contact)}
  <p>These details identify the operator responsible for this website and its hosted analysis service.</p>
</section>
<section class="legal-section" aria-labelledby="service-heading">
  <h2 id="service-heading">Service</h2>
  <p>Principled is a source-code analysis service that evaluates one submitted source file against documented engineering principles. The service is not a compiler, security scanner or substitute for human review.</p>
</section>`,
  });
}

function privacyPage(contact: LegalContact): string {
  return documentShell({
    title: "Privacy notice",
    description: "How Principled processes source code, request data and privacy-safe product metrics.",
    path: "/privacy",
    body: `${notice("Do not upload passwords, API keys, private keys or other secrets. Submitted source is sent to the language-detection provider described below when that integration is configured.")}
<section class="legal-section" aria-labelledby="controller-heading">
  <h2 id="controller-heading">Controller and contact</h2>
  ${contactBlock(contact)}
  <p>For privacy questions or rights requests, use the privacy address above. We will verify the request where necessary and respond within the period required by applicable law.</p>
</section>
<section class="legal-section" aria-labelledby="data-heading">
  <h2 id="data-heading">What we process</h2>
  <table class="table"><caption class="visually-hidden">Principled processing activities</caption><thead><tr><th scope="col">Data</th><th scope="col">Purpose</th><th scope="col">Retention</th></tr></thead><tbody>
    <tr><td>Source code and optional filename</td><td>Detect its language and run the requested analysis</td><td>In memory for the request; not stored by the application</td></tr>
    <tr><td>Request and security metadata</td><td>Deliver the service, prevent abuse and maintain availability</td><td>Application log group is configured for up to 7 days</td></tr>
    <tr><td>Aggregate analysis metrics</td><td>Measure request volume, failures, latency, languages and rules</td><td>In memory per Lambda environment; no source, findings or identifiers</td></tr>
  </tbody></table>
  <p>We do not require an account, use advertising trackers, set cookies or use local storage for identity. The application does not intentionally log request bodies, source code, findings, credentials or authorization headers.</p>
</section>
<section class="legal-section" aria-labelledby="analysis-data-heading">
  <h2 id="analysis-data-heading">Hosted analysis and providers</h2>
  <p>The request is handled by AWS in the configured region, currently <code>eu-west-1</code>. When language detection is enabled, the source text and filename hint are sent to TypeSafe AI, Inc. for that single language-detection call. TypeSafe processes input under its DPA and states that it does not train or fine-tune models on customer input. See the <a href="/subprocessors">subprocessor register</a> for provider details and transfer safeguards.</p>
  <p>Analysis results are returned to your browser and are not persisted by the application. CDN and analysis responses use separate cache directives; submitted requests use <code>no-store</code> and <code>private</code>.</p>
</section>
<section class="legal-section" aria-labelledby="rights-heading">
  <h2 id="rights-heading">Your rights</h2>
  <p>Depending on applicable law, you may request access, correction, deletion, restriction, portability or object to processing. You may also complain to the Spanish Data Protection Agency (AEPD) or another competent supervisory authority. Contact us first at <a href="mailto:${escapeHtml(contact.privacyEmail)}">${escapeHtml(contact.privacyEmail)}</a>.</p>
</section>
<section class="legal-section" aria-labelledby="transfers-heading">
  <h2 id="transfers-heading">International transfers</h2>
  <p>AWS hosting is in Ireland. TypeSafe AI, Inc. is based in the United States; transfers to TypeSafe rely on its DPA and the applicable EU Standard Contractual Clauses. The service does not offer a data-residency guarantee beyond the stated hosting configuration.</p>
</section>`,
  });
}

function termsPage(contact: LegalContact): string {
  return documentShell({
    title: "Terms of service",
    description: "Terms governing use of the Principled hosted analysis service.",
    path: "/terms",
    body: `<section class="legal-section" aria-labelledby="scope-heading">
  <h2 id="scope-heading">1. The service</h2>
  <p>Principled accepts one source file at a time and returns probabilistic engineering findings. The service may be unavailable, may change, and may produce incomplete or incorrect results.</p>
</section>
<section class="legal-section" aria-labelledby="content-heading">
  <h2 id="content-heading">2. Your content</h2>
  <p>You retain ownership of source code and other material you submit. You grant the operator and its service providers a limited, non-exclusive licence to process that material only to provide, secure and improve the requested service as described in the <a href="/privacy">Privacy notice</a>. We do not use submitted content to train or fine-tune models.</p>
  <p>You must have the right to submit the material and must remove secrets and personal data that are not necessary for the requested analysis.</p>
</section>
<section class="legal-section" aria-labelledby="output-heading">
  <h2 id="output-heading">3. Findings and human review</h2>
  <p>Findings are heuristic or AI-assisted, depending on the displayed method. They are not legal, security, compliance, employment or professional advice, and must not be treated as a deterministic compiler result. You are responsible for reviewing evidence and deciding what action to take.</p>
</section>
<section class="legal-section" aria-labelledby="use-heading">
  <h2 id="use-heading">4. Acceptable use and suspension</h2>
  <p>Use the service only for lawful purposes and only with material you are authorised to submit. Do not upload malware or credentials, probe the infrastructure, bypass controls, interfere with another user's access, or use findings to rank, monitor or make employment decisions about an individual.</p>
  <p>We may restrict access when reasonably necessary to protect the service, users or third parties.</p>
</section>
<section class="legal-section" aria-labelledby="warranty-heading">
  <h2 id="warranty-heading">5. Availability and liability</h2>
  <p>To the extent permitted by law, the service is provided without a guarantee that it will be uninterrupted, error-free or fit for a particular purpose. Nothing here excludes rights or liability that cannot lawfully be excluded.</p>
  <p>Questions about these terms may be sent to <a href="mailto:${escapeHtml(contact.privacyEmail)}">${escapeHtml(contact.privacyEmail)}</a>.</p>
</section>`,
  });
}

function acceptableUsePage(contact: LegalContact): string {
  return documentShell({
    title: "Acceptable use",
    description: "Permitted and prohibited uses of the Principled analysis service.",
    path: "/acceptable-use",
    body: `<section class="legal-section" aria-labelledby="permitted-heading">
  <h2 id="permitted-heading">Permitted use</h2>
  <ul><li>Submit source code you are authorised to process.</li><li>Use findings to support engineering review and learning.</li><li>Report suspected vulnerabilities privately to <a href="mailto:${escapeHtml(contact.securityEmail)}">${escapeHtml(contact.securityEmail)}</a>.</li></ul>
</section>
<section class="legal-section" aria-labelledby="prohibited-heading">
  <h2 id="prohibited-heading">Prohibited use</h2>
  <ul><li>Upload credentials, private keys, malware or data you are not authorised to process.</li><li>Attempt to access another user's submissions or bypass cache, authentication or abuse controls.</li><li>Use the service for unlawful discrimination, employment screening, worker monitoring or individual developer performance ranking.</li><li>Use automated traffic that degrades availability or materially exceeds ordinary interactive use.</li></ul>
</section>
<section class="legal-section" aria-labelledby="enforcement-heading">
  <h2 id="enforcement-heading">Enforcement</h2>
  <p>We may investigate abuse, limit requests, suspend access and preserve the minimum information necessary to protect the service or comply with law. See the <a href="/terms">Terms of service</a> and <a href="/privacy">Privacy notice</a>.</p>
</section>`,
  });
}

function securityPage(contact: LegalContact): string {
  return documentShell({
    title: "Security",
    description: "Security controls and vulnerability disclosure for Principled.",
    path: "/security",
    body: `<section class="legal-section" aria-labelledby="report-heading">
  <h2 id="report-heading">Report a vulnerability</h2>
  <p>Report security issues privately to <a href="mailto:${escapeHtml(contact.securityEmail)}">${escapeHtml(contact.securityEmail)}</a>. Include enough detail to reproduce the issue, but do not include live credentials or unrelated personal data. Please do not publicly disclose an issue before we have had a reasonable opportunity to investigate.</p>
</section>
<section class="legal-section" aria-labelledby="controls-heading">
  <h2 id="controls-heading">Controls</h2>
  <ul><li>HTTPS is enforced at the CDN and the origin uses TLS.</li><li>Security headers are emitted by the application as well as the CDN.</li><li>Submitted analysis responses are <code>private</code> and <code>no-store</code>; static pages and immutable bundles use separate cache policies.</li><li>The production function is reachable through the CloudFront origin path, not a public application endpoint.</li><li>Source code and complete findings are excluded from event history and aggregate metrics.</li><li>Application log retention is capped at 7 days.</li><li>Dependencies are audited in the delivery pipeline.</li></ul>
  <p>These controls reduce risk but cannot guarantee that an electronic service is invulnerable. Remove secrets before submission; the service does not promise to detect or redact every secret.</p>
</section>`,
  });
}

function aiTransparencyPage(contact: LegalContact): string {
  return documentShell({
    title: "AI transparency",
    description: "How AI-assisted language detection and heuristic findings work in Principled.",
    path: "/ai-transparency",
    body: `${notice("Principled output is not a deterministic compiler fact. Review the evidence, limitations and confidence before acting.")}
<section class="legal-section" aria-labelledby="systems-heading">
  <h2 id="systems-heading">What uses AI</h2>
  <p>When configured, TypeSafe Jev performs language detection from the submitted source and optional filename. The five shipped SOLID rules currently produce deterministic or heuristic findings in the application; they do not claim certainty and expose confidence, evidence and limitations.</p>
  <p>If language detection is unavailable, the service labels the language unknown and continues where possible. No employment, hiring, worker-monitoring or individual-performance decision is supported or intended.</p>
</section>
<section class="legal-section" aria-labelledby="human-heading">
  <h2 id="human-heading">Human oversight</h2>
  <p>Every applicable finding displays its method, confidence, evidence, limitations and whether human review is recommended. You remain responsible for validating the source, context and proposed remediation.</p>
</section>
<section class="legal-section" aria-labelledby="provider-heading">
  <h2 id="provider-heading">Provider and questions</h2>
  <p>TypeSafe receives source text for the language-detection request when that integration is enabled. See <a href="/privacy">Privacy notice</a> and <a href="/subprocessors">Subprocessors</a>. Questions about automated processing may be sent to <a href="mailto:${escapeHtml(contact.privacyEmail)}">${escapeHtml(contact.privacyEmail)}</a>.</p>
</section>`,
  });
}

function subprocessorsPage(contact: LegalContact): string {
  return documentShell({
    title: "Subprocessors",
    description: "Third parties that process data for the Principled hosted service.",
    path: "/subprocessors",
    body: `<section class="legal-section" aria-labelledby="register-heading">
  <h2 id="register-heading">Register</h2>
  <table class="table"><caption class="visually-hidden">Principled subprocessors</caption><thead><tr><th scope="col">Provider</th><th scope="col">Purpose</th><th scope="col">Data</th><th scope="col">Location and safeguards</th></tr></thead><tbody>
    <tr><td>AWS</td><td>CloudFront, Lambda and CloudWatch hosting</td><td>Requests, transient source code and operational logs</td><td>eu-west-1; AWS Data Processing Addendum and applicable transfer safeguards</td></tr>
    <tr><td>TypeSafe AI, Inc.</td><td>Jev language detection</td><td>Submitted source and optional filename</td><td>United States; TypeSafe DPA, EU SCCs and provider subprocessor register</td></tr>
  </tbody></table>
  <p>TypeSafe states that it does not train or fine-tune models on customer input. Its DPA permits subprocessors under its published register. We will update this page before adding another provider or processing purpose.</p>
</section>
<section class="legal-section" aria-labelledby="subprocessor-requests-heading">
  <h2 id="subprocessor-requests-heading">Questions and objections</h2>
  <p>For privacy questions about a provider, contact <a href="mailto:${escapeHtml(contact.privacyEmail)}">${escapeHtml(contact.privacyEmail)}</a>. Customer-contractual DPA terms are available on request where applicable.</p>
</section>`,
  });
}

function accessibilityPage(contact: LegalContact): string {
  return documentShell({
    title: "Accessibility",
    description: "Accessibility commitment and contact details for Principled.",
    path: "/accessibility",
    body: `<section class="legal-section" aria-labelledby="commitment-heading">
  <h2 id="commitment-heading">Commitment</h2>
  <p>We aim to make Principled usable with keyboard navigation, screen readers, high-contrast modes, reduced motion and small screens. The interface uses semantic HTML, labelled landmarks, visible focus styles, a skip link and a no-JavaScript submission path.</p>
  <p>The target is WCAG 2.2 AA. This statement is not a claim that every page or third-party service conforms in every situation; we continue to test and fix defects.</p>
</section>
<section class="legal-section" aria-labelledby="feedback-heading">
  <h2 id="feedback-heading">Feedback</h2>
  <p>Tell us about an accessibility barrier at <a href="mailto:${escapeHtml(contact.privacyEmail)}">${escapeHtml(contact.privacyEmail)}</a>. Include the page, the task you were trying to complete and the assistive technology or browser involved if known. We will use the report to improve the service and provide a reasonable alternative where possible.</p>
</section>`,
  });
}

export function renderLegalPage(
  path: LegalPagePath,
  contact: LegalContact,
): string {
  switch (path) {
    case "/imprint":
      return imprintPage(contact);
    case "/privacy":
      return privacyPage(contact);
    case "/terms":
      return termsPage(contact);
    case "/acceptable-use":
      return acceptableUsePage(contact);
    case "/security":
      return securityPage(contact);
    case "/ai-transparency":
      return aiTransparencyPage(contact);
    case "/subprocessors":
      return subprocessorsPage(contact);
    case "/accessibility":
      return accessibilityPage(contact);
    default: {
      const unreachable: never = path;
      throw new Error(`Unknown legal page: ${unreachable}`);
    }
  }
}

export function renderLegalConfigurationError(): string {
  return renderPage({
    title: "Legal configuration unavailable | Principled",
    description: "The public legal pages are not configured for this deployment.",
    path: "/imprint",
    body: `<header class="page-header">
  <p class="eyebrow">Legal and trust</p>
  <h1>Legal pages unavailable</h1>
  <p class="lede">This deployment has not supplied the operator identity and contact details required for public launch. The deployment must be configured before this service is exposed to users.</p>
</header>`,
  });
}
