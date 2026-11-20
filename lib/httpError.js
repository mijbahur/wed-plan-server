// Throw this from route handlers to send a specific status with a clear message.
// Express 5 forwards errors from async handlers to the error middleware.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}