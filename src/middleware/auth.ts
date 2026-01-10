import type { Request, Response, NextFunction } from "express";

export function bearerAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const expectedToken = process.env.MCP_BEARER_TOKEN;

  if (!expectedToken) {
    console.warn(
      "MCP_BEARER_TOKEN not set - authentication disabled (not recommended for production)"
    );
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Invalid Authorization header format" });
    return;
  }

  if (token !== expectedToken) {
    res.status(401).json({ error: "Invalid bearer token" });
    return;
  }

  next();
}
