import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

// Yazılar veritabanında Markdown olarak saklanır (yazar düzenleyebilsin diye).
// Okunurken bu fonksiyonla güvenli HTML'e çevrilir: <script>, onclick=, javascript: bağlantıları
// gibi zararlı içerikler rehype-sanitize ile temizlenir.
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify);

export async function renderMarkdown(markdown: string): Promise<string> {
  return String(await processor.process(markdown));
}

// Liste sayfaları için kısa, düz metin özet
export function excerpt(markdown: string, length = 200): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    // HTML etiketleri ve içerikleri (script/style) özete girmez
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}
