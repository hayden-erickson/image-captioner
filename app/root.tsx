import React from 'react'
import {
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import App from './routes/app'

export default function() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <App />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
