// Curated pool of learning topics: mix of practical, everyday, personal development, and whimsical
export const EXAMPLE_POOL = [
  // Career / practical upskilling
  'machine learning',
  'data analysis',
  'cybersecurity',
  'project management',

  // Everyday / informal learning
  'cooking',
  'personal finance',
  'spanish language',
  'guitar',
  'productivity systems',

  // Mental health & personal development
  'anxiety & trauma',
  'sleep & longevity',
  'attachment styles',

  // Whimsical / thought-provoking
  'how to end a zoom',
  'consciousness',
  'time',
] as const;

// Helper to randomly select N unique items from the pool
export function selectRandomExamples(count: number): string[] {
  const shuffled = [...EXAMPLE_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
