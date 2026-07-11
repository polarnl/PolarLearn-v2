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

import * as React from "react"
import { Avatar as AvatarPrimitive } from "radix-ui"

import { cn } from "~/lib/utils"

type AvatarImageProps = React.ComponentProps<typeof AvatarPrimitive.Image>

const AvatarImageContext = React.createContext<{
  imageSrc?: string
  failedImageSrc?: string
  setFailedImageSrc: React.Dispatch<React.SetStateAction<string | undefined>>
} | null>(null)

function getAvatarImageSrc(children: React.ReactNode) {
  const image = React.Children.toArray(children).find(
    (child): child is React.ReactElement<AvatarImageProps> => React.isValidElement<AvatarImageProps>(child) && child.type === AvatarImage,
  )

  return image?.props.src || undefined
}

function Avatar({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "sm" | "lg"
}) {
  const imageSrc = getAvatarImageSrc(children)
  const [failedImageSrc, setFailedImageSrc] = React.useState<string>()

  return (
    <AvatarImageContext.Provider value={{ imageSrc, failedImageSrc, setFailedImageSrc }}>
      <AvatarPrimitive.Root
        data-slot="avatar"
        data-size={size}
        className={cn(
          "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
          className
        )}
        {...props}
      >
        {children}
      </AvatarPrimitive.Root>
    </AvatarImageContext.Provider>
  )
}

function AvatarImage({
  className,
  onLoadingStatusChange,
  ...props
}: AvatarImageProps) {
  const avatar = React.useContext(AvatarImageContext)

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      onLoadingStatusChange={(status) => {
        onLoadingStatusChange?.(status)
        avatar?.setFailedImageSrc(status === "error" ? props.src : undefined)
      }}
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  const avatar = React.useContext(AvatarImageContext)

  if (avatar?.imageSrc && avatar.failedImageSrc !== avatar.imageSrc) return null

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
