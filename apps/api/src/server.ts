import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? "3100");
const host = process.env.HOST ?? "127.0.0.1";

const app = await createApp();

try {
  await app.listen({ port, host });
  console.log(`API listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
