import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db, callEventsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  await db.select({ callId: callEventsTable.callId }).from(callEventsTable).limit(1);
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
