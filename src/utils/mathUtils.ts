import katex from 'katex';

/**
 * Converts LaTeX and mathematical notation to natural spoken English for TTS synthesis.
 */
export function latexToSpokenText(latex: string): string {
  if (!latex) return '';
  let s = latex.trim();

  // Strip outer math delimiters if present
  s = s.replace(/^\$\$|\$\$$|^\\\[|\\\]$|^\$|\$$|^\\\(|\\\)$/g, '').trim();

  // Common physics, typography, and mathematical formulas
  const commonFormulas: Record<string, string> = {
    'E=mc^2': 'E equals m c squared',
    'E = mc^2': 'E equals m c squared',
    'e^{i\\pi} + 1 = 0': 'e to the i pi plus 1 equals 0',
    'e^{i\\pi}+1=0': 'e to the i pi plus 1 equals 0',
    'a^2 + b^2 = c^2': 'a squared plus b squared equals c squared',
    'a^2+b^2=c^2': 'a squared plus b squared equals c squared',
    '\\nabla \\cdot \\mathbf{B} = 0': 'divergence of magnetic field B equals zero',
    'F = ma': 'force equals mass times acceleration',
    'F=ma': 'force equals mass times acceleration',
    '\\phi = \\frac{1 + \\sqrt{5}}{2} \\approx 1.6180339887': 'phi equals 1 plus square root of 5 over 2, approximately 1.618',
    '\\phi = \\frac{1 + \\sqrt{5}}{2}': 'phi equals 1 plus square root of 5 over 2',
    'i\\hbar \\frac{\\partial}{\\partial t}\\Psi(\\mathbf{r}, t) = \\hat{H}\\Psi(\\mathbf{r}, t)': 'i h-bar partial with respect to t of Psi equals H-hat Psi',
  };
  if (commonFormulas[s]) {
    return commonFormulas[s];
  }

  // Quantum bras and kets: |\psi\rangle -> ket psi, \langle\psi| -> bra psi
  s = s.replace(/\|([a-zA-Z0-9_\\]+)\s*\\rangle/g, ' ket $1 ');
  s = s.replace(/\\langle\s*([a-zA-Z0-9_\\]+)\|/g, ' bra $1 ');

  // Fractions: \frac{num}{den} -> num over den
  s = s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1 over $2');
  s = s.replace(/\\frac\s*([a-zA-Z0-9])\s*([a-zA-Z0-9])/g, '$1 over $2');

  // Square roots and n-th roots
  s = s.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, '$1-th root of $2');
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, 'square root of $1');
  s = s.replace(/\\sqrt\s*([a-zA-Z0-9])/g, 'square root of $1');

  // Integrals
  s = s.replace(/\\int_\{([^{}]+)\}\^\{([^{}]+)\}/g, 'integral from $1 to $2 of ');
  s = s.replace(/\\int_([a-zA-Z0-9])\^([a-zA-Z0-9])/g, 'integral from $1 to $2 of ');
  s = s.replace(/\\int/g, 'integral of ');

  // Sums
  s = s.replace(/\\sum_\{([^{}]+)\}\^\{([^{}]+)\}/g, 'sum from $1 to $2 of ');
  s = s.replace(/\\sum_([a-zA-Z0-9])\^([a-zA-Z0-9])/g, 'sum from $1 to $2 of ');
  s = s.replace(/\\sum/g, 'sum of ');

  // Limits
  s = s.replace(/\\lim_\{([^{}]+)\s*\\to\s*([^{}]+)\}/g, 'limit as $1 approaches $2 of ');
  s = s.replace(/\\lim/g, 'limit of ');

  // Exponents: x^2 -> x squared, x^3 -> x cubed, x^{n} -> x to the power of n
  s = s.replace(/([a-zA-Z0-9\)])\^2\b/g, '$1 squared');
  s = s.replace(/([a-zA-Z0-9\)])\^\{2\}/g, '$1 squared');
  s = s.replace(/([a-zA-Z0-9\)])\^3\b/g, '$1 cubed');
  s = s.replace(/([a-zA-Z0-9\)])\^\{3\}/g, '$1 cubed');
  s = s.replace(/([a-zA-Z0-9\)])\^\{([^{}]+)\}/g, '$1 to the power of $2');
  s = s.replace(/([a-zA-Z0-9\)])\^([a-zA-Z0-9])/g, '$1 to the power of $2');

  // Subscripts: x_i -> x sub i, x_{min} -> x sub min
  s = s.replace(/([a-zA-Z0-9])_\{([^{}]+)\}/g, '$1 sub $2');
  s = s.replace(/([a-zA-Z0-9])_([a-zA-Z0-9])/g, '$1 sub $2');

  // Operator accents: \hat{H} -> H-hat, \bar{x} -> x-bar, \vec{v} -> vector v
  s = s.replace(/\\hat\{([^{}]+)\}/g, '$1 hat');
  s = s.replace(/\\bar\{([^{}]+)\}/g, '$1 bar');
  s = s.replace(/\\vec\{([^{}]+)\}/g, 'vector $1');

  // Greek letters & constants
  const greekLetters: Record<string, string> = {
    '\\hbar': 'h bar',
    '\\alpha': 'alpha',
    '\\beta': 'beta',
    '\\gamma': 'gamma',
    '\\delta': 'delta',
    '\\epsilon': 'epsilon',
    '\\varepsilon': 'epsilon',
    '\\zeta': 'zeta',
    '\\eta': 'eta',
    '\\theta': 'theta',
    '\\iota': 'iota',
    '\\kappa': 'kappa',
    '\\lambda': 'lambda',
    '\\mu': 'mu',
    '\\nu': 'nu',
    '\\xi': 'xi',
    '\\pi': 'pi',
    '\\rho': 'rho',
    '\\sigma': 'sigma',
    '\\tau': 'tau',
    '\\upsilon': 'upsilon',
    '\\phi': 'phi',
    '\\varphi': 'phi',
    '\\chi': 'chi',
    '\\psi': 'psi',
    '\\omega': 'omega',
    '\\Gamma': 'Gamma',
    '\\Delta': 'Delta',
    '\\Theta': 'Theta',
    '\\Lambda': 'Lambda',
    '\\Xi': 'Xi',
    '\\Pi': 'Pi',
    '\\Sigma': 'Sigma',
    '\\Upsilon': 'Upsilon',
    '\\Phi': 'Phi',
    '\\Psi': 'Psi',
    '\\Omega': 'Omega',
  };
  for (const [cmd, name] of Object.entries(greekLetters)) {
    s = s.replaceAll(cmd, ` ${name} `);
  }

  // Operators & Relations
  const operators: Record<string, string> = {
    '\\pm': ' plus or minus ',
    '\\mp': ' minus or plus ',
    '\\times': ' times ',
    '\\cdot': ' times ',
    '\\div': ' divided by ',
    '\\le': ' is less than or equal to ',
    '\\leq': ' is less than or equal to ',
    '\\ge': ' is greater than or equal to ',
    '\\geq': ' is greater than or equal to ',
    '\\neq': ' is not equal to ',
    '\\ne': ' is not equal to ',
    '\\approx': ' is approximately ',
    '\\sim': ' is proportional to ',
    '\\equiv': ' is equivalent to ',
    '\\infty': ' infinity ',
    '\\partial': ' partial ',
    '\\nabla': ' del ',
    '\\in': ' in ',
    '\\notin': ' not in ',
    '\\subset': ' subset of ',
    '\\subseteq': ' subset of ',
    '\\cup': ' union ',
    '\\cap': ' intersection ',
    '\\to': ' approaches ',
    '\\rightarrow': ' approaches ',
    '\\implies': ' implies ',
    '\\iff': ' if and only if ',
    '\\forall': ' for all ',
    '\\exists': ' there exists ',
    '\\prime': ' prime ',
    '\\circ': ' degrees ',
    '\\degree': ' degrees ',
    '\\land': ' and ',
    '\\wedge': ' and ',
    '\\lor': ' or ',
    '\\vee': ' or ',
    '\\neg': ' not ',
    '\\oplus': ' xor ',
    '\\veebar': ' xor ',
    '\\leftrightarrow': ' if and only if ',
    '\\Leftrightarrow': ' if and only if ',
    '\\Rightarrow': ' implies ',
    '\\top': ' true ',
    '\\bot': ' false ',
  };
  for (const [cmd, spoken] of Object.entries(operators)) {
    s = s.replaceAll(cmd, spoken);
  }

  // Common Unicode logic and math symbols
  s = s.replace(/∧/g, ' and ');
  s = s.replace(/∨/g, ' or ');
  s = s.replace(/[¬~]/g, ' not ');
  s = s.replace(/[→⇒]/g, ' implies ');
  s = s.replace(/[↔⇔≡]/g, ' if and only if ');
  s = s.replace(/[⊕⊻]/g, ' xor ');
  s = s.replace(/⊤/g, ' true ');
  s = s.replace(/⊥/g, ' false ');

  // Trigonometric and standard functions
  s = s.replace(/\\sin\b/g, ' sine ');
  s = s.replace(/\\cos\b/g, ' cosine ');
  s = s.replace(/\\tan\b/g, ' tangent ');
  s = s.replace(/\\ln\b/g, ' natural log ');
  s = s.replace(/\\log\b/g, ' log ');
  s = s.replace(/\\exp\b/g, ' exponential of ');
  s = s.replace(/\\mathrm\{Tr\}/g, ' trace of ');
  s = s.replace(/\\mathrm\{([^{}]+)\}/g, '$1');
  s = s.replace(/\\operatorname\{([^{}]+)\}/g, '$1');

  // Formatting macros (\mathbf, \mathit, \text, \mathrm, \left, \right, \mathbb, \mathcal)
  s = s.replace(/\\(?:mathbf|mathit|mathrm|mathbb|mathcal|text)\{([^{}]+)\}/g, '$1');
  s = s.replace(/\\(?:left|right)[()\[\]|.]/g, '');

  // Relations and symbols
  s = s.replace(/=/g, ' equals ');
  s = s.replace(/\+/g, ' plus ');
  s = s.replace(/-/g, ' minus ');
  s = s.replace(/</g, ' is less than ');
  s = s.replace(/>/g, ' is greater than ');

  // Clean remaining braces, backslashes, extra spaces
  s = s.replace(/[{}]/g, ' ');
  s = s.replace(/\\/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  // If the result is just a single truth value letter
  if (/^t$/i.test(s)) return 'True';
  if (/^f$/i.test(s)) return 'False';

  return s;
}

/**
 * Safely renders LaTeX to an HTML string using KaTeX.
 * Returns null if parsing fails.
 */
export function renderMathToHtml(latex: string, displayMode: boolean = false): string | null {
  try {
    const cleanLatex = latex
      .replace(/^\$\$|\$\$$|^\\\[|\\\]$|^\$|\$$|^\\\(|\\\)$/g, '')
      .trim();
    if (!cleanLatex) return '';
    return katex.renderToString(cleanLatex, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
    });
  } catch {
    return null;
  }
}

/**
 * Checks if a string contains inline or display LaTeX math.
 */
export function containsMath(text: string): boolean {
  if (!text) return false;
  return (
    /\$\$[^\$]+\$\$/.test(text) ||
    /\\\[[^\]]+\\\]/.test(text) ||
    /(^|[^\$\w])\$([^\$\n]+)\$([^\$\w]|$)/.test(text) ||
    /\\\([^\)]+\\\)/.test(text) ||
    /\\begin\{(?:equation|align|matrix|pmatrix|bmatrix)\}/.test(text)
  );
}

export interface MathSegment {
  type: 'text' | 'math';
  content: string;
  displayMode?: boolean;
  spokenText?: string;
}

/**
 * Splits a text into alternating plain-text and math segments.
 */
export function splitTextWithMath(text: string): MathSegment[] {
  if (!text) return [];

  const segments: MathSegment[] = [];

  // Match:
  // 1. Display math: $$...$$ or \[...\] or \begin{equation}...\end{equation}
  // 2. Inline math: $...$ (avoiding currency like $100 or $5.99) or \(...\)
  const mathRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\begin\{(?:equation|align|matrix|pmatrix|bmatrix)\}[\s\S]+?\\end\{(?:equation|align|matrix|pmatrix|bmatrix)\}|\\\([\s\S]+?\\\)|\$(?!\s|\d+(?:\.\d+)?(?:\s|$))([^$\n]+?)(?<!\s)\$)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    const rawMatch = match[0];
    const isDisplay =
      rawMatch.startsWith('$$') ||
      rawMatch.startsWith('\\[') ||
      rawMatch.startsWith('\\begin{');

    const cleanLatex = rawMatch
      .replace(/^\$\$|\$\$$|^\\\[|\\\]$|^\$|\$$|^\\\(|\\\)$/g, '')
      .trim();

    segments.push({
      type: 'math',
      content: cleanLatex,
      displayMode: isDisplay,
      spokenText: latexToSpokenText(cleanLatex),
    });

    lastIndex = match.index + rawMatch.length;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}
