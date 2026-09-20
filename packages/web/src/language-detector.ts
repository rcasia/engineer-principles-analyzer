import {
  HttpJevClient,
  JevLanguageDetector,
  type FetchFn,
  type LanguageDetector,
} from "@principled/core";

/**
 * Language detector for the composition roots (`bin.ts`, `lambda-entry.ts`).
 *
 * With a credential this is the Jev Choice judgment (ADR-0028). Without
 * one — LocalStack, a Lambda whose infra has not provided the key yet
 * (ADR-0037) — detection cannot judge, so the detector reports every
 * submission as undetectable instead of throwing: the request handler
 * already maps "undetected" to the 400 guidance, while a throw at startup
 * would 502 every route including the pages that need no detection at all.
 */
export function detectorFor(
  apiKey: string | undefined,
  fetchFn: FetchFn = globalThis.fetch,
): LanguageDetector {
  if (apiKey === undefined || apiKey.trim().length === 0) {
    return {
      detectLanguage: async () => undefined,
    };
  }

  return new JevLanguageDetector(new HttpJevClient({ apiKey, fetchFn }));
}
