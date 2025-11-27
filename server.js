import express from "express";
import path from "path";

const app = express();
const PORT = process.env.PORT || 10000;

const __dirname = path.resolve();

// THIS LINE IS THE IMPORTANT ONE
app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
