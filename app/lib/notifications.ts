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

import z from "zod";
import {
  Info,
  AlertTriangle,
  CheckCircle,
  Bell,
  Star,
  MailCheck,
  type LucideIcon,
} from "lucide-react";

export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  content: z.string(),
  icon: z.string(),
  navigate: z.string().optional(),
  read: z.boolean(),
  createdAt: z.string(),
})

export type Notification = z.infer<typeof notificationSchema>;

export const getNotificationsInputSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export const getNotificationsOutputSchema = z.object({
  notifications: z.array(notificationSchema),
  nextCursor: z.string().optional(),
});

export const notificationIcons: readonly {
  value: string;
  labelKey: string;
  icon: LucideIcon;
}[] = [
  { value: "info", labelKey: "admin.users.notificationIcons.info", icon: Info },
  { value: "warning", labelKey: "admin.users.notificationIcons.warning", icon: AlertTriangle },
  { value: "success", labelKey: "admin.users.notificationIcons.success", icon: CheckCircle },
  { value: "bell", labelKey: "admin.users.notificationIcons.bell", icon: Bell },
  { value: "star", labelKey: "admin.users.notificationIcons.star", icon: Star },
  { value: "mail", labelKey: "admin.users.notificationIcons.mail", icon: MailCheck },
] as const;
