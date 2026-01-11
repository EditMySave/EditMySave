import { generateLLMsContent } from "@/lib/seo"

export async function GET() {
  const content = generateLLMsContent()

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}
