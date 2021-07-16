"use strict";

// Read the .env file.
import * as dotenv from "dotenv";
dotenv.config();

// Require the framework
import Fastify from "fastify";

// Require library to exit fastify process, gracefully (if possible)
import closeWithGrace from "close-with-grace";

// Instantiate Fastify with some config
const app = Fastify({
  logger: true,
});

// Register your application as a normal plugin.
app.register(import("./src/app"));

// delay is the number of milliseconds for the graceful close to finish 
const closeListeners = closeWithGrace({ delay: 500 }, async function ({ signal, err, manual }) {
  if (err) {
    app.log.error(err)
  }
  await app.close()
})

app.addHook('onClose', async (instance, done) => {
  closeListeners.uninstall()
  done()
})

// Start listening.
app.listen(process.env.PORT || 3000, (err: any) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
