import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "list"; items: string[] };

interface LegalMarkdownRendererProps {
  markdown: string;
  isRTL?: boolean;
}

function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    blocks.push({
      type: "p",
      text: paragraphBuffer.join(" ").trim(),
    });
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listBuffer.length) return;
    blocks.push({
      type: "list",
      items: [...listBuffer],
    });
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      listBuffer.push(line.slice(2).trim());
      continue;
    }

    flushList();
    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

export const LegalMarkdownRenderer: React.FC<LegalMarkdownRendererProps> = ({
  markdown,
  isRTL = false,
}) => {
  const blocks = useMemo(() => parseMarkdown(markdown), [markdown]);

  return (
    <View style={styles.wrapper}>
      {blocks.map((block, idx) => {
        const key = `${block.type}-${idx}`;
        const rtlStyle = isRTL ? styles.rtlText : null;

        if (block.type === "h1") {
          return (
            <Text key={key} style={[styles.h1, rtlStyle]}>
              {block.text}
            </Text>
          );
        }
        if (block.type === "h2") {
          return (
            <Text key={key} style={[styles.h2, rtlStyle]}>
              {block.text}
            </Text>
          );
        }
        if (block.type === "h3") {
          return (
            <Text key={key} style={[styles.h3, rtlStyle]}>
              {block.text}
            </Text>
          );
        }
        if (block.type === "p") {
          return (
            <Text key={key} style={[styles.paragraph, rtlStyle]}>
              {block.text}
            </Text>
          );
        }
        return (
          <View key={key} style={styles.list}>
            {block.items.map((item, itemIdx) => (
              <View key={`${key}-${itemIdx}`} style={styles.listItemRow}>
                <Text style={[styles.bullet, rtlStyle]}>{isRTL ? "•" : "•"}</Text>
                <Text style={[styles.listItemText, rtlStyle]}>{item}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  h1: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#111827",
    marginTop: 6,
    marginBottom: 4,
  },
  h2: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "700",
    color: "#111827",
    marginTop: 8,
    marginBottom: 2,
  },
  h3: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 6,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: "#374151",
  },
  list: {
    gap: 8,
    marginTop: 2,
  },
  listItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bullet: {
    fontSize: 17,
    lineHeight: 24,
    color: "#111827",
    marginTop: -1,
  },
  listItemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    color: "#374151",
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});

