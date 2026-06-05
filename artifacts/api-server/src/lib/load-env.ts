import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const envPath = [
  path.resolve(import.meta.dirname, "..", "..", "..", ".env"),
  path.resolve(import.meta.dirname, "..", "..", "..", "..", ".env"),
].find((candidate) => fs.existsSync(candidate));

dotenv.config({
  path: envPath,
});
