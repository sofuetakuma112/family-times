import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { channelsRouter } from "./channels";
import { invitesRouter } from "./invites";
import { serversRouter } from "./servers";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  servers: serversRouter,
  channels: channelsRouter,
  invites: invitesRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
