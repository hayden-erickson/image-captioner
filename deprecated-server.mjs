import {
  createRequestHandler,
} from "@remix-run/express";
import express from "express";
import build from './build/index.js'
import dotenv from 'dotenv'
import { broadcastDevReady } from "@remix-run/node";
// import { logDevReady } from "@remix-run/cloudflare" // use `logDevReady` if using CloudFlare


// Load the environment variables from the .env file
dotenv.config()

if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}


const app = express();

// needs to handle all verbs (GET, POST, etc.)
app.all(
  "*",
  createRequestHandler({
    // `remix build` and `remix dev` output files to a build directory, you need
    // to pass that build to the request handler
    build,

    // return anything you want here to be available as `context` in your
    // loaders and actions. This is where you can bridge the gap between Remix
    // and your server
    getLoadContext(req, res) {
      return {};
    },
  })
);

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Starting server http://localhost:${PORT}`)
  broadcastDevReady(build)
})
