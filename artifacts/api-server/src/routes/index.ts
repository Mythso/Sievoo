import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analysesRouter from "./analyses";
import commentsRouter from "./comments";
import contactRouter from "./contact";
import adminRouter from "./admin";
import watchlistRouter from "./watchlist";
import tickerRouter from "./ticker";
import authRouter from "./auth";
import stocksRouter from "./stocks";
import usersRouter from "./users";
import followsRouter from "./follows";
import trackRecordRouter from "./track-record";
import ogRouter from "./og";
import seoRouter from "./seo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analysesRouter);
router.use(commentsRouter);
router.use(contactRouter);
router.use(adminRouter);
router.use(watchlistRouter);
router.use(tickerRouter);
router.use(authRouter);
router.use(stocksRouter);
router.use(usersRouter);
router.use(followsRouter);
router.use(trackRecordRouter);
router.use(ogRouter);
router.use(seoRouter);

export default router;
