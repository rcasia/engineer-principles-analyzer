import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { exampleIdOf, enhanceExampleSwitching } from "./example-switcher.ts";

function switcherDom(options?: {
  readonly textareaTag?: string;
  readonly withFileInput?: boolean;
  readonly links?: readonly string[];
}): {
  window: InstanceType<typeof Window>;
  document: Document;
  textarea: Element | null;
  form: HTMLFormElement | null;
} {
  const window = new Window();
  const document = window.document as unknown as Document;
  const textareaTag = options?.textareaTag ?? "textarea";
  const fileInput =
    options?.withFileInput === false
      ? ""
      : `<input id="sourceFile" name="sourceFile" type="file">`;
  const links = (options?.links ?? [
    "single-responsibility",
    "hexagonal-violation",
  ])
    .map(
      (id) =>
        `<a class="button" href="/analyze?example=${id}">Example</a>`,
    )
    .join("");

  document.body.innerHTML =
    `<div>` +
    `<form id="analyzeForm">` +
    `<${textareaTag} id="sourceCode" name="sourceCode"></${textareaTag}>` +
    fileInput +
    `</form>` +
    `<section class="examples" aria-labelledby="examples-heading">` +
    `<h2 id="examples-heading">Try an example</h2>` +
    `<div class="button-row">${links}</div>` +
    `</section>` +
    `</div>`;

  return {
    window,
    document,
    textarea: document.querySelector("#sourceCode"),
    form: document.querySelector(
      "form#analyzeForm",
    ) as unknown as HTMLFormElement | null,
  };
}

/** happy-dom events are not the DOM lib's `Event`; the cast keeps `dispatchEvent` happy. */
function clickEvent(window: InstanceType<typeof Window>): Event {
  return new window.Event("click", {
    bubbles: true,
    cancelable: true,
  }) as unknown as Event;
}

function clickOn(
  window: InstanceType<typeof Window>,
  link: Element | null,
): Event {
  const event = clickEvent(window);
  link?.dispatchEvent(event);
  return event;
}

describe("exampleIdOf", () => {
  it("reads the example id from the query string", () => {
    expect(exampleIdOf("/analyze?example=single-responsibility")).toBe(
      "single-responsibility",
    );
  });

  it("reads the id regardless of surrounding parameters", () => {
    expect(exampleIdOf("/analyze?other=1&example=hexagonal-violation")).toBe(
      "hexagonal-violation",
    );
  });

  it("returns null when the parameter is absent", () => {
    expect(exampleIdOf("/analyze")).toBe(null);
  });

  it("returns null for an empty href", () => {
    expect(exampleIdOf("")).toBe(null);
  });

  it("returns null instead of throwing for an unparseable href", () => {
    expect(exampleIdOf("http://[/")).toBe(null);
  });
});

describe("enhanceExampleSwitching", () => {
  it("fills the editor in place instead of navigating", () => {
    const { window, document, textarea, form } = switcherDom();
    const filled: Element[] = [];

    try {
      expect(
        enhanceExampleSwitching(document, {
          onSwitch: (switched) => {
            filled.push(switched);
          },
        }),
      ).toBe(true);

      const link = document.querySelector(
        'a[href="/analyze?example=single-responsibility"]',
      );
      const event = clickOn(window, link);

      expect(event.defaultPrevented).toBe(true);
      expect((textarea as unknown as HTMLTextAreaElement).value).toContain(
        "sendWelcomeEmail",
      );
      expect(form?.dataset["exampleFilename"]).toBe("UserService.ts");

      if (textarea === null) {
        throw new Error("expected the editor textarea");
      }

      expect(filled).toEqual([textarea]);
    } finally {
      void window.close();
    }
  });

  it("moves the current marker to the filled example", () => {
    const { window, document } = switcherDom();

    try {
      expect(enhanceExampleSwitching(document)).toBe(true);

      const first = document.querySelector(
        'a[href="/analyze?example=single-responsibility"]',
      );
      const second = document.querySelector(
        'a[href="/analyze?example=hexagonal-violation"]',
      );
      clickOn(window, first);
      clickOn(window, second);

      expect(first?.hasAttribute("aria-current")).toBe(false);
      expect(second?.getAttribute("aria-current")).toBe("true");
      expect(
        (document.querySelector("#sourceCode") as unknown as HTMLTextAreaElement)
          .value,
      ).toContain("PgOrderRepository");
    } finally {
      void window.close();
    }
  });

  it("dispatches an input event when no hook is given", () => {
    const { window, document, textarea } = switcherDom();
    let inputs = 0;
    textarea?.addEventListener("input", () => {
      inputs += 1;
    });

    try {
      expect(enhanceExampleSwitching(document)).toBe(true);
      clickOn(
        window,
        document.querySelector(
          'a[href="/analyze?example=single-responsibility"]',
        ),
      );

      expect(inputs).toBe(1);
    } finally {
      void window.close();
    }
  });

  it("switches without a file input", () => {
    const { window, document, textarea } = switcherDom({
      withFileInput: false,
    });

    try {
      expect(enhanceExampleSwitching(document)).toBe(true);
      const event = clickOn(
        window,
        document.querySelector(
          'a[href="/analyze?example=single-responsibility"]',
        ),
      );

      expect(event.defaultPrevented).toBe(true);
      expect((textarea as unknown as HTMLTextAreaElement).value).toContain(
        "sendWelcomeEmail",
      );
    } finally {
      void window.close();
    }
  });

  it("keeps the plain navigation for an unknown example", () => {
    const { window, document, textarea } = switcherDom({
      links: ["bogus"],
    });

    try {
      expect(enhanceExampleSwitching(document)).toBe(true);
      const link = document.querySelector(
        'a[href="/analyze?example=bogus"]',
      );
      const event = clickOn(window, link);

      expect(event.defaultPrevented).toBe(false);
      expect((textarea as unknown as HTMLTextAreaElement).value).toBe("");
      expect(link?.hasAttribute("aria-current")).toBe(false);
    } finally {
      void window.close();
    }
  });

  it("keeps the plain navigation when the editor is absent", () => {
    const window = new Window();
    const errors: unknown[] = [];
    window.addEventListener("error", (event) => {
      errors.push(event);
    });

    try {
      const document = window.document as unknown as Document;
      document.body.innerHTML =
        `<section class="examples">` +
        `<a class="button" href="/analyze?example=single-responsibility">Example</a>` +
        `</section>`;
      document.body.querySelector("form")?.remove();

      expect(enhanceExampleSwitching(document)).toBe(true);
      const event = clickOn(
        window,
        document.querySelector(
          'a[href="/analyze?example=single-responsibility"]',
        ),
      );

      expect(event.defaultPrevented).toBe(false);
      expect(errors).toEqual([]);
    } finally {
      void window.close();
    }
  });

  it("keeps the plain navigation when the source field is mistagged", () => {
    const { window, document, textarea } = switcherDom({
      textareaTag: "div",
    });

    try {
      expect(enhanceExampleSwitching(document)).toBe(true);
      const event = clickOn(
        window,
        document.querySelector(
          'a[href="/analyze?example=single-responsibility"]',
        ),
      );

      expect(event.defaultPrevented).toBe(false);
      expect(textarea?.tagName).toBe("DIV");
    } finally {
      void window.close();
    }
  });

  it("leaves a malformed href to the browser", () => {
    const window = new Window();
    const errors: unknown[] = [];
    window.addEventListener("error", (event) => {
      errors.push(event);
    });

    try {
      const document = window.document as unknown as Document;
      document.body.innerHTML =
        `<div>` +
        `<form id="analyzeForm"><textarea id="sourceCode" name="sourceCode"></textarea></form>` +
        `<section class="examples"><a class="button" href="http://[/">Example</a></section>` +
        `</div>`;

      expect(enhanceExampleSwitching(document)).toBe(true);
      const event = clickOn(window, document.querySelector(".examples a"));

      expect(event.defaultPrevented).toBe(false);
      expect(errors).toEqual([]);
      expect(
        (document.querySelector("#sourceCode") as unknown as HTMLTextAreaElement)
          .value,
      ).toBe("");
    } finally {
      void window.close();
    }
  });

  it("is a no-op without example links", () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      document.body.innerHTML = `<form id="analyzeForm"></form>`;

      expect(enhanceExampleSwitching(document)).toBe(false);
    } finally {
      void window.close();
    }
  });

  it("ignores anchors without an href", () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      document.body.innerHTML =
        `<section class="examples"><a class="button">Example</a></section>`;

      expect(enhanceExampleSwitching(document)).toBe(false);
    } finally {
      void window.close();
    }
  });

  it("ignores non-HTML anchors, which never match the editor's links", () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      document.body.innerHTML =
        `<div>` +
        `<form id="analyzeForm"><textarea id="sourceCode" name="sourceCode"></textarea></form>` +
        `<section class="examples"><svg><a href="/analyze?example=single-responsibility">Example</a></svg></section>` +
        `</div>`;

      expect(enhanceExampleSwitching(document)).toBe(false);
      expect(
        document.querySelector(".examples a")?.tagName,
      ).toBe("a");
    } finally {
      void window.close();
    }
  });

  it("creates the fallback input event with the DOM Event interface", () => {
    const { window, document, textarea } = switcherDom();
    const created: string[] = [];
    const ownerDocument = (textarea as unknown as HTMLTextAreaElement)
      .ownerDocument;
    const originalCreateEvent = ownerDocument.createEvent.bind(ownerDocument);
    ownerDocument.createEvent = ((type: string) => {
      created.push(type);
      return originalCreateEvent(type as "Event");
    }) as typeof ownerDocument.createEvent;

    try {
      expect(enhanceExampleSwitching(document)).toBe(true);
      clickOn(
        window,
        document.querySelector(
          'a[href="/analyze?example=single-responsibility"]',
        ),
      );

      expect(created).toEqual(["Event"]);
    } finally {
      void window.close();
    }
  });

  it("dispatches the fallback input as a bubbling, cancelable event", () => {
    const { window, document, form } = switcherDom();
    const seen: { readonly bubbles: boolean; readonly cancelable: boolean }[] =
      [];
    form?.addEventListener("input", (event) => {
      seen.push({ bubbles: event.bubbles, cancelable: event.cancelable });
    });

    try {
      expect(enhanceExampleSwitching(document)).toBe(true);
      clickOn(
        window,
        document.querySelector(
          'a[href="/analyze?example=single-responsibility"]',
        ),
      );

      expect(seen).toEqual([{ bubbles: true, cancelable: true }]);
    } finally {
      void window.close();
    }
  });

  it("keeps the plain navigation when the href vanished after wiring", () => {
    const { window, document, textarea } = switcherDom();

    try {
      expect(enhanceExampleSwitching(document)).toBe(true);
      const link = document.querySelector(
        'a[href="/analyze?example=single-responsibility"]',
      );
      link?.removeAttribute("href");
      const errors: unknown[] = [];
      window.addEventListener("error", (event) => {
        errors.push(event);
      });
      const event = clickOn(window, link);

      expect(event.defaultPrevented).toBe(false);
      expect((textarea as unknown as HTMLTextAreaElement).value).toBe("");
      expect(errors).toEqual([]);
    } finally {
      void window.close();
    }
  });

  it("drops a chosen file when switching, so the fill cannot lose on submit", () => {
    const { window, document, textarea, form } = switcherDom();
    const fileInput = document.querySelector(
      "#sourceFile",
    ) as unknown as HTMLInputElement;
    let fileValue = "upload-me.ts";
    Object.defineProperty(fileInput, "value", {
      get: () => fileValue,
      set: (next: string) => {
        fileValue = next;
      },
      configurable: true,
    });

    try {
      expect(enhanceExampleSwitching(document)).toBe(true);
      const event = clickOn(
        window,
        document.querySelector(
          'a[href="/analyze?example=single-responsibility"]',
        ),
      );

      expect(event.defaultPrevented).toBe(true);
      expect(fileValue).toBe("");
      expect((textarea as unknown as HTMLTextAreaElement).value).toContain(
        "sendWelcomeEmail",
      );
      expect(form?.dataset["exampleFilename"]).toBe("UserService.ts");
    } finally {
      void window.close();
    }
  });

  it("records the example filename even without a file input", () => {
    const { window, document, form } = switcherDom({
      withFileInput: false,
    });

    try {
      expect(enhanceExampleSwitching(document)).toBe(true);
      const event = clickOn(
        window,
        document.querySelector(
          'a[href="/analyze?example=single-responsibility"]',
        ),
      );

      expect(event.defaultPrevented).toBe(true);
      expect(form?.dataset["exampleFilename"]).toBe("UserService.ts");
    } finally {
      void window.close();
    }
  });
});
