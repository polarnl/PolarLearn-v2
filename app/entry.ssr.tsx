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

import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";
import type { ReactFormState } from "react-dom/client";
import { renderToReadableStream } from "react-dom/server.edge";
import {
  unstable_routeRSCServerRequest as routeRSCServerRequest,
  unstable_RSCStaticRouter as RSCStaticRouter,
} from "react-router";
import pkg from "package.json"

export async function generateHTML(
  request: Request,
  serverResponse: Response,
): Promise<Response> {
  return await routeRSCServerRequest({
    request,
    serverResponse,
    createFromReadableStream,
    async renderHTML(getPayload, options) {
      const payload = await getPayload();
      const formState =
        payload.type === "render" ? (await payload.formState) as ReactFormState : undefined;
      const bootstrapScriptContent =
        // @ts-expect-error - this is the internal vite api only exposed in node_modules.
        await import.meta.viteRsc.loadBootstrapScriptContent("index");

      const stream = await renderToReadableStream(
        <RSCStaticRouter getPayload={getPayload} />,
        {
          ...options,
          bootstrapScriptContent,
          formState,
          signal: request.signal,
        },
      );

      const encoder = new TextEncoder();
      const comment = encoder.encode(`<!-- PolarLearn ${pkg.version}\n  Powered by PolarLearn!\n  We are open source: https://github.com/polarnl/polarlearn-v2 -->`);

      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(comment);

          const reader = stream.getReader();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              if (value) {
                controller.enqueue(value);
              }
            }
          } finally {
            controller.close();
          }
        },
        cancel(reason) {
          stream.cancel(reason);
        },
      });

      return body;
    },
  });
}
