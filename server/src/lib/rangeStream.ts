/**
 * HTTP Range request helper.
 *
 * Parses the incoming `Range` header, validates it against the file size, and
 * either pipes the full file (200) or a partial byte range (206) to the
 * response.  Responds 416 for malformed or unsatisfiable ranges.
 *
 * Usage:
 *   import { serveWithRange } from "../lib/rangeStream.js";
 *   serveWithRange(req, res, filePath, fileSize, contentType);
 */

import fs from "node:fs";
import type { Request, Response } from "express";

export interface RangeResult {
  /** HTTP status code that was set (200 | 206 | 416). */
  status: 200 | 206 | 416;
}

/**
 * Serve `filePath` honouring the optional `Range` header from `req`.
 *
 * - No `Range` header → 200 + full stream.
 * - Valid `Range` → 206 + partial stream.
 * - Invalid / unsatisfiable `Range` → 416, no body written.
 *
 * The function writes the response headers and streams the body. The caller
 * must NOT write additional body content after this call.
 */
export function serveWithRange(
  req: Request,
  res: Response,
  filePath: string,
  fileSize: number,
  contentType: string,
): void {
  // Always advertise Range support so clients know they can seek.
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", contentType);

  const rangeHeader = req.headers["range"];

  if (!rangeHeader) {
    // No Range requested — stream the full file.
    res.setHeader("Content-Length", String(fileSize));
    res.status(200);
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Parse the Range header.  We only support the "bytes" unit.
  // Format: "bytes=<start>-<end>" | "bytes=<start>-" | "bytes=-<suffix>"
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) {
    res.setHeader("Content-Range", `bytes */${fileSize}`);
    res.status(416).end();
    return;
  }

  const rawStart = match[1];
  const rawEnd = match[2];

  let start: number;
  let end: number;

  if (rawStart === "" && rawEnd === "") {
    // Degenerate "bytes=-" — nothing requested.
    res.setHeader("Content-Range", `bytes */${fileSize}`);
    res.status(416).end();
    return;
  }

  if (rawStart === "") {
    // Suffix form: bytes=-N  →  last N bytes.
    const suffix = parseInt(rawEnd, 10);
    if (suffix <= 0 || !Number.isFinite(suffix)) {
      res.setHeader("Content-Range", `bytes */${fileSize}`);
      res.status(416).end();
      return;
    }
    start = Math.max(0, fileSize - suffix);
    end = fileSize - 1;
  } else if (rawEnd === "") {
    // Open-ended: bytes=A-  →  A to end of file.
    start = parseInt(rawStart, 10);
    end = fileSize - 1;
  } else {
    start = parseInt(rawStart, 10);
    end = parseInt(rawEnd, 10);
  }

  // Validate the resolved range.
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  ) {
    res.setHeader("Content-Range", `bytes */${fileSize}`);
    res.status(416).end();
    return;
  }

  // Clamp end to the last byte of the file (never beyond).
  if (end >= fileSize) {
    end = fileSize - 1;
  }

  const chunkSize = end - start + 1; // inclusive range → add 1

  res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
  res.setHeader("Content-Length", String(chunkSize));
  res.status(206);
  fs.createReadStream(filePath, { start, end }).pipe(res);
}
