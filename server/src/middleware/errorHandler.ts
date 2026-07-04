import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) {
    res.end();
    return;
  }
  res.status(500).json({ error: err?.message ?? "Internal server error" });
};
