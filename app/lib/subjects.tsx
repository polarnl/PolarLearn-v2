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

import type { ImgHTMLAttributes } from "react"

import { SubjectNamesArray, type SubjectNames } from "./subjectnames"
import { subjectIcons } from "./subjecticons"
import i18n from "../i18n"

export type SubjectIconProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">

export type SubjectMetadata = {
  icon: string
  labelKey: string
}

export const subjects = Object.fromEntries(
  SubjectNamesArray.map((id) => [
    id,
    { icon: subjectIcons[id], labelKey: `subjects.${id}` },
  ]),
) as Record<SubjectNames, SubjectMetadata>

export function getSubjectNameById(subject: SubjectNames) {
  const id = Object.hasOwn(subjectIcons, subject) ? subject : "other"
  return i18n.t(`subjects.${id}`)
}

export function getSubjectIcon(subject: SubjectNames, props: SubjectIconProps = {}) {
  const id = Object.hasOwn(subjectIcons, subject) ? subject : "other"
  return (
    <img
      src={subjectIcons[id]}
      alt={getSubjectNameById(id)}
      width={24}
      height={24}
      {...props}
    />
  )
}
