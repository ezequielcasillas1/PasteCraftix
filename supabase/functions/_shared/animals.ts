/** Approved funky-animal suffixes (CamelCase tokens). Keep extension/shared/animal-names.js in sync. */
export const FUNKY_ANIMALS: readonly string[] = [
  // Mammals
  'Aardvark', 'Anteater', 'Armadillo', 'Badger', 'Bat', 'Bear', 'Beaver', 'Bison', 'Bobcat', 'Buffalo',
  'Camel', 'Capuchin', 'Caribou', 'Cat', 'Cheetah', 'Chimpanzee', 'Chipmunk', 'Cougar', 'Coyote', 'Deer',
  'Dingo', 'Dog', 'Donkey', 'Elephant', 'Elk', 'Ferret', 'Fox', 'Gazelle', 'Giraffe', 'Goat', 'Gorilla',
  'Hamster', 'Hare', 'Hedgehog', 'Hippo', 'Horse', 'Hyena', 'Ibex', 'Impala', 'Jackal', 'Jaguar', 'Kangaroo',
  'Koala', 'Lemur', 'Leopard', 'Lion', 'Llama', 'Lynx', 'Manatee', 'Meerkat', 'Mink', 'Mole', 'Monkey',
  'Moose', 'Mouse', 'Narwhal', 'Okapi', 'Opossum', 'Orangutan', 'Orca', 'Otter', 'Panda', 'Panther', 'Pig',
  'Platypus', 'PolarBear', 'Porcupine', 'Possum', 'Rabbit', 'Raccoon', 'Ram', 'Rat', 'Reindeer', 'Rhino',
  'Seal', 'Sheep', 'Shrew', 'Skunk', 'Sloth', 'Squirrel', 'Tiger', 'Walrus', 'Warthog', 'Weasel', 'Whale',
  'Wolf', 'Wolverine', 'Yak', 'Zebra',
  // Birds
  'Albatross', 'BaldEagle', 'BlueJay', 'Canary', 'Cardinal', 'Cockatoo', 'Condor', 'Crane', 'Crow', 'Cuckoo',
  'Duck', 'Eagle', 'Emu', 'Falcon', 'Finch', 'Flamingo', 'Goose', 'Hawk', 'Heron', 'Hummingbird', 'Ibis',
  'Jay', 'Kingfisher', 'Kiwi', 'Kookaburra', 'Lark', 'Loon', 'Macaw', 'Magpie', 'Mallard', 'Nightingale',
  'Ostrich', 'Owl', 'Parrot', 'Partridge', 'Peacock', 'Pelican', 'Penguin', 'Pheasant', 'Pigeon', 'Puffin',
  'Quail', 'Raven', 'Robin', 'Rooster', 'Seagull', 'Sparrow', 'Spoonbill', 'Stork', 'Swan', 'Toucan', 'Turkey',
  'Vulture', 'Woodpecker',
  // Fish & marine
  'Angelfish', 'Barracuda', 'Bass', 'Betta', 'Bluefish', 'Bonefish', 'Bowfin', 'Brill', 'Bullhead', 'Carp',
  'Catfish', 'Char', 'Clownfish', 'Cod', 'Eel', 'Flounder', 'FlyingFish', 'Goby', 'Goldfish', 'Grouper',
  'Guppy', 'Haddock', 'Halibut', 'Hammerhead', 'Herring', 'Koi', 'Mackerel', 'MahiMahi', 'Marlin', 'Minnow',
  'Moray', 'Mudfish', 'Mullet', 'Needlefish', 'Perch', 'Pike', 'Piranha', 'Plaice', 'Pollock', 'Pufferfish',
  'RainbowTrout', 'Ray', 'Roach', 'Salmon', 'Sardine', 'Seahorse', 'Shark', 'Sheepshead', 'Snapper', 'Sole',
  'Stingray', 'Sturgeon', 'Swordfish', 'Tarpon', 'Tetra', 'Tilapia', 'Trout', 'Tuna', 'Walleye', 'Whitefish',
  'Wrasse', 'Zebrafish',
  // Reptiles & amphibians
  'Alligator', 'Anole', 'Chameleon', 'Cobra', 'Crocodile', 'Frog', 'Gecko', 'Iguana', 'Komodo', 'Lizard',
  'Newt', 'Python', 'Rattlesnake', 'Salamander', 'Snake', 'Terrapin', 'Toad', 'Tortoise', 'Turtle', 'Viper',
  // Insects & invertebrates
  'Ant', 'Bee', 'Beetle', 'Butterfly', 'Centipede', 'Cicada', 'Crab', 'Dragonfly', 'Firefly', 'Grasshopper',
  'Jellyfish', 'Ladybug', 'Lobster', 'Mantis', 'Moth', 'Octopus', 'Scorpion', 'Shrimp', 'Spider', 'Squid',
  // Mythical
  'Dragon', 'Griffin', 'Hydra', 'Kraken', 'Pegasus', 'Phoenix', 'Unicorn',
] as const

const DESCRIPTORS = ['Zesty', 'Brave', 'Cosmic', 'Funky', 'Wild', 'Bold', 'Swift', 'Mighty', 'Clever', 'Radiant']

export type AnimalDeckState = {
  remaining: string[]
  cycle: number
}

export function shuffleArray<T>(items: readonly T[]): T[] {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}

/** Merge saved deck with the current catalog and drop unknown animals. */
export function normalizeAnimalDeck(
  raw: unknown,
  catalog: readonly string[] = FUNKY_ANIMALS,
): AnimalDeckState {
  const catalogByLower = new Map(catalog.map((animal) => [animal.toLowerCase(), animal]))
  let cycle = 1
  let remaining: string[] = []
  let hasSavedRemaining = false

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.remaining)) {
      remaining = obj.remaining
        .filter((animal): animal is string => typeof animal === 'string')
        .map((animal) => catalogByLower.get(animal.toLowerCase()) || null)
        .filter((animal): animal is string => Boolean(animal))
      hasSavedRemaining = true
    }
    if (typeof obj.cycle === 'number' && obj.cycle >= 1) {
      cycle = Math.floor(obj.cycle)
    }
  }

  const remainingLower = new Set(remaining.map((animal) => animal.toLowerCase()))
  const missingCatalogAnimals = catalog.filter((animal) => !remainingLower.has(animal.toLowerCase()))

  if (missingCatalogAnimals.length > 0) {
    remaining = [...remaining, ...shuffleArray(missingCatalogAnimals)]
  }

  if (remaining.length === 0) {
    return { remaining: shuffleArray(catalog), cycle: Math.max(1, cycle) }
  }

  if (!hasSavedRemaining) {
    return { remaining: shuffleArray(remaining), cycle }
  }

  return { remaining, cycle }
}

/** Pop the next animal without replacement; reshuffle all animals when the deck empties. */
export function drawNextAnimal(
  rawDeck: unknown,
  catalog: readonly string[] = FUNKY_ANIMALS,
): { animal: string; deck: AnimalDeckState; cycleReset: boolean; cycleComplete: boolean } {
  let deck = normalizeAnimalDeck(rawDeck, catalog)
  let cycleReset = false

  if (deck.remaining.length === 0) {
    deck = { remaining: shuffleArray(catalog), cycle: deck.cycle + 1 }
    cycleReset = true
  }

  const animal = deck.remaining.pop() as string
  const cycleComplete = deck.remaining.length === 0

  return { animal, deck, cycleReset, cycleComplete }
}

export function buildFunkyNameWithAnimal(
  userName: string,
  animal: string,
  descriptor?: string,
): string {
  const cleaned = String(userName).replace(/[^a-zA-Z]/g, '')
  const prefix = cleaned.slice(0, 3) || 'User'
  const desc = descriptor || DESCRIPTORS[Math.floor(Math.random() * DESCRIPTORS.length)]
  return `${prefix.charAt(0).toUpperCase()}${prefix.slice(1).toLowerCase()}${desc}${animal}`
}

export function splitCamelCase(value: string): string[] {
  return value
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

export function buildAnimalSuffixRegex(animals: readonly string[] = FUNKY_ANIMALS): RegExp {
  const sorted = [...animals].sort((a, b) => b.length - a.length)
  return new RegExp(`(${sorted.join('|')})$`, 'i')
}

export function extractAnimalSuffix(name: string, animals: readonly string[] = FUNKY_ANIMALS): string | null {
  const match = name.match(buildAnimalSuffixRegex(animals))
  return match ? match[1] : null
}

export function pickPromptAnimalSample(count = 60, animals: readonly string[] = FUNKY_ANIMALS): string[] {
  const pool = [...animals]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(count, pool.length))
}

export function buildFallbackFunkyName(
  userName: string,
  animals: readonly string[] = FUNKY_ANIMALS,
  forcedAnimal?: string,
): string {
  const cleaned = String(userName).replace(/[^a-zA-Z]/g, '')
  const prefix = cleaned.slice(0, 3) || 'User'
  const desc = DESCRIPTORS[Math.floor(Math.random() * DESCRIPTORS.length)]
  const animal = forcedAnimal || animals[Math.floor(Math.random() * animals.length)]
  return buildFunkyNameWithAnimal(userName, animal, desc)
}

export function isValidFunkyAnimalName(
  name: string,
  userName: string,
  animals: readonly string[] = FUNKY_ANIMALS,
  requiredAnimal?: string,
): boolean {
  if (!/^[A-Za-z]+$/.test(name)) return false

  const parts = splitCamelCase(name)
  if (parts.length < 3) return false

  const suffix = parts[parts.length - 1]
  const animalOk = animals.some((animal) => animal.toLowerCase() === suffix.toLowerCase())
  if (!animalOk) return false

  if (requiredAnimal && suffix.toLowerCase() !== requiredAnimal.toLowerCase()) return false

  const remixNeedle = String(userName).replace(/[^a-zA-Z]/g, '').slice(0, 2).toLowerCase()
  if (remixNeedle.length >= 2 && !name.toLowerCase().includes(remixNeedle)) return false

  return true
}
