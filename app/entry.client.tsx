// PolarLearn: A free and open-source learning platform.
// Copyright(C) 2024-2026 PolarNL Group
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import * as Sentry from "@sentry/react-router";
// @ts-expect-error - internal vite module, cant be imported. Does exist tho
import "virtual:react-router/unstable_rsc/inject-hmr-runtime"; // DO NOT REMOVE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

import { startTransition, StrictMode } from "react";
import { hydrateRoot, type ReactFormState } from "react-dom/client";
import {
  createFromReadableStream,
  createTemporaryReferenceSet,
  encodeReply,
  setServerCallback,
} from "@vitejs/plugin-rsc/browser";
import {
  unstable_createCallServer as createCallServer,
  unstable_getRSCStream as getRSCStream,
  unstable_RSCHydratedRouter as RSCHydratedRouter,
  type unstable_RSCPayload as RSCPayload,
} from "react-router/dom";

setServerCallback(
  createCallServer({
    createFromReadableStream,
    createTemporaryReferenceSet,
    encodeReply,
  }),
);

Sentry.init({
  enabled: process.env.NODE_ENV === "production",
  dsn: "https://b4748af84c275fb0a9f2467cac2c2cd9@o4509185034223616.ingest.de.sentry.io/4511587277340752",
  tunnel: "/api/report-error",

  integrations: [
    Sentry.reactRouterTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      maskAllInputs: false,
      blockAllMedia: false,
    }),
    Sentry.browserProfilingIntegration(),
  ],

  tracesSampleRate: 0.1,

  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  profileSessionSampleRate: 0.01,
  profileLifecycle: "trace",
});

createFromReadableStream<RSCPayload>(getRSCStream()).then((payload: { type: string; formState: ReactFormState | PromiseLike<ReactFormState>; }) => {
  startTransition(async () => {
    const formState =
      payload.type === "render" ? (await payload.formState) as ReactFormState : undefined;

    hydrateRoot(
      document,
      <StrictMode>
        <RSCHydratedRouter
          payload={payload}
          createFromReadableStream={createFromReadableStream}
        />
      </StrictMode>,
      {
        formState,
      },
    );
  });
});

const consoleFontStyle =
  'font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif; '
  + "font-size: 96px; "
  + "font-weight: 600; "
  + "line-height: 1; "
  + "letter-spacing: -0.04em; "
  + "opacity: 0.85; "
  + "display: inline-block;";

const polarStyle = [
  consoleFontStyle,
  "color: transparent",
  "background: linear-gradient(90deg, #38bdf8 0%, #e0f2fe 100%)",
  "-webkit-background-clip: text",
  "-webkit-text-fill-color: transparent",
].join("; ");

const learnStyle = [
  consoleFontStyle,
  "color: #ffffff",
  "text-shadow: 0 0 1px rgba(255, 255, 255, 0.35)",
].join("; ");

void document.fonts.load('700 64px "Plus Jakarta Sans"').then(() => {
  console.log("%cPolar%cLearn", polarStyle, learnStyle);
  console.log("Welcome to PolarLearn dear developer!")
  console.log("We are open-source under the Affero GNU General Public License v3.0 (AGPL-3.0) license")
  console.log("Check out our GitHub repository at https://github.com/polarnl/polarlearn-v2")
});
