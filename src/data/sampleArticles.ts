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

| Era | Typeface Style | Key Innovation | Geometric Metric | Status |
| :--- | :--- | :--- | :--- | :---: |
| 1450s | Blackletter | Movable Gutenberg metal punch | Aspect ratio $1:\sqrt{2}$ | Historic |
| 1500s | Venice Italic | Compact portable pocket editions | Slant angle $\theta \approx 12^\circ$ | Essential |
| 1950s | Neo-Grotesque | Neutral sans-serif legibility | Optical x-height $x = 0.68 \cdot H$ | Modern |
| Present | Variable OpenType | Responsive multi-axis weight | Weight axis $w \in [100, 900]$ | Digital |

Key digital reading considerations:
- Typographic hierarchy across viewports:
  - [x] Optical size adjustments for body text
  - [x] High-contrast legibility for e-readers
  - [ ] Specialized phonetic timing for speech synthesis

## Mathematical Harmony and Page Geometry

Typographers have long recognized that the visual harmony of a printed folio is governed by fundamental mathematical ratios. The classical canon of page division, formalized by Jan Tschichold and medieval master scribes, relies on the golden ratio $\phi$:

$$\phi = \frac{1 + \sqrt{5}}{2} \approx 1.6180339887$$

Bringhurst’s law of typographic measure establishes that comfortable line length in characters $C$ scales in proportion to point size $p$ and column width:

$$C \approx 2.5 \times p \times \sqrt{\phi}$$

When digital type is rasterized across high-density displays, optical subpixel engines dynamically apply gamma curves $\gamma = \frac{1}{2.2}$, preserving delicate hairline serifs without compromising contrast.

## Modernist Geometry and the Digital Screen

Centuries later, the Industrial Revolution and modernist movements stripped away serifs, giving rise to clean, geometric grotesque typefaces designed for transit signs, billboards, and machinery.

Today, typography lives in pixels, responsive viewports, and synthetic voices. Yet the core principle remains unchanged: to honor the cadence of human thought, creating harmony between the eye, the ear, and the intellect.`
  },
  {
    id: 'sample-quantum-math',
    title: 'Quantum Information and the Mathematical Foundations of Reality',
    author: 'Dr. Julian Thorne',
    category: 'Physics & Mathematics',
    excerpt: 'Explore how mathematical equations, from Einstein’s relativity to the Schrödinger wave equation and Shannon entropy, describe the fundamental fabric of spacetime.',
    content: `# Quantum Information and the Mathematical Foundations of Reality

For over a century, the interplay between mathematics and quantum physics has revealed that the universe, at its most fundamental level, operates as an interconnected information-processing architecture.

## The Pillars of Modern Physics

Two landmark equations anchor our understanding of energy, mass, and spacetime. Albert Einstein's mass-energy equivalence equation demonstrated that mass and energy are interchangeable manifestations of the same entity:

$$E = mc^2$$

In the subatomic domain, the time-dependent Schrödinger equation governs the continuous evolution of a physical system's quantum state $\Psi(\mathbf{r}, t)$:

$$i\hbar \frac{\partial}{\partial t}\Psi(\mathbf{r}, t) = \hat{H}\Psi(\mathbf{r}, t)$$

Here, $\hbar$ is the reduced Planck constant, $i$ is the imaginary unit satisfying $i^2 = -1$, and $\hat{H}$ is the Hamiltonian operator representing total system energy.

## Mathematical Symphony: Euler's Identity

Often celebrated as the most beautiful formula in all of mathematics, Euler's identity unites five fundamental mathematical constants in a single equation:

$$e^{i\pi} + 1 = 0$$

This profound relationship bridges analysis, algebra, geometry, and arithmetic, appearing routinely in quantum phase transformations and Fourier optics.

## Classical vs. Quantum Information Architecture

The fundamental unit of classical computing is the bit, whereas quantum computing leverages qubits capable of coherent superpositions:

| Information Metric | Classical Computing | Quantum Computing | Mathematical Expression | Status |
| :--- | :--- | :--- | :--- | :---: |
| Fundamental Unit | Binary Bit $\{0, 1\}$ | Quantum Qubit $|\psi\rangle$ | $|\psi\rangle = \alpha|0\rangle + \beta|1\rangle$ | Universal |
| State Space | Discrete $\{0, 1\}^n$ | Hilbert Space $\mathbb{C}^{2^n}$ | $\sum_{i} |\alpha_i|^2 = 1$ | Continuous |
| Information Entropy | Shannon Entropy $H(X)$ | Von Neumann Entropy $S(\rho)$ | $S(\rho) = -\mathrm{Tr}(\rho \ln \rho)$ | Fundamental |
| Algorithmic Complexity | Polynomial $O(n^k)$ | Super-polynomial $O(2^n)$ | $\mathcal{P} \subseteq \mathcal{BQP}$ | Verified |

## Entropy and Information Theory

Claude Shannon founded mathematical information theory by formalizing the expected value of information contained in a probabilistic message. For a discrete random variable $X$ with outcomes $x_1, \dots, x_n$:

$$H(X) = -\sum_{i=1}^{n} P(x_i) \log_2 P(x_i)$$

When unified with thermodynamic physics, this formulation connects directly to physical entropy, demonstrating that information is a fundamental physical entity that shapes our universe.`
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
  },
  {
    id: 'sample-logic-truth-tables',
    title: 'Propositional Logic and Truth Tables: The Architecture of Reason',
    author: 'Prof. Alan Turing-Ward',
    category: 'Logic & Computation',
    excerpt: 'Discover how propositional logic, Boolean operators, and formal truth tables define the axiomatic bedrock of mathematical reasoning and modern digital processors.',
    content: `# Propositional Logic and Truth Tables: The Architecture of Reason

In 1854, mathematician George Boole published *An Investigation of the Laws of Thought*, establishing that the rules of human deduction could be codified into a rigorous algebraic calculus. Today, this formal framework underpins every microchip and software algorithm on Earth.

## Fundamental Boolean Connectives

A proposition is a declarative statement that is either definitively True ($T$) or False ($F$). When combined using logical connectives, their collective truth value is determined by an exhaustive enumeration known as a truth table.

The fundamental logical connectives are negation ($\neg P$), conjunction ($P \land Q$), disjunction ($P \lor Q$), material implication ($P \to Q$), and the biconditional ($P \leftrightarrow Q$).

## Truth Table for Basic Connectives

| P | Q | ¬P | P ∧ Q | P ∨ Q | P → Q | P ↔ Q |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| T | T | F | T | T | T | T |
| T | F | F | F | T | F | F |
| F | T | T | F | T | T | F |
| F | F | T | F | F | T | T |

## De Morgan's Laws and Equivalent Circuits

Augustus De Morgan formalized two foundational equivalences demonstrating that conjunction and disjunction are duals under negation:

$$\neg (P \land Q) \equiv \neg P \lor \neg Q$$

$$\neg (P \lor Q) \equiv \neg P \land \neg Q$$

The truth table verifying the first law across all possible valuations:

| P | Q | P ∧ Q | ¬(P ∧ Q) | ¬P | ¬Q | ¬P ∨ ¬Q |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| T | T | T | F | F | F | F |
| T | F | F | T | F | T | T |
| F | T | F | T | T | F | T |
| F | F | F | T | T | T | T |

Because column 4 ($\neg(P \land Q)$) is identical in every valuation to column 7 ($\neg P \lor \neg Q$), the equivalence is mathematically proven as a tautology.

## From Symbolic Logic to Silicon Gates

Claude Shannon made the monumental leap in 1937 by realizing that electrical switches and relays physically embody Boolean truth tables:

- Series switches correspond precisely to logical conjunction ($AND$).
- Parallel switches correspond precisely to logical disjunction ($OR$).
- Inverter transistors correspond precisely to logical negation ($NOT$).

Every digital computer is, at its deepest core, a vast physical symphony of billions of truth tables evaluating trillions of times per second.`
  }
];
