export function generateFAQStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is EditMySave free to use?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, EditMySave is completely free to use. All save editors are open-source and available at no cost with no hidden fees or premium features.",
        },
      },
      {
        "@type": "Question",
        name: "Is it safe to use EditMySave?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, EditMySave is safe. All save file processing happens entirely in your browser - your files never leave your device and are not uploaded to any server. However, we always recommend backing up your original save files before making any edits.",
        },
      },
      {
        "@type": "Question",
        name: "What games are supported?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "EditMySave currently supports Sworn, Megabonk, Cloverpit, Balatro, BALL x PIT, and Deep Rock Galactic: Survivor. We're continuously adding support for more games based on community demand.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need to download or install anything?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No downloads or installations are required. EditMySave is a web-based tool that works entirely in your browser. Simply visit the website, drag and drop your save file, make your edits, and download the modified save.",
        },
      },
      {
        "@type": "Question",
        name: "Which platforms are supported?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "EditMySave works on all modern browsers and operating systems including Windows, Mac, and Linux. Our save editors support games from Steam, Epic Games Store, and other platforms depending on the specific game.",
        },
      },
      {
        "@type": "Question",
        name: "Will using save editors get me banned?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "EditMySave is designed for single-player games and offline use. We do not support or condone using save editors in online or multiplayer games. Always check your game's terms of service and use save editors responsibly.",
        },
      },
    ],
  }
}

export function generateItemListStructuredData(games: Array<{ name: string; route: string; description: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: games.map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "SoftwareApplication",
        name: `${game.name} Save Editor`,
        description: game.description,
        url: `https://editmysave.app${game.route}`,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Web Browser",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
    })),
  }
}
