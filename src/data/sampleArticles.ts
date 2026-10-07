export interface SampleArticle {
  id: string;
  title: string;
  author: string;
  category: string;
  excerpt: string;
  content: string;
}

export const SAMPLE_ARTICLES: SampleArticle[] = [
  {
    id: 'sample-reading-aloud',
    title: 'How Reading Aloud Reshapes Memory and Human Focus',
    author: 'Dr. Evelyn Vance',
    category: 'Cognitive Science',
    excerpt: 'Discover the production effect—the powerful cognitive mechanism where speaking and hearing words simultaneously fortifies memory retention.',
    content: `# How Reading Aloud Reshapes Memory and Human Focus

When we read silently, our internal monologue whispers the words, but when we read aloud, something remarkable happens across neural pathways.

## The Production Effect in Neuroscience

Cognitive psychologists call this the production effect. By combining the visual processing of printed text, the motor execution of speech, and the auditory feedback of our own voice, the brain encodes information through multiple distinct sensory modalities.

> "Speaking text aloud creates a distinctive motor and acoustic signature in episodic memory, rendering the material significantly less vulnerable to ordinary decay."

Research has consistently shown that material read aloud is remembered with greater fidelity than material read in complete silence. The act of vocalization makes the memory distinctive. It separates the spoken words from the ceaseless stream of unspoken thoughts drifting through consciousness.

## Multimodal Synchronization for Modern Focus

In our current digital era, where notifications and fragmented attention spans compete for cognitive bandwidth, read-aloud technology acts as a stabilizing anchor:

- Synchronized word highlighting focuses eye gaze and prevents wandering.
- Acoustic feedback clarifies complex syntactic structures in real time.
- Cognitive fatigue is reduced by offloading raw decoding to speech synthesis.

Ultimately, reading is not merely a passive extraction of symbols from a screen. It is an active dialogue between thought and sound. By restoring the acoustic dimension of written language, we unlock deeper comprehension, heightened empathy, and a renewed joy in the written word.`
  },
  {
    id: 'sample-typography',
    title: 'The Invisible Craft: A Short History of Typography',
    author: 'Marcus Sterling',
    category: 'Design & History',
    excerpt: 'Typography is the art of giving speech a physical form. Explore how letterforms evolved from fifteenth-century metal punches to contemporary digital interfaces.',
    content: `# The Invisible Craft: A Short History of Typography

Typography is often described as crystal goblet design: its primary duty is to hold the wine of language without staining its flavor or obscuring its clarity.

> "The letter is a vessel for human breath. Its proportion must welcome the eye while its rhythm guides the inner voice."

## From Movable Lead to Venice Italics

In 1440, Johannes Gutenberg introduced movable metal type to Europe, casting each character in lead, tin, and antimony. Early typefaces consciously imitated the dense, angular blackletter scripts of medieval monastic scribes. However, as the Renaissance blossomed in Italy, humanists sought letterforms that mirrored the proportion and dignity of classical Roman inscriptions.

Aldus Manutius and Francesco Griffo pioneered italic type in Venice around 1500, not for emphasis, but as a space-saving measure that allowed compact, portable pocket books to be printed economically:

1. Aldine pocket octavos reduced page area by nearly sixty percent.
2. Scholars could carry Virgil, Horace, and Petrarch on horseback.
3. Reading shifted from an ecclesiastical ritual into a personal habit.

## Typographic Eras Comparison

| Era | Typeface Style | Key Innovation | Status |
| :--- | :--- | :--- | :---: |
| 1450s | Blackletter | Movable Gutenberg metal punch | Historic |
| 1500s | Venice Italic | Compact portable pocket editions | Essential |
| 1950s | Neo-Grotesque | Neutral sans-serif legibility | Modern |
| Present | Variable OpenType | Responsive multi-axis weight | Digital |

Key digital reading considerations:
- Typographic hierarchy across viewports:
  - [x] Optical size adjustments for body text
  - [x] High-contrast legibility for e-readers
  - [ ] Specialized phonetic timing for speech synthesis

## Modernist Geometry and the Digital Screen

Centuries later, the Industrial Revolution and modernist movements stripped away serifs, giving rise to clean, geometric grotesque typefaces designed for transit signs, billboards, and machinery.

Today, typography lives in pixels, responsive viewports, and synthetic voices. Yet the core principle remains unchanged: to honor the cadence of human thought, creating harmony between the eye, the ear, and the intellect.`
  },
  {
    id: 'sample-nature',
    title: 'The Silent Canopy: What Old-Growth Forests Teach Us',
    author: 'Clara Lindqvist',
    category: 'Ecology & Nature',
    excerpt: 'Beneath the ancient temperate rainforests lies a vast, interconnected network of mycorrhizal fungi that redistributes carbon and nutrients between trees.',
    content: `# The Silent Canopy: What Old-Growth Forests Teach Us

Step into an ancient temperate forest and the first sensation is an overwhelming stillness. The air smells of cedar resin, damp loam, and moss that has carpeted the forest floor undisturbed for centuries.

## The Subterranean Economy

Yet beneath this tranquil surface, a bustling biological economy is continuously operating. For decades, traditional forestry viewed trees as solitary competitors fighting for sunlight and soil nutrients. Modern ecological research has shattered that simplistic view.

> "An old-growth forest is not a collection of solitary gladiators, but a communal superorganism bound together by mutual subterranean nourishment."

Trees in an old-growth forest are connected by extensive fungal threads known as mycorrhizal networks:

- Mother trees recognize the chemical signatures of their own offspring.
- Carbon, nitrogen, and phosphorus are redistributed from thriving trees to shaded saplings.
- Warning signals travel along hyphae to alert neighbors to insect infestations.

When an elder tree falls or reaches the end of its life, it slowly pours its remaining resources back into the network, feeding neighboring hemlocks and firs.

In an increasingly fragmented world, old-growth forests offer an inspiring blueprint for resilience. They remind us that survival is rarely achieved through isolation, but through reciprocal care, patience, and deep, unseen connections.`
  }
];
