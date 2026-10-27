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

import {
  createTemporaryReferenceSet,
  decodeAction,
  decodeFormState,
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from "@vitejs/plugin-rsc/rsc";
import {
  RouterContextProvider,
  unstable_matchRSCServerRequest as matchRSCServerRequest,
} from "react-router";

import routes from "virtual:react-router/unstable_rsc/routes";
import routeDiscovery from "virtual:react-router/unstable_rsc/route-discovery";
import basename from "virtual:react-router/unstable_rsc/basename";
import clientVersion from "virtual:react-router/unstable_rsc/client-version";
import unstable_reactRouterServeConfig from "virtual:react-router/unstable_rsc/react-router-serve-config";

export { unstable_reactRouterServeConfig };

const allowedActionOrigins = process.env.APP_BASE ? [new URL(process.env.APP_BASE).host] : [];

export function fetchServer(
  request: Request,
  requestContext?: RouterContextProvider,
) {
  return matchRSCServerRequest({
    allowedActionOrigins,
    basename,
    createTemporaryReferenceSet,
    decodeAction,
    decodeFormState,
    decodeReply,
    loadServerAction,
    clientVersion,
    request,
    requestContext,
    routes,
    routeDiscovery,
    generateResponse(match, options) {
      return new Response(renderToReadableStream(match.payload, options), {
        status: match.statusCode,
        headers: match.headers,
      });
    },
  });
}

export default {
  async fetch(request: Request, requestContext?: RouterContextProvider) {
    if (requestContext && !(requestContext instanceof RouterContextProvider)) {
      requestContext = undefined;
    }

    const ssr = await import.meta.viteRsc.loadModule<
      typeof import("./entry.ssr")
    >("ssr", "index");

    return await ssr.generateHTML(
      request,
      await fetchServer(request, requestContext),
    );
  },
};

if (import.meta.hot) {
  import.meta.hot.accept();
}
