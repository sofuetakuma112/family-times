import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { channelsRouter } from "./channels";
import { invitesRouter } from "./invites";
import { messagesRouter } from "./messages";
import { serversRouter } from "./servers";
import { uploadRouter } from "./upload";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  servers: serversRouter,
  channels: channelsRouter,
  invites: invitesRouter,
  messages: messagesRouter,
  upload: uploadRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
