import type { DecodedSave } from "@/lib/balatro/decoder"

/**
 * Update money in the save
 */
export function updateMoney(save: DecodedSave, money: number): DecodedSave {
  return {
    ...save,
    GAME: {
      ...(save.GAME as Record<string, unknown>),
      dollars: money,
    },
  }
}

/**
 * Update chips in the save
 */
export function updateChips(save: DecodedSave, chips: number): DecodedSave {
  return {
    ...save,
    GAME: {
      ...(save.GAME as Record<string, unknown>),
      chips: chips,
    },
  }
}

/**
 * Max money and chips
 */
export function maxCurrency(save: DecodedSave): DecodedSave {
  return {
    ...save,
    GAME: {
      ...(save.GAME as Record<string, unknown>),
      dollars: 999999999,
      chips: 999999999,
    },
  }
}

/**
 * Unlock all jokers
 */
export function unlockAllJokers(save: DecodedSave): DecodedSave {
  const discovered = save.DISCOVERED as Record<string, unknown>
  const newDiscovered = { ...discovered }

  // Unlock all jokers (j_* entries)
  Object.keys(newDiscovered).forEach((key) => {
    if (key.startsWith("j_")) {
      newDiscovered[key] = true
    }
  })

  return {
    ...save,
    DISCOVERED: newDiscovered,
  }
}

/**
 * Unlock all card types
 */
export function unlockAllCards(save: DecodedSave): DecodedSave {
  const discovered = save.DISCOVERED as Record<string, unknown>
  const newDiscovered = { ...discovered }

  // Unlock all card types (c_* entries)
  Object.keys(newDiscovered).forEach((key) => {
    if (key.startsWith("c_") || key.startsWith("e_") || key.startsWith("m_")) {
      newDiscovered[key] = true
    }
  })

  return {
    ...save,
    DISCOVERED: newDiscovered,
  }
}

/**
 * Unlock all decks
 */
export function unlockAllDecks(save: DecodedSave): DecodedSave {
  const discovered = save.DISCOVERED as Record<string, unknown>
  const newDiscovered = { ...discovered }

  // Unlock all decks (b_* entries)
  Object.keys(newDiscovered).forEach((key) => {
    if (key.startsWith("b_")) {
      newDiscovered[key] = true
    }
  })

  return {
    ...save,
    DISCOVERED: newDiscovered,
  }
}

/**
 * Unlock all vouchers
 */
export function unlockAllVouchers(save: DecodedSave): DecodedSave {
  const discovered = save.DISCOVERED as Record<string, unknown>
  const newDiscovered = { ...discovered }

  // Unlock all vouchers (v_* entries)
  Object.keys(newDiscovered).forEach((key) => {
    if (key.startsWith("v_")) {
      newDiscovered[key] = true
    }
  })

  return {
    ...save,
    DISCOVERED: newDiscovered,
  }
}

/**
 * Unlock everything in the game
 */
export function unlockAll(save: DecodedSave): DecodedSave {
  const discovered = save.DISCOVERED as Record<string, unknown>
  const newDiscovered = { ...discovered }

  // Unlock everything
  Object.keys(newDiscovered).forEach((key) => {
    newDiscovered[key] = true
  })

  return {
    ...save,
    DISCOVERED: newDiscovered,
  }
}

/**
 * Complete all challenges
 */
export function completeAllChallenges(save: DecodedSave): DecodedSave {
  const challenges = save.CHALLENGES as Record<string, unknown>
  const newChallenges = { ...challenges }

  // Complete all challenges
  Object.keys(newChallenges).forEach((key) => {
    if (typeof newChallenges[key] === "object" && newChallenges[key] !== null) {
      newChallenges[key] = {
        ...(newChallenges[key] as Record<string, unknown>),
        completed: true,
      }
    }
  })

  return {
    ...save,
    CHALLENGES: newChallenges,
  }
}

/**
 * Update hand size
 */
export function updateHandSize(save: DecodedSave, handSize: number): DecodedSave {
  return {
    ...save,
    GAME: {
      ...(save.GAME as Record<string, unknown>),
      hand_size: handSize,
    },
  }
}

/**
 * Update hands remaining
 */
export function updateHands(save: DecodedSave, hands: number): DecodedSave {
  return {
    ...save,
    GAME: {
      ...(save.GAME as Record<string, unknown>),
      hands: hands,
    },
  }
}

/**
 * Update discards remaining
 */
export function updateDiscards(save: DecodedSave, discards: number): DecodedSave {
  return {
    ...save,
    GAME: {
      ...(save.GAME as Record<string, unknown>),
      discards: discards,
    },
  }
}

/**
 * Update joker slots
 */
export function updateJokerSlots(save: DecodedSave, slots: number): DecodedSave {
  return {
    ...save,
    GAME: {
      ...(save.GAME as Record<string, unknown>),
      joker_slots: slots,
    },
  }
}
