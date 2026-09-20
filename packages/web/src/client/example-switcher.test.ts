import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { enhanceExampleSwitching } from "./example-switcher.ts";

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
});
