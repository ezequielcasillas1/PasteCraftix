/** Approved funky-animal suffixes. Keep in sync with supabase/functions/_shared/animals.ts */
export const FUNKY_ANIMALS = Object.freeze([
  'Aardvark', 'Anteater', 'Armadillo', 'Badger', 'Bat', 'Bear', 'Beaver', 'Bison', 'Bobcat', 'Buffalo',
  'Camel', 'Capuchin', 'Caribou', 'Cat', 'Cheetah', 'Chimpanzee', 'Chipmunk', 'Cougar', 'Coyote', 'Deer',
  'Dingo', 'Dog', 'Donkey', 'Elephant', 'Elk', 'Ferret', 'Fox', 'Gazelle', 'Giraffe', 'Goat', 'Gorilla',
  'Hamster', 'Hare', 'Hedgehog', 'Hippo', 'Horse', 'Hyena', 'Ibex', 'Impala', 'Jackal', 'Jaguar', 'Kangaroo',
  'Koala', 'Lemur', 'Leopard', 'Lion', 'Llama', 'Lynx', 'Manatee', 'Meerkat', 'Mink', 'Mole', 'Monkey',
  'Moose', 'Mouse', 'Narwhal', 'Okapi', 'Opossum', 'Orangutan', 'Orca', 'Otter', 'Panda', 'Panther', 'Pig',
  'Platypus', 'PolarBear', 'Porcupine', 'Possum', 'Rabbit', 'Raccoon', 'Ram', 'Rat', 'Reindeer', 'Rhino',
  'Seal', 'Sheep', 'Shrew', 'Skunk', 'Sloth', 'Squirrel', 'Tiger', 'Walrus', 'Warthog', 'Weasel', 'Whale',
  'Wolf', 'Wolverine', 'Yak', 'Zebra',
  'Albatross', 'BaldEagle', 'BlueJay', 'Canary', 'Cardinal', 'Cockatoo', 'Condor', 'Crane', 'Crow', 'Cuckoo',
  'Duck', 'Eagle', 'Emu', 'Falcon', 'Finch', 'Flamingo', 'Goose', 'Hawk', 'Heron', 'Hummingbird', 'Ibis',
  'Jay', 'Kingfisher', 'Kiwi', 'Kookaburra', 'Lark', 'Loon', 'Macaw', 'Magpie', 'Mallard', 'Nightingale',
  'Ostrich', 'Owl', 'Parrot', 'Partridge', 'Peacock', 'Pelican', 'Penguin', 'Pheasant', 'Pigeon', 'Puffin',
  'Quail', 'Raven', 'Robin', 'Rooster', 'Seagull', 'Sparrow', 'Spoonbill', 'Stork', 'Swan', 'Toucan', 'Turkey',
  'Vulture', 'Woodpecker',
  'Angelfish', 'Barracuda', 'Bass', 'Betta', 'Bluefish', 'Bonefish', 'Bowfin', 'Brill', 'Bullhead', 'Carp',
  'Catfish', 'Char', 'Clownfish', 'Cod', 'Eel', 'Flounder', 'FlyingFish', 'Goby', 'Goldfish', 'Grouper',
  'Guppy', 'Haddock', 'Halibut', 'Hammerhead', 'Herring', 'Koi', 'Mackerel', 'MahiMahi', 'Marlin', 'Minnow',
  'Moray', 'Mudfish', 'Mullet', 'Needlefish', 'Perch', 'Pike', 'Piranha', 'Plaice', 'Pollock', 'Pufferfish',
  'RainbowTrout', 'Ray', 'Roach', 'Salmon', 'Sardine', 'Seahorse', 'Shark', 'Sheepshead', 'Snapper', 'Sole',
  'Stingray', 'Sturgeon', 'Swordfish', 'Tarpon', 'Tetra', 'Tilapia', 'Trout', 'Tuna', 'Walleye', 'Whitefish',
  'Wrasse', 'Zebrafish',
  'Alligator', 'Anole', 'Chameleon', 'Cobra', 'Crocodile', 'Frog', 'Gecko', 'Iguana', 'Komodo', 'Lizard',
  'Newt', 'Python', 'Rattlesnake', 'Salamander', 'Snake', 'Terrapin', 'Toad', 'Tortoise', 'Turtle', 'Viper',
  'Ant', 'Bee', 'Beetle', 'Butterfly', 'Centipede', 'Cicada', 'Crab', 'Dragonfly', 'Firefly', 'Grasshopper',
  'Jellyfish', 'Ladybug', 'Lobster', 'Mantis', 'Moth', 'Octopus', 'Scorpion', 'Shrimp', 'Spider', 'Squid',
  'Dragon', 'Griffin', 'Hydra', 'Kraken', 'Pegasus', 'Phoenix', 'Unicorn',
])

function buildAnimalSuffixPattern(animals = FUNKY_ANIMALS) {
  const sorted = [...animals].sort((a, b) => b.length - a.length)
  return sorted.join('|')
}

/** Regex for parsing the trailing animal token from a funky name. */
export const ANIMAL_TYPES_REGEX = new RegExp(`(${buildAnimalSuffixPattern()})$`, 'i')

export function extractAnimalSuffix(name) {
  if (typeof name !== 'string') return null
  const match = name.match(ANIMAL_TYPES_REGEX)
  return match ? match[1] : null
}
