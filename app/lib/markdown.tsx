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

// Copied/ported from PolarLearn V1 :), dont mind the shitty code :D

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import i18n from "~/i18n";

const ALERT_LABELS: Record<string, string> = {
  NOTE: i18n.t("markdown.alerts.note",),
  TIP: i18n.t("markdown.alerts.tip"),
  IMPORTANT: i18n.t("markdown.alerts.important"),
  WARNING: i18n.t("markdown.alerts.warning"),
  CAUTION: i18n.t("markdown.alerts.caution"),
};

const ALERT_MAP: Record<string, { color: string; icon: string }> = {
  NOTE: { color: '#3b82f6', icon: 'ℹ️' },
  TIP: { color: '#22c55e', icon: '💡' },
  IMPORTANT: { color: '#a21caf', icon: '💬' },
  WARNING: { color: '#f59e42', icon: '⚠️' },
  CAUTION: { color: '#ef4444', icon: '⛔' },
};

interface GfmAlertProps {
  type: string;
  children: React.ReactNode;
}

function GfmAlert({ type, children }: GfmAlertProps) {
  const alert = ALERT_MAP[type];
  const label = ALERT_LABELS[type] || ALERT_LABELS.NOTE;
  return (
    <div
      className="my-4 flex flex-col border-l-4 px-4 py-2"
      style={{ borderColor: alert.color, background: 'rgba(24,26,32,0.7)' }}
    >
      <div className="flex items-center gap-2 font-semibold" style={{ color: alert.color }}>
        <span>{alert.icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-invert max-w-none wrap-break-word">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize, rehypeHighlight]}
        components={{
          blockquote({ children }) {
            function extractText(child: React.ReactNode): string {
              if (typeof child === 'string') return child;
              if (Array.isArray(child)) return child.map(extractText).join(' ');
              const element = child as React.ReactElement<{ children?: React.ReactNode }>;
              if (React.isValidElement(child) && typeof element.props.children === 'string') {
                return element.props.children;
              }
              if (React.isValidElement(child) && element.props.children) {
                return extractText(element.props.children);
              }
              return '';
            }
            const arr = React.Children.toArray(children);
            const fullText = arr.map(extractText).join(' ').trim();
            const alertRegex = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](.*)$/s;
            const alertMatch = alertRegex.exec(fullText);
            if (alertMatch) {
              const type = alertMatch[1].toUpperCase();
              const content = fullText.replace(/^\[!.*?\]/, '').trim();
              return <GfmAlert type={type}>{content}</GfmAlert>;
            }
            return <blockquote>{children}</blockquote>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;