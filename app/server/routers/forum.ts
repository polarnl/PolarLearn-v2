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

import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { logger as appLogger } from "~/lib/logger";
import {
  getPostsInputSchema,
  getPostsOutputSchema,
  getPostInputSchema,
  postSchema,
  createPostInputSchema,
  createPostOutputSchema,
  editPostInputSchema,
  editPostOutputSchema,
  deletePostInputSchema,
  votersSchema,
  hydrateVoters,
  calculateVoteTotals,
  replyToPostInputSchema,
  votePostInputSchema,
  votePostOutputSchema,
  getPostRepliesInputSchema,
  getPostRepliesOutputSchema,
  getMyRepliesInputSchema,
} from "~/lib/forum";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/trpc";
import { t } from "~/i18n";

export const forumRouter = createTRPCRouter({
  getPosts: publicProcedure
    .input(getPostsInputSchema)
    .output(getPostsOutputSchema)
    .query(async ({ input, ctx }) => {
      const { cursor, limit, category, authorId } = input;
      const posts = await ctx.prisma.forumPost.findMany({
        where: {
          category: category ?? undefined,
          authorId: authorId ?? undefined,
          isReply: false,
          deleted: false,
          NOT: {
            category: "pr-discussion",
          },
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
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
      });
      const hasNextPage = posts.length > limit;
      let nextCursor: string | null = null;
      if (hasNextPage) {
        const lastPost = posts.pop();
        if (lastPost) {
          nextCursor = lastPost.id;
        }
      }

      return getPostsOutputSchema.parse({
        posts: await hydrateVoters(ctx.prisma, posts),
        nextCursor,
      });
    }),
  getPost: publicProcedure
    .input(getPostInputSchema)
    .output(postSchema)
    .query(async ({ input, ctx }) => {
      const { postId } = input;
      const post = await ctx.prisma.forumPost.findUnique({
        where: { id: postId },
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
      });
      if (!post || post.deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      }

      return postSchema.parse((await hydrateVoters(ctx.prisma, [post]))[0]);
    }),
  createPost: protectedProcedure
    .input(createPostInputSchema)
    .output(createPostOutputSchema)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.forumBanned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: ctx.user.forumBanReason?.trim(),
        });
      }
      const { title, content, subject, category } = input;
      if (category === "announcement" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const post = await ctx.prisma.forumPost.create({
        data: {
          id: crypto.randomUUID(),
          title,
          content,
          subject: subject ?? null,
          category,
          voters: {},
          cachedTotalVotes: 0,
          author: {
            connect: {
              id: ctx.user.id,
            },
          },
        },
      });
      appLogger.info({
        event: "forum.post.created",
        userId: ctx.user.id,
        postId: post.id,
        category,
        subject: subject ?? null,
        title,
      });
      return createPostOutputSchema.parse(post);
    }),
  editPost: protectedProcedure
    .input(editPostInputSchema)
    .output(editPostOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, title, content, subject, category } = input;
      const post = await ctx.prisma.forumPost.findUnique({
        where: { id },
        select: { authorId: true },
      });
      if (!post)
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      if (post.authorId !== ctx.user.id && ctx.user.role !== "admin")
        throw new TRPCError({
          code: "FORBIDDEN"
        });
      if (category === "announcement" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const updatedPost = await ctx.prisma.forumPost.update({
        where: { id },
        data: {
          title: title ?? undefined,
          content: content ?? undefined,
          subject: subject ?? undefined,
          category: category ?? undefined,
        },
      });
      appLogger.info({
        event: "forum.post.updated",
        userId: ctx.user.id,
        postId: id,
        changedFields: {
          title: title !== undefined,
          content: content !== undefined,
          subject: subject !== undefined,
          category: category !== undefined,
        },
      });
      return editPostOutputSchema.parse(updatedPost);
    }),
  deletePost: protectedProcedure
    .input(deletePostInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      const post = await ctx.prisma.forumPost.findUnique({
        where: { id },
        select: { authorId: true },
      });
      if (!post)
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      if (post.authorId !== ctx.user.id && ctx.user.role !== "admin")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own posts",
        });

      await ctx.prisma.forumPost.update({
        where: { id },
        data: { deleted: true },
      });
      appLogger.info({
        event: "forum.post.deleted",
        userId: ctx.user.id,
        postId: id,
      });
      return "OK";
    }),
  votePost: protectedProcedure
    .input(votePostInputSchema)
    .output(votePostOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const { postId, vote } = input;
      const post = await ctx.prisma.forumPost.findUnique({
        where: { id: postId },
        select: { voters: true, deleted: true },
      });
      if (!post || post.deleted)
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });

      const parsedVoters = votersSchema.safeParse(post.voters);
      let voters = parsedVoters.success ? parsedVoters.data : {};
      const userId = ctx.user.id;
      const currentVote = voters[userId];

      if (currentVote === vote) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [userId]: _, ...restVoters } = voters;
        voters = restVoters;
      } else {
        voters = { ...voters, [userId]: vote };
      }

      const { votes, cachedTotalVotes } = calculateVoteTotals(voters);

      await ctx.prisma.forumPost.update({
        where: { id: postId },
        data: {
          voters,
          votes,
          cachedTotalVotes,
        },
      });

      appLogger.info({
        event: "forum.post.voted",
        userId: ctx.user.id,
        postId,
        vote,
        previousVote: currentVote ?? null,
        toggledOff: currentVote === vote,
        votes,
        cachedTotalVotes,
      });

      const [hydratedPost] = await hydrateVoters(ctx.prisma, [{ voters }]);
      return { votes, cachedTotalVotes, voters, voterProfiles: hydratedPost.voterProfiles };
    }),
  replyToPost: protectedProcedure
    .input(replyToPostInputSchema)
    .output(postSchema)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.forumBanned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: ctx.user.forumBanReason?.trim(),
        });
      }
      const { postId, content } = input;
      const parentPost = await ctx.prisma.forumPost.findUnique({
        where: { id: postId },
        select: {
          authorId: true,
          category: true,
          subject: true,
          title: true,
          deleted: true,
        },
      });
      if (!parentPost || parentPost.deleted)
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });

      const reply = await ctx.prisma.forumPost.create({
        data: {
          id: crypto.randomUUID(),
          content,
          isReply: true,
          replyToId: postId,
          authorId: ctx.user.id,
          category: parentPost.category,
          subject: parentPost.subject,
          voters: {},
          cachedTotalVotes: 0,
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
      });

      if (parentPost.authorId !== ctx.user.id) {
        const replierName = ctx.user.name?.trim() || "?";
        const postTitle = parentPost.title?.trim() || "?";

        await ctx.prisma.notification.create({
          data: {
            id: crypto.randomUUID(),
            userId: parentPost.authorId,
            content: t("forum.post.notification", { title: postTitle, username: replierName }),
            icon: "mail",
            navigate: `/app/forum/posts/${postId}`,
          },
        });
      }

      appLogger.info({
        event: "forum.reply.created",
        userId: ctx.user.id,
        replyId: reply.id,
        parentPostId: postId,
        category: parentPost.category,
        subject: parentPost.subject,
      });
      return postSchema.parse((await hydrateVoters(ctx.prisma, [reply]))[0]);
    }),
  pinPost: protectedProcedure
    .input(deletePostInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can pin posts",
        });
      const { id } = input;
      const post = await ctx.prisma.forumPost.findUnique({
        where: { id },
        select: { pinned: true, deleted: true },
      });
      if (!post || post.deleted)
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      await ctx.prisma.forumPost.update({
        where: { id },
        data: { pinned: !post.pinned },
      });
      appLogger.info({
        event: "forum.post.pinned_toggled",
        userId: ctx.user.id,
        postId: id,
        nextPinned: !post.pinned,
      });
      return "OK";
    }),
  getPostReplies: publicProcedure
    .input(getPostRepliesInputSchema)
    .output(getPostRepliesOutputSchema)
    .query(async ({ input, ctx }) => {
      const { postId, cursor, limit } = input;

      const replies = await ctx.prisma.forumPost.findMany({
        where: {
          replyToId: postId,
          deleted: false,
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
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
      });

      const hasNextPage = replies.length > limit;
      let nextCursor: string | null = null;
      if (hasNextPage) {
        const lastReply = replies.pop();
        if (lastReply) {
          nextCursor = lastReply.id;
        }
      }

      return getPostRepliesOutputSchema.parse({
        replies: await hydrateVoters(ctx.prisma, replies),
        nextCursor,
      });
    }),
  getMyReplies: protectedProcedure
    .input(getMyRepliesInputSchema)
    .output(getPostsOutputSchema)
    .query(async ({ input, ctx }) => {
      const { cursor, limit, category } = input;
      const replies = await ctx.prisma.forumPost.findMany({
        where: {
          authorId: ctx.user.id,
          isReply: true,
          deleted: false,
          category: category ?? undefined,
        },
        include: {
          replyTo: {
            select: {
              title: true,
            },
          },
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
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
      });
      const hasNextPage = replies.length > limit;
      let nextCursor: string | null = null;
      if (hasNextPage) {
        const lastReply = replies.pop();
        if (lastReply) {
          nextCursor = lastReply.id;
        }
      }

      const repliesWithTitle = replies.map((reply) => ({
        ...reply,
        replyToTitle: reply.replyTo?.title ?? null,
      }));

      return getPostsOutputSchema.parse({
        posts: await hydrateVoters(ctx.prisma, repliesWithTitle),
        nextCursor,
      });
    }),
});
