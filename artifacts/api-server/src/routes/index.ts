import { Router, type IRouter } from "express";
import healthRouter from "./health";
import callRouter from "./call";

const router: IRouter = Router();

router.use(healthRouter);
router.use(callRouter);

export default router;
