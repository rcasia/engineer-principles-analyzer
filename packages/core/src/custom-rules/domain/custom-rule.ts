import { err, ok, type Result } from "../../shared/result.ts";
import { RuleVersion } from "./rule-version.ts";

export class InvalidCustomRuleError extends Error {
  override readonly name = "InvalidCustomRuleError";
}

export const CUSTOM_RULE_STATUSES = ["draft", "active", "deprecated"] as const;

export type CustomRuleStatus = (typeof CUSTOM_RULE_STATUSES)[number];

export function isCustomRuleStatus(value: string): value is CustomRuleStatus {
  return value === "draft" || value === "active" || value === "deprecated";
}

export interface CustomRuleDefinitionProps {
  /** Stable identity, e.g. `"acme.no-console"`. Never reused across rules. */
  readonly id: string;
  /** Numeric `MAJOR[.MINOR[.PATCH]]`; a new version per update. */
  readonly version: string;
  /** Author or source, e.g. a team name. Own evaluation metadata, not a tracking field. */
  readonly author: string;
  readonly description?: string;
  readonly status: CustomRuleStatus;
}

/**
 * A custom analysis rule as a versioned domain concept (#24, #40): identity
 * plus version plus provenance. The definition is data; the executable rule
 * implements the `VersionedRule` port. Historical analysis identifies which
 * version produced a finding through the evaluation events, which retain
 * both ids (see `domain/custom-rule-event.ts`).
 */
export class CustomRuleDefinition {
  private constructor(
    readonly id: string,
    readonly version: RuleVersion,
    readonly author: string,
    readonly description: string | undefined,
    readonly status: CustomRuleStatus,
  ) {}

  static of(
    props: CustomRuleDefinitionProps,
  ): Result<CustomRuleDefinition, InvalidCustomRuleError> {
    if (props.id.trim().length === 0) {
      return err(
        new InvalidCustomRuleError("rule id must not be empty."),
      );
    }

    const version = RuleVersion.of(props.version);
    if (!version.ok) {
      return err(new InvalidCustomRuleError(version.error.message));
    }

    if (props.author.trim().length === 0) {
      return err(
        new InvalidCustomRuleError("author/source must not be empty."),
      );
    }

    if (!isCustomRuleStatus(props.status)) {
      return err(
        new InvalidCustomRuleError(
          `status must be "draft", "active" or "deprecated", got "${props.status}".`,
        ),
      );
    }

    return ok(
      new CustomRuleDefinition(
        props.id,
        version.value,
        props.author,
        props.description,
        props.status,
      ),
    );
  }

  /** The historical pin cited by findings: `"id@version"`. */
  get key(): string {
    return `${this.id}@${this.version.toString()}`;
  }
}

export interface PublicationAuthorization {
  /** Explicit authorization to publish. Absent or `false`: deny. */
  readonly authorized: boolean;
}

/**
 * Whether a custom rule may be published publicly (#40 "private/custom
 * rules are not published publicly without authorization"): only `active`
 * rules with explicit authorization. Deny by default — an omitted or false
 * authorization never publishes, whatever the status.
 */
export function isPublicationAllowed(
  definition: CustomRuleDefinition,
  authorization: PublicationAuthorization,
): boolean {
  return definition.status === "active" && authorization.authorized;
}
