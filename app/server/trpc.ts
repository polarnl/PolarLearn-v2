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

import superjson from 'superjson'

import { z, ZodError } from 'zod'
import { initTRPC, TRPCError } from '@trpc/server'

import { prisma } from '~/lib/db'
import { auth } from '~/lib/auth/server'

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>
const authSessionByRequest = new WeakMap<Request, Promise<AuthSession>>()

function extractIpFromHeaders(headers: Headers): string | null {
  const headerKeys = ['cf-connecting-ip', 'true-client-ip', 'x-forwarded-for', 'x-real-ip'] as const
  for (const header of headerKeys) {
    const value = headers.get(header)
    if (value) {
      if (header === 'x-forwarded-for') {
        return value.split(',')[0]?.trim() ?? null
      }
      return value
    }
  }
  return null
}

export const getRequestSession = async (opts: {
  headers: Headers
  request?: Request
  session?: AuthSession
}): Promise<AuthSession> => {
  if (opts.session !== undefined) {
    return opts.session
  }

  if (opts.request) {
    const cachedSession = authSessionByRequest.get(opts.request)

    if (cachedSession) {
      return cachedSession
    }

    const sessionPromise = auth.api.getSession({
      headers: opts.headers
    })
    authSessionByRequest.set(opts.request, sessionPromise)
    return sessionPromise
  }

  return auth.api.getSession({
    headers: opts.headers
  })
}

export const createTRPCContext = async (opts: { headers: Headers; request?: Request; session?: AuthSession }) => {
  const authSession = await getRequestSession(opts)
  const ipAddress = opts.request
    ? extractIpFromHeaders(opts.request.headers)
    : extractIpFromHeaders(opts.headers)
  return {
    prisma,
    user: authSession?.user,
    session: authSession?.session,
    ipAddress,
  }
}
type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? z.treeifyError(error.cause) : null
    }
  })
})

export const createCallerFactory = t.createCallerFactory

export const createTRPCRouter = t.router

export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user?.id) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      user: ctx.user,
      session: ctx.session,
      ipAddress: ctx.ipAddress,
    }
  })
})