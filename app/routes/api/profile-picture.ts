// PolarLearn: A free, open-source learning platform.
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

import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3"
import sharp from "sharp"

import { prisma } from "~/lib/db"
import { logger } from "~/lib/logger"
import { s3 } from "~/lib/s3"
import { getRequestSession } from "~/server/trpc"
import type { Route } from "./+types/profile-picture"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

async function deleteProfilePictures(bucket: string, userId: string, except?: string) {
  const objects = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: `uploads/pfp/${userId}`,
  }))

  await Promise.all(
    (objects.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => Boolean(key) && key !== except)
      .map((key) => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))),
  )
}

function error(code: string, status: number) {
  return Response.json({ code }, { status })
}

export async function action({ request }: Route.ActionArgs) {
  const bucket = process.env.S3_BUCKET
  const endpoint = process.env.S3_ENDPOINT
  if (!bucket || !endpoint) return error("S3_UNCONFIGURED", 503)

  const headers = new Headers(request.headers)
  const session = await getRequestSession({ headers, request })
  if (!session?.user) return error("UNAUTHORIZED", 401)

  if (request.method === "DELETE") {
    try {
      await deleteProfilePictures(bucket, session.user.id)
      await prisma.user.update({ where: { id: session.user.id }, data: { image: null } })
      logger.info({ event: "user.profile-picture.deleted", userId: session.user.id })
      return Response.json({ imageUrl: null })
    } catch (cause) {
      logger.error({ event: "user.profile-picture.delete-failed", userId: session.user.id, cause })
      return error("DELETE_FAILED", 500)
    }
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return error("INVALID_IMAGE", 400)
  }

  const image = formData.get("image")
  if (!(image instanceof File) || !IMAGE_TYPES.has(image.type)) return error("INVALID_IMAGE", 400)
  if (image.size > MAX_FILE_SIZE) return error("IMAGE_TOO_LARGE", 400)

  let body: Buffer
  try {
    body = await sharp(Buffer.from(await image.arrayBuffer()), { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(512, 512, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer()
  } catch (cause) {
    logger.warn({ event: "user.profile-picture.processing-failed", userId: session.user.id, cause })
    return error("INVALID_IMAGE", 400)
  }

  const key = `uploads/pfp/${session.user.id}-${Date.now()}.webp`
  const imageUrl = new URL(endpoint)
  if (process.env.S3_USE_PATH_STYLE === "true") {
    imageUrl.pathname = `${imageUrl.pathname.replace(/\/$/, "")}/${bucket}/${key}`
  } else {
    imageUrl.hostname = `${bucket}.${imageUrl.hostname}`
    imageUrl.pathname = `${imageUrl.pathname.replace(/\/$/, "")}/${key}`
  }

  try {
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "image/webp",
      ContentDisposition: "inline",
      CacheControl: "public, max-age=31536000, immutable",
    }))
    await prisma.user.update({
      where: {
        id: session.user.id
      },
      data: {
        image: imageUrl.toString()
      }
    })
    try {
      await deleteProfilePictures(bucket, session.user.id, key)
    } catch (cause) {
      logger.warn({ event: "user.profile-picture.rm-failed", userId: session.user.id, cause })
    }
    logger.info({ event: "user.profile-picture.updated", userId: session.user.id })
    return Response.json({ imageUrl: imageUrl.toString() })
  } catch (cause) {
    logger.error({ event: "user.profile-picture.upload-failed", userId: session.user.id, cause })
    return error("UPLOAD_FAILED", 500)
  }
}
