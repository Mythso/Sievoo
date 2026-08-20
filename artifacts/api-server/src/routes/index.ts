import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analysesRouter from "./analyses";
import commentsRouter from "./comments";
import contactRouter from "./contact";
import adminRouter from "./admin";
import watchlistRouter from "./watchlist";
import tickerRouter from "./ticker";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analysesRouter);
router.use(commentsRouter);
router.use(contactRouter);
router.use(adminRouter);
router.use(watchlistRouter);
router.use(tickerRouter);

export default router;
