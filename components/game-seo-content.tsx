"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

interface FAQItem {
  question: string
  answer: string
}

interface GameSEOContentProps {
  gameName: string
  longDescription?: string
  features?: string[]
  faq?: FAQItem[]
}

export function GameSEOContent({ gameName, longDescription, features, faq }: GameSEOContentProps) {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)
  const [showContent, setShowContent] = useState(false)

  if (!longDescription && !features && !faq) {
    return null
  }

  return (
    <div className="border-t border-border mt-8 pt-8">
      <button
        onClick={() => setShowContent(!showContent)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        {showContent ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {showContent ? "Hide" : "Show"} more information about {gameName}
      </button>

      {showContent && (
        <div className="space-y-8 text-sm">
          {longDescription && (
            <section>
              <h2 className="text-xl font-semibold mb-3">About {gameName} Save Editor</h2>
              <p className="text-muted-foreground leading-relaxed">{longDescription}</p>
            </section>
          )}

          {features && features.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3">Features</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                {features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </section>
          )}

          {faq && faq.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3">Frequently Asked Questions</h2>
              <div className="space-y-3" itemScope itemType="https://schema.org/FAQPage">
                {faq.map((item, index) => (
                  <div
                    key={index}
                    className="border border-border rounded-lg overflow-hidden"
                    itemScope
                    itemProp="mainEntity"
                    itemType="https://schema.org/Question"
                  >
                    <button
                      onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                      className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex items-center justify-between gap-2"
                    >
                      <span className="font-medium" itemProp="name">
                        {item.question}
                      </span>
                      {openFAQ === index ? (
                        <ChevronUp className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 flex-shrink-0" />
                      )}
                    </button>
                    {openFAQ === index && (
                      <div
                        className="px-4 py-3 bg-accent/20 text-muted-foreground"
                        itemScope
                        itemProp="acceptedAnswer"
                        itemType="https://schema.org/Answer"
                      >
                        <p itemProp="text">{item.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
