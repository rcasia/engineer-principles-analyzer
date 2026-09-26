import { GetParameterCommand } from "@aws-sdk/client-ssm";

/**
 * Reads one SSM Parameter Store value, decrypted. The only SSM touchpoint
 * behind the Jev API key (ADR-0045): the Lambda execution role — not the
 * deploy pipeline, not GitHub — is what may read the secret, so rotation
 * is a `put-parameter` with no redeploy and CI never sees the value.
 */
export interface SsmParameterReader {
  readParameter(name: string): Promise<string | undefined>;
}

/** Minimal `SSMClient` surface this module uses, so tests inject a stub. */
export type SsmSendFn = (
  command: GetParameterCommand,
) => Promise<{ readonly Parameter?: { readonly Value?: string } | undefined }>;

/**
 * Live SSM reader. Decryption happens server-side (`WithDecryption`), so
 * the value arrives usable and never travels further than this process:
 * callers hand it straight to the Jev client (ADR-0028), never to logs,
 * metrics or the event store.
 */
export class SsmParameterStore implements SsmParameterReader {
  private readonly client: { readonly send: SsmSendFn };

  constructor(client: { readonly send: SsmSendFn }) {
    this.client = client;
  }

  async readParameter(name: string): Promise<string | undefined> {
    const outcome = await this.client.send(
      new GetParameterCommand({ Name: name, WithDecryption: true }),
    );
    const value = outcome.Parameter?.Value;

    if (value === undefined || value.trim().length === 0) {
      return undefined;
    }

    return value;
  }
}

/** Where `apiKeyFor` looks, in order. Both arrive as Lambda env vars. */
export interface ApiKeyEnvironment {
  /**
   * A literal key (local runs, one-off debugging). Wins over SSM: an
   * operator who sets it explicitly means it.
   */
  readonly directApiKey?: string | undefined;
  /**
   * Name of the SSM parameter holding the key (real AWS, wired by
   * Terraform as `TYPESAFE_API_KEY_SSM_PARAMETER`). A name, never a
   * value — safe to show in plans and outputs.
   */
  readonly ssmParameterName?: string | undefined;
}

/**
 * Resolves the Jev API key for one cold start: the literal env var first,
 * then the named SSM parameter, then `undefined` (keyless). Anything the
 * reader throws — missing parameter, denied access, unreachable endpoint —
 * resolves to `undefined` here: a credential problem degrades one feature
 * (detection runs `"unknown"`, ADR-0040/ADR-0044), never the cold start
 * itself (ADR-0037).
 */
export async function apiKeyFor(
  env: ApiKeyEnvironment,
  reader: SsmParameterReader,
): Promise<string | undefined> {
  const direct = env.directApiKey?.trim();

  if (direct !== undefined && direct.length > 0) {
    return direct;
  }

  const parameterName = env.ssmParameterName?.trim();

  if (parameterName === undefined || parameterName.length === 0) {
    return undefined;
  }

  // A rejection resolves keyless: `.catch` keeps the fallback on the same
  // expression as the read, so no branch can silently swallow it and no
  // equivalent empty-block mutant survives.
  return reader.readParameter(parameterName).catch(() => undefined);
}
