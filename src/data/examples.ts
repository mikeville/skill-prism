// Curated pool of learning topics: mix of practical, everyday, personal development, and whimsical
export const EXAMPLE_POOL = [
  // Career / practical upskilling
  'agentic design',
  'cybersecurity',

  // Everyday / informal learning
  'baking',
  'make money',
  'foreign language',
  'guitar',
  'minimalism',
  'self defense',

  // Mental health & personal development
  'anxiety',
  'sleep',
  'attachment styles',
  'procrastination',
  'stop being an asshole',
  'stop people pleasing',

  // Thought-provoking
  'consciousness',
  'time',
  'love',
  'animal minds',
  'memetics',

  // History
  'ancient mysteries',
  'Greco-Buddhist kingdoms',
  'earth before humans',
  'The Dancing Plague',
  'The Carrington Event',

  // Funny
  'high five or fist bump',
  'escape a volcano',
  'how to be a human',
  'how to end a hug',
  'small talk',
  'outrun a moose',
  'spot a serial killer',
  'eat messy food on a date',
  'mosh pits',
  'animal CPR',
] as const;

// Helper to randomly select N unique items from the pool
export function selectRandomExamples(count: number): string[] {
  const shuffled = [...EXAMPLE_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
