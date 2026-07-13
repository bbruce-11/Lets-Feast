import type { Request, Response, NextFunction } from "express";
import { z } from "zod/v4";

// Request-body validation guard. Validates `req.body` against the given schema
// and, on success, replaces `req.body` with the parsed/sanitized value (unknown
// keys are stripped by the object schemas) before handing off to the route. On
// failure it short-circuits with a consistent 400 response so malformed or
// oversized input never reaches business logic or the database.
//
// Use `zod/v4` schemas (the same Zod entrypoint the DB schema uses) so the
// generated insert schemas can be reused/composed where helpful.
export function validateBody(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
