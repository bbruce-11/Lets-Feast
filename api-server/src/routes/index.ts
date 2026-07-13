import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import restaurantsRouter from "./restaurants.js";
import feastWindowsRouter from "./feast-windows.js";
import ordersRouter from "./orders.js";
import paymentsRouter from "./payments.js";
import pushRouter from "./push.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(restaurantsRouter);
router.use(feastWindowsRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(pushRouter);

export default router;
