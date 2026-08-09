import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analysesRouter from "./analyses";
import commentsRouter from "./comments";
import contactRouter from "./contact";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analysesRouter);
router.use(commentsRouter);
router.use(contactRouter);
router.use(adminRouter);

export default router;
