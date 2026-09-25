import { describe, expect, it } from "bun:test";
import {
  LEGAL_PAGE_PATHS,
  legalContactFromEnvironment,
  renderLegalConfigurationError,
  renderLegalPage,
} from "./legal-page.ts";
import type { LegalPagePath } from "./legal-page.ts";

const contact = {
  operatorName: "Principled Labs S.L.",
  operatorAddress: "Calle Example 1\n28001 Madrid, Spain",
  privacyEmail: "privacy@example.test",
  securityEmail: "security@example.test",
} as const;

const PAGE_EXPECTATIONS = [
  {
    path: "/imprint",
    title: "Imprint",
    description: "Operator identity and contact details for Principled.",
    marker: "Operator",
  },
  {
    path: "/privacy",
    title: "Privacy notice",
    description:
      "How Principled processes source code, request data and privacy-safe product metrics.",
    marker: "Source code and optional filename",
  },
  {
    path: "/terms",
    title: "Terms of service",
    description: "Terms governing use of the Principled hosted analysis service.",
    marker: "Your content",
  },
  {
    path: "/acceptable-use",
    title: "Acceptable use",
    description: "Permitted and prohibited uses of the Principled analysis service.",
    marker: "Prohibited use",
  },
  {
    path: "/security",
    title: "Security",
    description: "Security controls and vulnerability disclosure for Principled.",
    marker: "Report a vulnerability",
  },
  {
    path: "/ai-transparency",
    title: "AI transparency",
    description:
      "How AI-assisted language detection and heuristic findings work in Principled.",
    marker: "What uses AI",
  },
  {
    path: "/subprocessors",
    title: "Subprocessors",
    description: "Third parties that process data for the Principled hosted service.",
    marker: "TypeSafe AI, Inc.",
  },
  {
    path: "/accessibility",
    title: "Accessibility",
    description: "Accessibility commitment and contact details for Principled.",
    marker: "Commitment",
  },
] as const;

const completeEnvironment = {
  PRINCIPLED_OPERATOR_NAME: "Principled Labs S.L.",
  PRINCIPLED_OPERATOR_ADDRESS: "Calle Example 1\n28001 Madrid, Spain",
  PRINCIPLED_PRIVACY_EMAIL: "privacy@example.test",
  PRINCIPLED_SECURITY_EMAIL: "security@example.test",
} as const;


describe("legalContactFromEnvironment", () => {
  it.each(Object.keys(completeEnvironment))(
    "requires %s",
    (missingKey) => {
      const environment = { ...completeEnvironment };
      delete environment[missingKey as keyof typeof completeEnvironment];

      expect(legalContactFromEnvironment(environment)).toBeUndefined();
    },
  );

  it.each(Object.keys(completeEnvironment))("rejects blank %s", (blankKey) => {
    const environment = {
      ...completeEnvironment,
      [blankKey]: "   ",
    };

    expect(legalContactFromEnvironment(environment)).toBeUndefined();
  });

  it("rejects malformed email configuration", () => {
    expect(
      legalContactFromEnvironment({
        PRINCIPLED_OPERATOR_NAME: "Principled Labs S.L.",
        PRINCIPLED_OPERATOR_ADDRESS: "Calle Example 1",
        PRINCIPLED_PRIVACY_EMAIL: "not-an-email",
        PRINCIPLED_SECURITY_EMAIL: "security@example.test",
      }),
    ).toBeUndefined();
  });

  it.each(["privacy@example.test trailing", "prefix privacy@example.test"])(
    "rejects an email with invalid surrounding text: %s",
    (email) => {
      expect(
        legalContactFromEnvironment({
          ...completeEnvironment,
          PRINCIPLED_PRIVACY_EMAIL: email,
        }),
      ).toBeUndefined();
    },
  );

  it("returns trimmed, complete configuration", () => {
    expect(
      legalContactFromEnvironment({
        PRINCIPLED_OPERATOR_NAME: " Principled Labs S.L. ",
        PRINCIPLED_OPERATOR_ADDRESS: " Calle Example 1\n28001 Madrid, Spain ",
        PRINCIPLED_PRIVACY_EMAIL: " privacy@example.test ",
        PRINCIPLED_SECURITY_EMAIL: " security@example.test ",
      }),
    ).toEqual(contact);
  });
});

describe("renderLegalPage", () => {
  it.each([...PAGE_EXPECTATIONS])("renders the complete %s notice", (page) => {
    const path = page.path as (typeof LEGAL_PAGE_PATHS)[number];
    const html = renderLegalPage(path, contact);

    expect(html).toStartWith("<!doctype html>");
    expect(html).toContain(`<title>${page.title} | Principled</title>`);
    expect(html).toContain(
      `<meta name="description" content="${page.description}">`,
    );
    expect(html).toContain("Last updated 26 September 2026");
    expect(html).toContain(`<link rel="canonical" href="${page.path}">`);
    expect(html).toContain(page.marker);

    if (page.path === "/privacy") {
      expect(html).toContain("Do not upload passwords, API keys, private keys");
    }

    if (page.path === "/ai-transparency") {
      expect(html).toContain("not a deterministic compiler fact");
    }
  });

  it("covers every registered legal path", () => {
    expect(PAGE_EXPECTATIONS.map((page) => page.path)).toEqual([
      ...LEGAL_PAGE_PATHS,
    ]);
  });

  it("escapes configured identity values and preserves address lines", () => {
    const html = renderLegalPage("/imprint", {
      ...contact,
      operatorName: "Name <unsafe>",
      operatorAddress: "One\nTwo & Three",
    });

    expect(html).toContain("Name &lt;unsafe&gt;");
    expect(html).toContain("One<br>Two &amp; Three");
    expect(html).not.toContain("<unsafe>");
  });

  it("rejects an unknown legal path at the renderer boundary", () => {
    expect(() =>
      renderLegalPage("/unknown" as LegalPagePath, contact),
    ).toThrow("Unknown legal page: /unknown");
  });
});

describe("renderLegalConfigurationError", () => {
  it("does not pretend an unconfigured deployment is launch-ready", () => {
    const html = renderLegalConfigurationError();

    expect(html).toContain(
      "<title>Legal configuration unavailable | Principled</title>",
    );
    expect(html).toContain(
      '<meta name="description" content="The public legal pages are not configured for this deployment.">',
    );
    expect(html).toContain('<link rel="canonical" href="/imprint">');
    expect(html).toContain(
      "must be configured before this service is exposed to users",
    );
  });
});
