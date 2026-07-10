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

import { createTRPCRouter, publicProcedure } from "~/server/trpc";
import {
	getPostsOutputSchema,
	getUserVote,
} from "~/lib/forum";
import {
	searchForumInputSchema,
	searchGroupsInputSchema,
	searchGroupsOutputSchema,
	searchListsInputSchema,
	searchListsOutputSchema,
	searchUsersInputSchema,
	searchUsersOutputSchema,
} from "~/lib/search";

function paginateByCursor<T extends { id: string }>(items: T[], limit: number) {
	const hasNextPage = items.length > limit;
	let nextCursor: string | null = null;

	if (hasNextPage) {
		const lastItem = items.pop();
		nextCursor = lastItem?.id ?? null;
	}

	return { items, nextCursor };
}

export const searchRouter = createTRPCRouter({
	searchLists: publicProcedure
		.input(searchListsInputSchema)
		.query(async ({ input, ctx }) => {
			const { q, cursor, limit } = input;

			const lists = await ctx.prisma.list.findMany({
				where: {
					OR: [
						{ name: { contains: q, mode: "insensitive" } },
						{ description: { contains: q, mode: "insensitive" } },
					],
				},
				orderBy: [{ verified: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
				take: limit + 1,
				cursor: cursor ? { id: cursor } : undefined,
				select: {
					id: true,
					name: true,
					subject: true,
					updatedAt: true,
					verified: true,
					user: {
						select: {
							id: true,
							displayUsername: true,
							username: true,
							name: true,
						},
					},
				},
			});

			const paginated = paginateByCursor(lists, limit);

			return searchListsOutputSchema.parse({
				lists: paginated.items.map((list) => ({
					...list,
					user: list.user
						? {
								id: list.user.id,
								displayUsername: list.user.displayUsername,
								username: list.user.username,
								name: list.user.name,
							}
						: null,
				})),
				nextCursor: paginated.nextCursor,
			});
		}),
	searchForum: publicProcedure
		.input(searchForumInputSchema)
		.query(async ({ input, ctx }) => {
			const { q, cursor, limit } = input;

			const posts = await ctx.prisma.forumPost.findMany({
				where: {
					deleted: false,
					isReply: false,
					NOT: {
						category: "pr-discussion",
					},
					OR: [
						{ title: { contains: q, mode: "insensitive" } },
						{ content: { contains: q, mode: "insensitive" } },
					],
				},
				include: {
					author: {
						select: {
							id: true,
							name: true,
							displayUsername: true,
							role: true,
							image: true,
						},
					},
				},
				orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
				take: limit + 1,
				cursor: cursor ? { id: cursor } : undefined,
			});

			const paginated = paginateByCursor(posts, limit);
			const currentUserId = ctx.user?.id ?? null;

			return getPostsOutputSchema.parse({
				posts: paginated.items.map((post) => ({
					...post,
					currentUserVote: getUserVote(post.voters, currentUserId),
				})),
				nextCursor: paginated.nextCursor,
			});
		}),
	searchGroups: publicProcedure
		.input(searchGroupsInputSchema)
		.query(async ({ input, ctx }) => {
			const { q, cursor, limit } = input;

			const groups = await ctx.prisma.group.findMany({
				where: {
					OR: [
						{ name: { contains: q, mode: "insensitive" } },
						{ description: { contains: q, mode: "insensitive" } },
					],
				},
				orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
				take: limit + 1,
				cursor: cursor ? { id: cursor } : undefined,
				select: {
					id: true,
					name: true,
					image: true,
					members: {
						select: {
							id: true,
						},
					},
				},
			});

			const paginated = paginateByCursor(groups, limit);

			return searchGroupsOutputSchema.parse({
				groups: paginated.items,
				nextCursor: paginated.nextCursor,
			});
		}),
	searchUser: publicProcedure
		.input(searchUsersInputSchema)
		.query(async ({ input, ctx }) => {
			const { q, cursor, limit } = input;

			const users = await ctx.prisma.user.findMany({
				where: {
					OR: [
						{ name: { contains: q, mode: "insensitive" } },
						{ displayUsername: { contains: q, mode: "insensitive" } },
						{ username: { contains: q, mode: "insensitive" } },
					],
				},
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: limit + 1,
				cursor: cursor ? { id: cursor } : undefined,
				select: {
					id: true,
					name: true,
					displayUsername: true,
					username: true,
					image: true,
					role: true,
					createdAt: true,
				},
			});

			const paginated = paginateByCursor(users, limit);

			return searchUsersOutputSchema.parse({
				users: paginated.items,
				nextCursor: paginated.nextCursor,
			});
		}),
});
