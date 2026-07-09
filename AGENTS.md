# AGENTS.md

This file is the working context for agents in PolarLearn V2. Treat it as the
first thing to read before editing the project.

## Project identity

PolarLearn is a free, open-source learning platform for students. The product is
centered on study lists, a forum, groups, search, and admin
moderation. The app is Dutch-first today: `APP_LANG` defaults to `nl`, the only
committed app translation file is `app/i18n/nl.json`, and visible UI text should
normally go through `i18n.t(...)` instead of being hardcoded.

The repo is AGPL-3.0-or-later. Most source files carry the PolarLearn license
header. New substantial source files should keep that pattern unless the local
file type clearly does not use it.

## Stack

- React 19, React Router 7 framework mode, SSR enabled in
  `react-router.config.ts`.
- Vite 7 with React Router RSC plugin, `@vitejs/plugin-rsc` and TailwindCSS v4.
- tRPC 11 for app RPC at `/api/rpc`, with TanStack Query on the client and
  SuperJSON for transport.
- Prisma 7 with PostgreSQL through `@prisma/adapter-pg`.
- Better Auth for auth, username, admin, SSO, and passkey features.
- Styling uses Tailwind 4, `@polarnl/polarui-react`, local shadcn/Radix-style UI
  wrappers in `app/components/ui`, `lucide-react`, and `sonner`.
- Learning-session client state uses Zustand vanilla stores scoped by provider.
- List editing uses `@hello-pangea/dnd`; animation uses GSAP.

## Library docs for agents

Prefer official docs. For libraries that publish `llms.txt` or markdown docs,
use those first when you need broad context, then verify exact APIs against the
human docs or local installed types.

Primary docs:

- Better Auth: https://better-auth.com/docs/introduction
- Better Auth sessions: https://better-auth.com/docs/concepts/session-management
- Better Auth users/accounts:
  https://better-auth.com/docs/concepts/users-accounts
- Better Auth Prisma adapter: https://better-auth.com/docs/adapters/prisma
- Better Auth admin plugin: https://better-auth.com/docs/plugins/admin
- Better Auth username plugin: https://better-auth.com/docs/plugins/username
- Better Auth passkey plugin: https://better-auth.com/docs/plugins/passkey
- Better Auth SSO plugin: https://better-auth.com/docs/plugins/sso
- React Router framework mode:
  https://reactrouter.com/start/framework/installation
- React Router routing: https://reactrouter.com/start/framework/routing
- React Router data loading:
  https://reactrouter.com/start/framework/data-loading
- tRPC TanStack React Query setup:
  https://trpc.io/docs/client/tanstack-react-query/setup
- TanStack Query React:
  https://tanstack.com/query/latest/docs/framework/react/overview
- Prisma generators:
  https://www.prisma.io/docs/orm/prisma-schema/overview/generators
- Prisma Client generation:
  https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/generating-prisma-client
- Zod: https://zod.dev/
- React: https://react.dev/reference/react
- Vite: https://vite.dev/guide/
- Tailwind with Vite: https://tailwindcss.com/docs/installation/using-vite
- Zustand: https://zustand.docs.pmnd.rs/getting-started/introduction
- GSAP: https://gsap.com/docs/v3/
- hello-pangea/dnd: https://github.com/hello-pangea/dnd
- react-markdown: https://github.com/remarkjs/react-markdown
- Radix primitives: https://www.radix-ui.com/primitives/docs/overview/introduction
- Lucide React: https://lucide.dev/guide/react

LLM-friendly docs:

- Better Auth advertises `https://better-auth.com/llms.txt` and a docs MCP
  server at `https://mcp.better-auth.com/mcp`.
- Zod publishes `https://zod.dev/llms.txt`.
- Prisma publishes `https://www.prisma.io/llms.txt`.
- React Router docs expose "Copy Page as Markdown" links on docs pages; use
  those for page-level context when available.
- If another dependency exposes `/llms.txt`, `/llms-full.txt`, or page `.md`
  variants, prefer that for initial agent reading, but do not trust it over the
  actual local code and installed package versions.

## Commands

- Install: `pnpm install`
- Dev server: `pnpm run dev`
- Build: `pnpm run build`
- Typecheck: `pnpm run typecheck`
- Tests: `pnpm run test`
- Prisma sync/generate: `pnpm run dbsync`
- OpenAPI generation: `pnpm run openapi`

Notes:

- There is no lint script in `package.json`. `eslint.config.fuckoff.mjs` exists,
  but the project currently does not wire it into npm scripts.
- `pnpm run typecheck` runs React Router type generation before `tsc`.
- `pnpm run dbsync` runs `prisma db push && prisma generate`; this repo uses
  `db push`, not checked-in Prisma migrations.
- If `app/prisma` is missing after install, run Prisma generation before
  typecheck/build. The Prisma client is generated there by schema config.

## Environment

Start from `.env.example`.

Required:

- `DATABASE_URL`: PostgreSQL connection string.
- `APP_BASE`: external base URL, `http://localhost:5173` in local dev.
- `SECRET`: Better Auth secret. Do not use the example value outside local dev.
- `APP_LANG`: app language code. Only `nl` is currently supported.

Common optional settings:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`,
  `SMTP_FROM`: enables verification and reset emails.
- `LOG_LEVEL`: defaults to `info`.
- `LOKI_HOST`, `LOKI_BASIC_AUTH`: enables logging to Loki.

Better Auth uses secure cookies and trusted origins differently in production.
When touching auth, check `app/lib/auth/server.ts` instead of assuming defaults.

## Directory map

- `app/routes.ts`: the canonical route table. If a page is not here, React
  Router will not serve it.
- `app/root.tsx`: document shell, metadata, root loader, i18n initialization,
  root tRPC provider, toaster, impersonation banner, notification bootstrap, and
  global announcement dialog.
- `app/routes/api/rpc.ts`: tRPC fetch adapter endpoint. Keep `/api/rpc/*` in the
  route table.
- `app/routes/api/auth/[...auth].ts`: Better Auth handler.
- `app/server/main.ts`: app router composition.
- `app/server/trpc.ts`: context, request session caching, IP extraction,
  procedure definitions.
- `app/server/react.tsx`: browser/server QueryClient setup and typed
  `useTRPC()`.
- `app/server/routers/*.ts`: server-side feature APIs.
- `app/lib/*.ts`: shared schemas, domain helpers, DB/auth/logging/i18n-adjacent
  utilities.
- `app/components`: app-level components and generated/local UI primitives.
- `app/routes/app/*`: authenticated app pages.
- `prisma/schema.prisma`: database and generated Prisma client config.
- `scripts/generate-openapi.ts`: OpenAPI export for the tRPC router.

## Routing and app shell

The route tree is explicit in `app/routes.ts`.

Public and auth routes:

- `/`: landing page in `app/routes/_index.tsx`.
- `/api/rpc/*`: tRPC.
- `/api/auth/*`: Better Auth.
- `/auth/sign-in`, `/auth/sign-up`, `/auth/reset-password`: auth screens.

Authenticated app shell:

- `app/routes/app/layout.tsx` wraps the app with sidebar, top bar, tooltip
  provider, and `Outlet`.
- Top bar/sidebar intentionally hide on `/app/editlist/*` and `/app/session/*`
  because those screens have focused custom layouts.
- Most protected pages redirect unauthenticated users to
  `/auth/sign-in?next=...`.

Major app areas:

- `/app`: dashboard, recent subjects/lists, recent learn sessions.
- `/app/favorites`, `/app/mylists`: list collection pages.
- `/app/viewlist/:id/*`: list detail, words, stats, session stats.
- `/app/editlist/:id`: focused list editor.
- `/app/session/:id`: focused learning session.
- `/app/forum/*`: forum index, post lists, single post, my posts/replies.
- `/app/groups` and `/app/group/:id/*`: groups.
- `/app/viewuser/:id/*`: profile, lists, posts, groups, folders, admin tab.
- `/app/administration/*`: admin area.
- `/app/search/*`: search tabs.

## Server data flow

The server-side pattern is:

1. Build `Headers` from `request.headers`.
2. Call `createTRPCContext({ headers, request })`.
3. Redirect if `context.user` is missing for protected pages.
4. Use `createCallerFactory(appRouter)(context)` inside loaders to call the same
   procedures exposed over HTTP.

The client-side mutation/query pattern is:

1. Get `const trpc = useTRPC()`.
2. Use TanStack Query helpers like
   `trpc.list.createList.mutationOptions()` or
   `trpc.search.searchLists.queryOptions(...)`.
3. Revalidate route loaders with `useRevalidator().revalidate()` when the
   source of truth is loader data.
4. Use `queryClient.fetchQuery(...)` for explicit pagination fetches.

Do not create parallel REST endpoints for app features unless there is a real
integration need. tRPC is the internal feature API. If you need to create a new API endpoint, and you are sure that tRPC won't cut it, please notify the developer beforehand.

## Coding patterns

Use the patterns already in this repo before adding new ones.

Imports and files:

- Use the `~/*` alias for app imports: `~/server/trpc`, `~/lib/list`,
  `~/components/ui/dialog`.
- Use relative imports for generated route types such as `./+types/[id]`.
- Quote route filenames with shell metacharacters when using terminal commands,
  for example `'app/routes/app/editlist/[id].tsx'`.
- Keep server-only code out of generic components. Auth, Prisma, and tRPC
  server callers belong in loaders, actions, routers, or `app/lib/*.ts` server
  helpers.

Route loaders:

```ts
export async function loader({ request, params }: Route.LoaderArgs) {
  const headers = new Headers(request.headers)
  const context = await createTRPCContext({ headers, request })

  if (!context.user) {
    const url = new URL(request.url)
    return redirect(`/auth/sign-in?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`)
  }

  const caller = createCallerFactory(appRouter)(context)
  return caller.list.getLatestListData({ listId: params.id as string })
}
```

- Redirect unauthenticated users in loaders before rendering protected pages.
- Prefer server callers for feature behavior so loaders and HTTP clients share
  one implementation.
- Throw `Response` for route-level status failures when the UI expects HTTP
  status handling; throw `TRPCError` inside routers.

tRPC routers:

```ts
const inputSchema = z.object({ id: z.string().min(1) })

export const exampleRouter = createTRPCRouter({
  getThing: protectedProcedure
    .input(inputSchema)
    .query(async ({ ctx, input }) => {
      const thing = await ctx.prisma.list.findFirst({ where: { id: input.id } })
      if (!thing) throw new TRPCError({ code: "NOT_FOUND" })
      if (thing.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      return thing
    }),
})
```

- Define zod input schemas near the router unless they are shared with the UI.
- Validate authorization in the procedure even if the button is hidden in the
  UI.
- Use `ctx.prisma` inside procedures; do not import a second Prisma client.
- Return small, explicit shapes when exposing user/admin data.
- Log meaningful mutations with `appLogger.info({ event: "...", ... })`.

Client tRPC and TanStack Query:

```ts
const trpc = useTRPC()
const revalidator = useRevalidator()

const mutation = useMutation({
  ...trpc.list.starList.mutationOptions(),
  onSuccess: () => void revalidator.revalidate(),
  onError: () => toast.error(t("errors.unknown")),
})
```

- Use `useTRPC()` helpers instead of hand-written fetch calls to `/api/rpc`.
- Revalidate route loaders when the page reads loader data.
- Use `queryClient.fetchQuery(trpc.foo.bar.queryOptions(input))` for explicit
  pagination fetches.
- Keep optimistic UI local and small; the database remains the source of truth.

Prisma and JSON:

```ts
const parsed = listRecordSchema.parse(rawList)
const prefs = (user.listPrefs as listPrefs) ?? {}
```

- Parse JSON columns with the relevant zod schema before trusting structure.
- Build replacement JSON objects; do not mutate Prisma JSON blobs in place.
- Include only the relations a route needs.
- Keep generated Prisma imports as `~/prisma/client`.

Better Auth:

- Server config and hooks live in `app/lib/auth/server.ts`; client plugin access
  lives in `app/lib/auth/client.ts`.
- Use `getRequestSession(...)` or `createTRPCContext(...)` in loaders/actions
  instead of calling `auth.api.getSession(...)` repeatedly.
- Use Better Auth admin client/API methods for Better Auth-owned user/session
  behavior, and PolarLearn tRPC procedures for PolarLearn-specific state like
  forum bans, announcements, and notifications.
- Keep `SECRET`, cookies, trusted origins, and SMTP behavior centralized in the
  auth config.

Forms, UI, and errors:

- Use existing PolarUI and `app/components/ui` controls before adding new UI
  primitives.
- Use `sonner` toasts for mutation feedback.
- Keep visible strings in `app/i18n/nl.json` unless the surrounding file already
  uses a one-off literal.
- For markdown/user content, keep `rehype-sanitize` in the render path.
- For focused flows like edit list and learn session, do not reintroduce the
  global top bar/sidebar.

## tRPC context and permissions

`app/server/trpc.ts` defines:

- `getRequestSession(...)`: wraps `auth.api.getSession(...)` and caches session
  promises per `Request` in a `WeakMap`.
- `createTRPCContext(...)`: returns `{ prisma, user, ipAddress }`.
- `publicProcedure`: usable by guests.
- `protectedProcedure`: throws `UNAUTHORIZED` unless `ctx.user.id` exists, then
  narrows context to a real user.

Authorization is mostly enforced inside procedures, not globally. Before editing
permissions, search the whole router and caller path. Common checks:

- List owner/collaborator/admin checks around view/edit/delete.
- Forum author/admin checks for edit/delete; admin-only announcement category
  and pinning.
- Group member/moderator/owner checks.
- Admin role checks in Better Auth admin APIs and `adminRouter`.

## Database and Prisma

`prisma/schema.prisma` uses:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../app/prisma"
}
```

Do not change this to `prisma-client-js`. App code imports from
`~/prisma/client`, so the generated client belongs in `app/prisma`.

Main models:

- Better Auth reserved tables: `User`, `Session`, `Account`, `Verification`,
  `Passkey`, `Organization`, `Member`, `Invitation`, `SsoProvider`.
- Learning domain: `List`, `Quiz`, `LearnSession`.
- Community domain: `ForumPost`, `Group`, `Notification`.
- Platform config: `Config`.

Important database conventions:

- IDs are application-generated with `crypto.randomUUID()`.
- `User.role === "admin"` is the main admin check.
- `User.recentItems` is JSON parsed by `extractRecentItems`.
- `User.listPrefs` is JSON parsed as per-list learning preferences.
- `List.items` is the main branch snapshot; `List.versionData` is the full list
  version graph.
- `LearnSession.queue` and `LearnSession.answerLog` are JSON arrays validated by
  schemas in `app/lib/learn.ts`.
- Forum replies are also `ForumPost` rows with `isReply: true` and `replyToId`.
- Forum soft delete uses `deleted: true`.

## List/versioning model

Lists are the deepest domain in the app. Read these files before changing list
behavior:

- `app/lib/list.ts`
- `app/lib/list-diff.ts`
- `app/lib/viewlist.ts`
- `app/server/routers/lists.ts`
- `app/routes/app/editlist/[id].tsx`
- `app/routes/app/viewlist/layout.tsx`

Data shape:

- A list item is `{ id, question, answer }`.
- `listSnapshot` is an array of list items.
- Empty editor rows are filtered by
  `snapshotFromEditableItems(...)`; a row with both question and answer blank is
  not committed.
- Diffs are JSON Patch operations generated by `fast-json-patch.compare(...)`.
- `versionData` has `{ branches, commits }`.
- Each branch stores `owner`, `baseCommitId`, `headCommitId`,
  optional `parentBranch`, optional PR metadata, and `cachedSnapshot`.
- Each commit stores `parentId`, `author`, `message`, `createdAt`, and `diff`.

Branch/PR behavior:

- `main` is the canonical branch.
- `createBranch` intentionally allows a signed-in user to branch a list without
  a list ownership check, so users can suggest changes.
- Branch access is owner/collaborator/branch owner through `hasBranchAccess`.
- Pull requests are only supported from branches whose parent is `main`.
- Only the list owner can merge pull requests.
- Merge performs a three-way merge over snapshots and throws `CONFLICT` when
  both sides changed the same item/field incompatibly.
- When a merge changes list items, all learn sessions for that list are deleted
  to avoid resuming invalid queues.

Editor behavior:

- `/app/editlist/:id` loads latest main branch data through
  `list.getLatestListData`.
- Drafts are normalized for non-empty unique item IDs.
- Local unsaved drafts are stored under `editlist:<listId>:draft`.
- Save may call both `updateListMeta` and `commitToList`.
- Item commits use `list.versionData.branches.main.headCommitId` as the
  optimistic `baseCommitId`.
- Plain text import expects `question=answer` lines.
- CSV import uses the local `parseSimpleCsv(...)`; it is intentionally minimal.

When changing versioning, preserve these invariants:

- Validate all JSON from Prisma with the local zod schemas before trusting it.
- Do not mutate `versionData` in place; build a replacement object.
- Keep `List.items` synchronized with main branch snapshot changes.
- Keep branch `cachedSnapshot` synchronized with its `headCommitId`.
- Preserve conflict detection around stale `baseCommitId`.

## Learning sessions

Core files:

- `app/lib/learn.ts`
- `app/server/routers/learning.ts`
- `app/routes/app/session/[id].tsx`
- `app/routes/app/session/store.tsx`

Modes:

- `learn`: creates test, hint, and multiple-choice questions for each item.
- `test`
- `hint`
- `multiplechoice`

Direction preference:

- `ask: "q"` asks question -> answer.
- `ask: "a"` asks answer -> question.
- `ask: "both"` creates both directions.
- Preferences are stored in `User.listPrefs` by list id.

Session behavior:

- `generateLearnSession` snapshots the current list items into a shuffled queue
  and stores the main branch commit id in `LearnSession.commit`.
- The session page compares the stored commit with the list main head; if they
  differ, the session is marked stale and the user can continue or regenerate.
- The Zustand store owns queue progression and feedback.
- Correct answers remove the question from the queue.
- Incorrect answers reinsert the question at a random queue position.
- Answers are normalized by trim/lowercase.
- Answer syntax supports `/` alternatives, `(optional text)`, and `{a,b,c}`
  choices through `expandAnswerSyntax(...)`.
- The session is persisted after each new answer log entry.

## Forum

Core files:

- `app/lib/forum.ts`
- `app/server/routers/forum.ts`
- `app/routes/app/forum/*`

Categories:

- `school-related`: requires a subject in the UI.
- `non-school-related`.
- `announcement`: admin-only.

Behavior:

- Public users can read posts and replies.
- Signed-in users can create posts/replies and vote.
- Forum-banned users cannot create posts or replies.
- Authors and admins can edit/delete.
- Delete is soft-delete.
- Admins can pin/unpin posts.
- Votes are stored as a JSON map of user id to `"up"` or `"down"`.
- `votes` is score; `cachedTotalVotes` is count of voters.
- Replies create a notification for the parent post author when replying to
  someone else.
- Forum search and normal post lists exclude `category: "pr-discussion"`.

## Groups

Core files:

- `app/server/routers/groups.ts`
- `app/routes/app/groups.tsx`
- `app/routes/app/group/*`

Behavior:

- Group creator is connected as member and moderator on create.
- Groups can require approval.
- Groups can restrict adding lists to moderators.
- `getGroupData` is public, but approval-required groups hide data from users
  who are not members or pending.
- Only members can add lists; if `onlyModsCanAddLists` is true, moderators are
  required.
- Owner/moderator permissions are checked per mutation.
- Owner-only operations include approval/rejection, moderator toggles, kicks,
  and group removal.

Be careful: `updateGroup` currently checks
`group.creatorId !== ctx.user.id || !group.moderators.some(...)`, which means a
user must be both creator and moderator. Do not "simplify" that without checking
intended behavior.

## Search

Core files:

- `app/lib/search.ts`
- `app/server/routers/search.ts`
- `app/routes/app/search/*`

Search uses simple PostgreSQL `contains` filters with `mode: "insensitive"`.
Pagination is cursor-based by `id`, with `limit + 1` fetches. Keep output
schemas in `app/lib/search.ts` aligned with route consumers.

## Notifications

Core files:

- `app/lib/notifications.ts`
- `app/server/routers/notification.ts`
- `app/components/topbar.tsx`

The root loader preloads the first 5 notifications and unread count. The top
bar stores a local merged notification list for the popover and fetches more
through TanStack Query. Marking a notification read updates local state and
revalidates the root loader.

`sendNotification` is admin-only. There is a `system` input check against
`SECRET`, but admin role is still required.

## Auth and users

Core files:

- `app/lib/auth/server.ts`
- `app/lib/auth/client.ts`
- `app/routes/api/auth/[...auth].ts`
- `app/routes/auth/*.tsx`
- `app/components/impersonation.tsx`
- `app/routes/app/viewuser/admin.tsx`
- `app/routes/app/administration/*`

Better Auth is configured with:

- Email/password.
- Email verification when SMTP is configured.
- Password reset email when SMTP is configured.
- Username plugin.
- Admin plugin with `adminRoles: ["admin"]`.
- SSO plugin.
- Passkey plugin.
- Custom user fields: `theme`, `forumBanned`, `forumBanReason`, `banReason`.
- Cookie prefix `polarlearn.auth`.
- Production secure cookies.

Auth hooks log sign-in, sign-up, sign-out, password reset, admin user actions,
and failed login attempts. Banned-user login errors may be enriched with the ban
reason from the database.

Admin UI uses both Better Auth admin client methods and PolarLearn tRPC admin
procedures. Check the exact caller before changing behavior.

## i18n

`app/i18n.ts` is a lightweight local translation module, not i18next. It eagerly
imports `app/i18n/*.json`, defaults to `nl`, and interpolates `{{name}}`
placeholders.

Guidelines:

- Add visible app strings to `app/i18n/nl.json`.
- Use `i18n.t("path.to.key")` or exported `t`.
- If adding a new language, add `app/i18n/<lang>.json` and ensure `APP_LANG`
  points to it.
- Better Auth has separate translations in `app/lib/auth/betterauth-i18n.ts`.

## Styling and UI

- Global CSS lives in `app/app.css`.
- Tailwind 4 is configured through CSS imports/theme variables, not a
  `tailwind.config.*` file.
- Dark mode is class-based through `@custom-variant dark (&:is(.dark *))`.
- Theme comes from `root` loader user data and is applied on `<html>`.
- Prefer existing UI wrappers in `app/components/ui` and PolarUI components
  already used in nearby code.
- Icons should usually come from `lucide-react`.
- Keep authenticated app pages visually compatible with the existing neutral
  light/dark shell.
- For list/session focused screens, remember global sidebar/topbar are hidden.

## Data validation

This codebase relies on zod schemas at the boundary between JSON storage,
server procedures, and client expectations. Reuse existing schemas before
creating new ad hoc validation.

Important schemas:

- Lists/recent items: `app/lib/list.ts`.
- List patches/diffs: `app/lib/list-diff.ts`.
- List view data: `app/lib/viewlist.ts`.
- Learn queues/logs/preferences: `app/lib/learn.ts`.
- Forum inputs/outputs: `app/lib/forum.ts`.
- Search outputs: `app/lib/search.ts`.
- Notifications: `app/lib/notifications.ts`.
- Session stats: `app/lib/stats.ts`.

## Logging

Use `logger` from `app/lib/logger.ts` for meaningful server-side events. The app
already logs auth, list, learn, forum, group, notification, and admin actions.
Prefer structured objects with an `event` field over unstructured strings.

In development, Prisma query logging is enabled in `app/lib/db.ts` and can be
very noisy. Avoid adding console logging for normal request paths.

## Build and deployment

Docker build:

- Base image: `node:20-alpine`.
- Enables Corepack and pins pnpm `10.24.0`.
- Runs `prisma generate`.
- Runs `pnpm run build`.
- Copies `build`, generated `app/prisma`, `prisma`, `prisma.config.ts`, and
  `docker-entrypoint.sh` into the runtime image.

GitHub Actions:

- `.github/workflows/container.yml` builds and pushes GHCR images for branch
  `v2`, tags matching `v*`, and manual dispatch.
- It tags branch/tag/sha/latest and calls a deployment webhook secret after
  pushing.

## Tests

Vitest is configured for Node in `vitest.config.ts` with `tests/setup.ts`.
Current setup only loads `dotenv/config`.

When adding non-trivial domain logic, add a focused test near the relevant
module or under `tests`. Good candidates:

- Answer syntax and learning queue behavior.
- List diff/snapshot/versioning helpers.
- Forum vote total helpers.
- Session summary calculations.

For route/UI changes, at least run `pnpm run typecheck`; run `pnpm run build`
when touching routing, SSR, Vite config, or imports used by loaders.

## Known quirks and traps

- `app/prisma` is generated, not currently present in a fresh checkout listing.
  Generate it before relying on imports from `~/prisma/client`.
- The Prisma schema has comments warning not to switch generator providers.
  The practical reason: code imports the generated client from `app/prisma`.
- `Config.key` is globally unique even though rows also have `scope`; admin
  announcement code uses key `"announcement"` and scope `"global"` by default.
- `adminRouter.setAnnouncement` uses an upsert shape that should be checked
  carefully against the Prisma schema before changing.
- `TopBar` currently contains creation dialogs for lists, posts, and groups.
- Many pages rely on root loader data through `useRouteLoaderData("root")`;
  changing root loader shape can break distant components.
- `shouldRevalidate() { return false }` is used in root and viewlist layout.
  If a change depends on loader refresh, explicitly revalidate or revisit that.
- Learn progress counts only correct answers as completed; incorrect answers
  remain in the queue.
- Learning multiple-choice option ordering is deterministic per question id, not
  freshly shuffled on every render.
- Account export has a seven-day cooldown enforced by `User.lastExportedAt`.

## Change guidance for agents

- Read the domain helper and router before editing a route that consumes them.
- Prefer modifying one shared schema/helper over patching every caller.
- Keep user/auth/permission checks on the server. Client-side hiding is not
  authorization.
- For JSON stored in Prisma, parse with zod before using it.
- For list edits, preserve optimistic conflict checks and session invalidation.
- For auth/admin work, use Better Auth APIs where the app already uses them.
- For UI additions, reuse existing components and translation patterns.
- For database schema changes, update Prisma schema, regenerate the client, and
  check every affected relation include/select.
- For new tRPC procedures, add input schemas, enforce authorization inside the
  procedure, and consume through `useTRPC()` or server callers.
- Do not add a new dependency for small parsing/formatting/helpers unless the
  existing stack cannot reasonably do it.
- Keep generated artifacts out of commits unless the repo already tracks them.

## Fast orientation by task

- "Auth is broken": start at `app/lib/auth/server.ts`,
  `app/routes/api/auth/[...auth].ts`, then the relevant auth route.
- "tRPC call is broken": start at `app/server/main.ts`,
  `app/server/trpc.ts`, the feature router, then the route/component caller.
- "List editing/versioning is broken": start at `app/server/routers/lists.ts`,
  `app/lib/list-diff.ts`, and `app/routes/app/editlist/[id].tsx`.
- "Learn session is wrong": start at `app/lib/learn.ts`,
  `app/routes/app/session/store.tsx`, and
  `app/server/routers/learning.ts`.
- "Forum issue": start at `app/lib/forum.ts`,
  `app/server/routers/forum.ts`, and `app/routes/app/forum/*`.
- "Group issue": start at `app/server/routers/groups.ts` and
  `app/routes/app/group/*`.
- "Search issue": start at `app/lib/search.ts`,
  `app/server/routers/search.ts`, and `app/routes/app/search/*`.
- "Notification issue": start at `app/lib/notifications.ts`,
  `app/server/routers/notification.ts`, `app/root.tsx`, and
  `app/components/topbar.tsx`.
- "Admin/user issue": start at `app/lib/auth/server.ts`,
  `app/routes/app/viewuser/admin.tsx`, `app/routes/app/administration/*`, and
  `app/server/routers/admin.ts`.
