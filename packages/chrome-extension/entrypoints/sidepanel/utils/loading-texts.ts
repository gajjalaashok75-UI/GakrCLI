/**
 * Random Loading Texts
 * Used by TimelineStatusStep component to display fun waiting prompts
 */

const loadingTexts = [
  // Must-have classics
  'Turning complex problems into simple ones',
  'Processing your request as fast as possible',
  'I know you\'re in a hurry, but take it easy',
  'Dog-paddling through the ocean of knowledge',
  'Let the dust settle before we proceed',
  'Hand-crafting your answer piece by piece',
  'Gathering all the pieces to solve this',
  'Working on it, please be patient',
  'Thinking hard about the best solution',
  'CPU is working at full capacity',
  // Slice of life
  'Good things take time to brew',
  'Processing your request from all angles',
  'Almost there, just a bit more',
  'Putting the final touches on your answer',
  'Double-checking everything before responding',
  'Making sure every detail is perfect',
  'Weaving together the perfect response',
  // Wild imagination
  'Connecting the neural dots',
  'Running through all possible solutions',
  'Polishing the final answer',
  'Searching through the knowledge base',
  'Processing multiple data streams',
  'Connecting all the pieces together',
  'Preparing a comprehensive response',
  'Zooming in on the details',
  'Analyzing the request in depth',
  // Fantasy
  'Casting the search spell far and wide',
  'Waking up the AI brain',
  'Tapping into vast knowledge resources',
  'Running simulations and calculations',
  'Navigating through information channels',
  'Decoding the intent behind your request',
  'Getting closer to the perfect answer',
  // Workplace
  'Processing at maximum speed',
  'System is online and working',
  'Preparing results as fast as possible',
  'Accessing and organizing knowledge',
  'Putting the final pieces together',
  'The answer is being prepared',
  'Finalizing before delivery',
  'Target acquired and locked',
];

/**
 * Get a random loading text
 */
export function getRandomLoadingText(): string {
  return loadingTexts[Math.floor(Math.random() * loadingTexts.length)];
}
