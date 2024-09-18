const express = require("express");
const { connectionToDB } = require("./config/db");
const { slackRouter } = require("./routes/Slack.routes");
const { linearRoutes } = require("./routes/Linear.routes");
const { clickupRoutes } = require("./routes/Clickup.routes");
const cors = require("cors");
const app = express();
const port = 3000;

app.use(express.json());
app.use(
  cors({
    origin: [
      "https://app.getaligned.work",
      "https://stage-app.getaligned.work",
      "https://mail.google.com",
      "https://api.getaligned.work",
      "https://extension.getaligned.work",
      "http://localhost:5173",
      "http://localhost:5174",
    ],
  })
);
app.use("/", slackRouter);
app.use("/", linearRoutes);
app.use("/", clickupRoutes);

app.get("/", async (req, res) => {
  res.send("home page for slack");
});

app.listen(port, async () => {
  try {
    await connectionToDB
      .then((res) => console.log("Mongo db is connected"))
      .catch((error) => console.log("Mongo db have problem", error));
    console.log(`server is running on port 3000`);
  } catch (error) {
    console.log(error, "error");
  }
});
