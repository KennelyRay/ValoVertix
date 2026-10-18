import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createHandlers } from "@/mocks/handlers";

/** Our own origin, which the clock check asks for the server time. */
const clockHandler = http.head(
  `${window.location.origin}/`,
  () => new HttpResponse(null, { headers: { date: new Date().toUTCString() } }),
);

export const server = setupServer(...createHandlers(), clockHandler);
