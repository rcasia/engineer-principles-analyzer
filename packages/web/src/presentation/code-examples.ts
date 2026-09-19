/**
 * A prefilled snippet behind one "Try an example" link on the `/analyze`
 * page. Pure display content: clicking a link is a plain `GET
 * /analyze?example=<id>` navigation (ADR-0004 ships no client-side
 * JavaScript, so there is no script to fill the editor), and submitting
 * still posts exactly `sourceCode` + `language`, which is all the backend
 * reads. Small on purpose: each one fits the editor without scrolling and
 * names the tension it invites the visitor to test.
 */
export interface CodeExample {
  readonly id: string;
  readonly label: string;
  readonly filename: string;
  readonly language: string;
  readonly source: string;
}

export const CODE_EXAMPLES: readonly CodeExample[] = [
  {
    id: "single-responsibility",
    label: "Single Responsibility",
    filename: "UserService.ts",
    language: "typescript",
    source: `export class UserService {
  async save(user: User): Promise<void> {
    await this.db.save(user);
    await this.mailer.sendWelcomeEmail(user.email);
    await this.audit.log(\`created user \${user.id}\`);
  }
}`,
  },
  {
    id: "hexagonal-violation",
    label: "Hexagonal violation",
    filename: "OrderService.ts",
    language: "typescript",
    source: `import { PgOrderRepository } from "../../infrastructure/persistence/pg-order-repository.ts";

export class OrderService {
  constructor(private readonly orders: PgOrderRepository) {}

  async place(order: Order): Promise<void> {
    order.confirm();
    await this.orders.save(order);
  }
}`,
  },
  {
    id: "dependency-inversion",
    label: "Dependency inversion",
    filename: "ReportService.ts",
    language: "typescript",
    source: `import { SmtpMailer } from "./smtp-mailer.ts";

export class ReportService {
  private readonly mailer = new SmtpMailer("smtp.example.com");

  async sendDaily(report: Report): Promise<void> {
    await this.mailer.send("team@example.com", report.render());
  }
}`,
  },
  {
    id: "clean-architecture",
    label: "Clean architecture",
    filename: "CreateUser.ts",
    language: "typescript",
    source: `import type { Request } from "express";
import { User } from "../domain/user.ts";

export async function createUser(req: Request): Promise<User> {
  const user = User.create(req.body.name);
  await req.app.get("users").save(user);
  return user;
}`,
  },
];

/**
 * Resolves an `?example=` query value to its snippet. Unknown, empty and
 * missing values all resolve to `undefined`, which the handler renders as
 * the blank form - a hand-edited URL can never break the page.
 */
export function exampleFor(id: string | null): CodeExample | undefined {
  return CODE_EXAMPLES.find((example) => example.id === id);
}
