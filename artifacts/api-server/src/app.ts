import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Google AdSense ads.txt endpoint
app.get("/ads.txt", (_req, res) => {
  res.type("text/plain").send("# Sievoo.com - Google AdSense ads.txt\n# Add your AdSense publisher ID below\n# google.com, pub-XXXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0\n");
});

app.use("/api", router);

export default app;
