/*
 * Residential status rules, written as pure functions so they can be tested on their own.
 * Every rule and figure below comes from the notes: s70 (individuals), s71 (other persons),
 * s72 (scope of income and the Ravi example) and s57 (section 5). Nothing is added from memory.
 */

export type Nationality = 'citizen' | 'pio' | 'other'
/** 'leaving' = an Indian citizen leaving India in the year as a crew member of an Indian ship or for employment abroad. */
export type Situation = 'none' | 'visiting' | 'leaving'
export type PersonKind = 'individual' | 'huf' | 'firm' | 'company' | 'other'
/** ROR / NOR / NR for individuals and HUFs (s72); R = resident, for persons the notes give no NOR test for. */
export type Status = 'ROR' | 'NOR' | 'NR' | 'R'

export interface IndividualFacts {
  nationality: Nationality
  situation: Situation
  /** Income other than income from foreign sources exceeds Rs. 15,00,000 (s70: section 6(5), 6(7), 6(13)). */
  incomeAbove: boolean
  /** Not liable to tax in any other country because of domicile or residence (s70: section 6(7)). */
  notLiableElsewhere: boolean
  daysYear: number
  daysPrev4: number
  /** Non resident in nine of the ten preceding years (s70: section 6(13)). */
  nr9of10: boolean
  daysPrev7: number
}

export interface OtherFacts {
  /** HUF, firm, AOP, other person: control and management of its affairs situated wholly outside India (s71). */
  controlWhollyOutside: boolean
  /** HUF only: the manager was non resident in 9 of 10 preceding years or in India 729 days or less in 7 (s70). */
  managerNorHistory: boolean
  /** Company: an Indian company (s71: section 6(10)). */
  indianCompany: boolean
  /** Company: place of effective management in India (s71: section 6(10)). */
  poemInIndia: boolean
}

export interface TreeNode {
  id: string
  phase: string
  question: string
  cite: string
  slideId: string
}

export interface Step {
  id: string
  /** Short answer shown on the node, e.g. "Yes · 130 days". */
  answer: string
  /** True when the answer is "yes" (the branch that leads towards residence or NOR). */
  yes: boolean
  /** The facts the answer was based on, e.g. "130 days this year (needs 120)". */
  detail?: string
  /** Why the answer is what it is, in the words of the notes. */
  note?: string
  /** Where this branch ends, if it ends here. */
  ends?: string
}

export interface Verdict {
  status: Status
  title: string
  cite: string
  why: string
  slideId: string
  steps: Step[]
  /** Input keys that the path actually used (unused inputs are dimmed in the form). */
  used: string[]
}

export const RS_15_LAKH = 'Rs. 15,00,000' // s70

export const STATUS_LABEL: Record<Status, string> = {
  ROR: 'Resident and ordinarily resident', // s72
  NOR: 'Not ordinarily resident', // s72
  NR: 'Non resident', // s72
  R: 'Resident', // s71
}

/* ---------- individuals (s70) ---------- */

export const INDIVIDUAL_TREE: TreeNode[] = [
  { id: 'd182', phase: 'Is the individual resident?', question: 'In India for 182 days or more in the tax year?', cite: 'Section 6(2)', slideId: 's70' },
  {
    id: 'exception',
    phase: 'Is the individual resident?',
    question: 'Is the 60 day condition switched off or changed for this person?',
    cite: 'Section 6(3), 6(4) and 6(5)',
    slideId: 's70',
  },
  {
    id: 'second',
    phase: 'Is the individual resident?',
    question: 'In India for 60 days or more in the year (120 for the visitor with income above Rs. 15,00,000) and 365 days or more in the four preceding years?',
    cite: 'Section 6(2) and 6(5)',
    slideId: 's70',
  },
  {
    id: 'deemed',
    phase: 'Is the individual resident?',
    question: 'An Indian citizen not liable to tax in any other country because of domicile or residence, with income other than from foreign sources above Rs. 15,00,000?',
    cite: 'Section 6(7) and 6(8)',
    slideId: 's70',
  },
  {
    id: 'norHistory',
    phase: 'Is the resident ordinarily resident?',
    question: 'Non resident in nine of the ten preceding years, or in India for 729 days or less in the seven preceding years?',
    cite: 'Section 6(13)',
    slideId: 's70',
  },
  {
    id: 'norStay',
    phase: 'Is the resident ordinarily resident?',
    question: 'A citizen or person of Indian origin with such income above Rs. 15,00,000 who stayed 120 days or more but less than 182 days?',
    cite: 'Section 6(13)(b)',
    slideId: 's72',
  },
]

function yn(v: boolean): string {
  return v ? 'Yes' : 'No'
}

export function decideIndividual(f: IndividualFacts): Verdict {
  const citizen = f.nationality === 'citizen'
  const citizenOrPio = f.nationality !== 'other'
  // Only an Indian citizen can be "leaving" (s70: section 6(3)); only a citizen or PIO can be "visiting" (section 6(4)).
  const situation: Situation = !citizenOrPio ? 'none' : f.situation === 'leaving' && !citizen ? 'none' : f.situation
  const incomeAbove = citizenOrPio && f.incomeAbove
  const steps: Step[] = []
  const used = new Set<string>(['daysYear'])

  // Step 1 (s70): 182 days or more in the tax year (section 6(2)).
  const met182 = f.daysYear >= 182
  steps.push({ id: 'd182', answer: yn(met182), yes: met182, detail: `${f.daysYear} days in the tax year`, ends: met182 ? 'Resident' : undefined })
  let resident = met182
  let viaVisitor120 = false

  if (!resident) {
    used.add('nationality')
    // Step 2 (s70): exceptions to the 60 day condition.
    let threshold: 60 | 120 | null = 60
    let note = 'No exception applies, so the 60 day condition is available (section 6(2)).'
    if (situation === 'leaving') {
      threshold = null
      note = 'An Indian citizen leaving India in the year as a crew member of an Indian ship or for employment abroad: the 60 day condition does not apply (section 6(3)).'
      used.add('situation')
    } else if (situation === 'visiting') {
      used.add('situation')
      used.add('incomeAbove')
      if (incomeAbove) {
        threshold = 120
        note = `A visiting citizen or person of Indian origin whose income other than income from foreign sources exceeds ${RS_15_LAKH}: the condition applies with 120 days in place of 60 (section 6(5)).`
      } else {
        threshold = null
        note = 'An Indian citizen or person of Indian origin visiting India: the 60 day condition does not apply (section 6(4)).'
      }
    } else if (citizenOrPio) {
      used.add('situation')
    }
    const changed = threshold !== 60
    steps.push({
      id: 'exception',
      answer: threshold === null ? 'Yes · switched off' : threshold === 120 ? 'Yes · 120 days' : 'No · 60 days',
      yes: changed,
      note,
    })

    // Step 3 (s70): the second test, with 60 or 120 days.
    if (threshold !== null) {
      used.add('daysPrev4')
      const met = f.daysYear >= threshold && f.daysPrev4 >= 365
      steps.push({
        id: 'second',
        answer: yn(met),
        yes: met,
        detail: `${f.daysYear} days this year (needs ${threshold}) · ${f.daysPrev4} days in the four preceding years (needs 365)`,
        note: met
          ? threshold === 120
            ? 'Resident under the 120 day version (section 6(5)).'
            : 'Resident: 60 days in the year plus 365 days in the four preceding years (section 6(2)(b)).'
          : `Not met: needs ${threshold} days or more in the year and 365 days or more in the four preceding years.`,
        ends: met ? 'Resident' : undefined,
      })
      if (met) {
        resident = true
        viaVisitor120 = threshold === 120
      }
    }
  }

  if (!resident) {
    // Step 4 (s70): deemed residence, section 6(7), only if not already resident (section 6(8)).
    if (citizen) {
      used.add('notLiableElsewhere')
      used.add('incomeAbove')
    }
    const deemed = citizen && f.notLiableElsewhere && incomeAbove
    steps.push({
      id: 'deemed',
      answer: yn(deemed),
      yes: deemed,
      note: deemed
        ? 'Deemed resident (section 6(7)), because he is not already resident (section 6(8)).'
        : citizen
          ? 'Not deemed resident: all three conditions of section 6(7) must be met.'
          : 'Deemed residence under section 6(7) applies only to an Indian citizen.',
      ends: deemed ? 'Not ordinarily resident' : 'Non resident',
    })
    if (deemed) {
      return {
        status: 'NOR',
        title: STATUS_LABEL.NOR,
        cite: 'Section 6(7) and 6(13)',
        why: 'A deemed resident citizen is not ordinarily resident (section 6(13)).',
        slideId: 's70',
        steps,
        used: [...used],
      }
    }
    return {
      status: 'NR',
      title: STATUS_LABEL.NR,
      cite: 'Section 6(2) and 6(7)',
      why: 'None of the residence tests is met and he is not a deemed resident.',
      slideId: 's70',
      steps,
      used: [...used],
    }
  }

  // Step 5 (s70): not ordinarily resident, section 6(13).
  used.add('nr9of10')
  used.add('daysPrev7')
  const history = f.nr9of10 || f.daysPrev7 <= 729
  steps.push({
    id: 'norHistory',
    answer: yn(history),
    yes: history,
    detail: `${f.nr9of10 ? 'Non resident in 9 of the 10 preceding years' : 'Not non resident in 9 of 10'} · ${f.daysPrev7} days in the seven preceding years (729 or less counts)`,
    ends: history ? 'Not ordinarily resident' : undefined,
  })
  if (history) {
    return {
      status: 'NOR',
      title: STATUS_LABEL.NOR,
      cite: 'Section 6(13)',
      why: f.nr9of10
        ? 'Resident, but non resident in nine of the ten preceding years.'
        : 'Resident, but in India for 729 days or less in the seven preceding years.',
      slideId: 's70',
      steps,
      used: [...used],
    }
  }

  // Step 6 (s70, s72): citizen or PIO with such income above Rs. 15,00,000 staying 120 to 181 days, section 6(13)(b).
  used.add('nationality')
  if (citizenOrPio) used.add('incomeAbove')
  const stay = citizenOrPio && incomeAbove && f.daysYear >= 120 && f.daysYear < 182
  steps.push({
    id: 'norStay',
    answer: yn(stay),
    yes: stay,
    detail: !citizenOrPio
      ? 'Not a citizen or person of Indian origin'
      : `${incomeAbove ? 'Income above' : 'Income not above'} ${RS_15_LAKH} · ${f.daysYear} days in the tax year`,
    ends: stay ? 'Not ordinarily resident' : 'Resident and ordinarily resident',
  })
  if (stay) {
    return {
      status: 'NOR',
      title: STATUS_LABEL.NOR,
      cite: 'Section 6(13)(b)',
      why: viaVisitor120
        ? 'Resident under the 120 day version, and his stay was 120 days or more but less than 182 days (as in the Ravi example).'
        : 'A citizen or person of Indian origin with such income above Rs. 15,00,000 who stayed 120 days or more but less than 182 days.',
      slideId: 's72',
      steps,
      used: [...used],
    }
  }
  return {
    status: 'ROR',
    title: STATUS_LABEL.ROR,
    cite: met182 ? 'Section 6(2) and 6(13)' : 'Section 6(2)(b) and 6(13)',
    why: 'Resident, and none of the not ordinarily resident conditions in section 6(13) applies.',
    slideId: 's70',
    steps,
    used: [...used],
  }
}

/* ---------- other persons (s71, and s70 for the HUF manager) ---------- */

export const OTHER_TREES: Record<Exclude<PersonKind, 'individual'>, TreeNode[]> = {
  huf: [
    { id: 'control', phase: 'Is the family resident?', question: 'Is the control and management of its affairs situated wholly outside India?', cite: 'Section 6(9)', slideId: 's71' },
    {
      id: 'manager',
      phase: 'Is the resident family ordinarily resident?',
      question: 'Was the manager non resident in nine of the ten preceding years, or in India for 729 days or less in the seven preceding years?',
      cite: 'Section 6(13)',
      slideId: 's70',
    },
  ],
  firm: [
    { id: 'control', phase: 'Is the firm or association resident?', question: 'Is the control and management of its affairs situated wholly outside India?', cite: 'Section 6(9)', slideId: 's71' },
  ],
  company: [
    { id: 'indian', phase: 'Is the company resident?', question: 'Is it an Indian company?', cite: 'Section 6(10)', slideId: 's71' },
    {
      id: 'poem',
      phase: 'Is the company resident?',
      question: 'Is its place of effective management (where key management and commercial decisions for the business as a whole are in substance made) in India?',
      cite: 'Section 6(10)',
      slideId: 's71',
    },
  ],
  other: [
    { id: 'control', phase: 'Is the person resident?', question: 'Is the control and management of its affairs situated wholly outside India?', cite: 'Section 6(11)', slideId: 's71' },
  ],
}

export function decideOther(kind: Exclude<PersonKind, 'individual'>, f: OtherFacts): Verdict {
  const steps: Step[] = []
  if (kind === 'company') {
    steps.push({ id: 'indian', answer: yn(f.indianCompany), yes: f.indianCompany, ends: f.indianCompany ? 'Resident' : undefined })
    if (f.indianCompany) {
      return { status: 'R', title: STATUS_LABEL.R, cite: 'Section 6(10)', why: 'An Indian company is resident.', slideId: 's71', steps, used: ['indianCompany'] }
    }
    steps.push({ id: 'poem', answer: yn(f.poemInIndia), yes: f.poemInIndia, ends: f.poemInIndia ? 'Resident' : 'Non resident' })
    return f.poemInIndia
      ? { status: 'R', title: STATUS_LABEL.R, cite: 'Section 6(10)', why: 'Its place of effective management is in India.', slideId: 's71', steps, used: ['indianCompany', 'poemInIndia'] }
      : {
          status: 'NR',
          title: STATUS_LABEL.NR,
          cite: 'Section 6(10)',
          why: 'Neither an Indian company nor managed effectively from India.',
          slideId: 's71',
          steps,
          used: ['indianCompany', 'poemInIndia'],
        }
  }

  const cite = kind === 'other' ? 'Section 6(11)' : 'Section 6(9)'
  const outside = f.controlWhollyOutside
  steps.push({
    id: 'control',
    answer: outside ? 'Yes · wholly outside' : 'No · some in India',
    yes: outside,
    note: outside ? undefined : 'Even partial control exercised in India makes it resident.',
    ends: outside ? 'Non resident' : kind === 'huf' ? undefined : 'Resident',
  })
  if (outside) {
    return { status: 'NR', title: STATUS_LABEL.NR, cite, why: 'Its control and management is situated wholly outside India.', slideId: 's71', steps, used: ['controlWhollyOutside'] }
  }
  if (kind !== 'huf') {
    return {
      status: 'R',
      title: STATUS_LABEL.R,
      cite,
      why: 'Resident unless control and management is wholly outside India; even partial control in India is enough.',
      slideId: 's71',
      steps,
      used: ['controlWhollyOutside'],
    }
  }
  // HUF: the not ordinarily resident test looks at the manager (s70: section 6(13)).
  const nor = f.managerNorHistory
  steps.push({ id: 'manager', answer: yn(nor), yes: nor, ends: nor ? 'Not ordinarily resident' : 'Resident and ordinarily resident' })
  return nor
    ? {
        status: 'NOR',
        title: STATUS_LABEL.NOR,
        cite: 'Section 6(9) and 6(13)',
        why: 'Resident, but its manager meets the not ordinarily resident test.',
        slideId: 's70',
        steps,
        used: ['controlWhollyOutside', 'managerNorHistory'],
      }
    : {
        status: 'ROR',
        title: STATUS_LABEL.ROR,
        cite: 'Section 6(9) and 6(13)',
        why: 'Resident, and its manager does not meet the not ordinarily resident test.',
        slideId: 's70',
        steps,
        used: ['controlWhollyOutside', 'managerNorHistory'],
      }
}

/* ---------- scope of income (s72, s57) ---------- */

export const SCOPE_BUCKETS = [
  { id: 'received', label: 'Received or deemed received in India' }, // s72, s57
  { id: 'accruing', label: 'Accruing or deemed to accrue in India' }, // s72, s57
  { id: 'outside', label: 'Accruing outside India' }, // s72, s57
] as const

/** 'yes' = taxed, 'part' = only foreign income from a business controlled in or a profession set up in India (s72). */
export function scopeFor(status: Status): Record<(typeof SCOPE_BUCKETS)[number]['id'], 'yes' | 'part' | 'no'> {
  if (status === 'NR') return { received: 'yes', accruing: 'yes', outside: 'no' } // s72; section 5(2) (s57)
  if (status === 'NOR') return { received: 'yes', accruing: 'yes', outside: 'part' } // s72; section 5(1)(c) (s57)
  return { received: 'yes', accruing: 'yes', outside: 'yes' } // s72; residents taxed on all three (s57)
}

/* ---------- preset scenarios (illustrations built from the rules above) ---------- */

export interface Preset {
  id: string
  name: string
  blurb: string
  source: string
  facts: IndividualFacts
}

export const PRESETS: Preset[] = [
  {
    id: 'ravi',
    name: 'Ravi visits for 130 days',
    blurb: 'Indian citizen working abroad, Indian rental income of Rs. 18,00,000, 400 days in India in the four preceding years.',
    source: 'The example in the notes (s72)',
    // s72: 130 days, Rs. 18,00,000 > Rs. 15,00,000, so the 120 day version applies; "resident if he was in India for
    // 365 days or more in the four preceding years" (we fill 400) and then NOR under section 6(13)(b).
    facts: { nationality: 'citizen', situation: 'visiting', incomeAbove: true, notLiableElsewhere: false, daysYear: 130, daysPrev4: 400, nr9of10: false, daysPrev7: 1100 },
  },
  {
    id: 'seventy',
    name: 'The 70 day stay',
    blurb: '70 days in the tax year, 400 days in the four preceding years, no exception applies; long settled in India.',
    source: 'Built from the quiz question on section 6(2)(b)',
    // Quiz (u3): 70 days + 400 days, no exception => Resident (section 6(2)(b)). NOR inputs are filled so he is ordinarily resident.
    facts: { nationality: 'other', situation: 'none', incomeAbove: false, notLiableElsewhere: false, daysYear: 70, daysPrev4: 400, nr9of10: false, daysPrev7: 900 },
  },
  {
    id: 'crew',
    name: 'The ship crew member',
    blurb: 'Indian citizen leaving India this year as a crew member of an Indian ship; 100 days in India, 500 in the four preceding years.',
    source: 'Illustration of section 6(3) (s70)',
    facts: { nationality: 'citizen', situation: 'leaving', incomeAbove: false, notLiableElsewhere: false, daysYear: 100, daysPrev4: 500, nr9of10: false, daysPrev7: 1200 },
  },
  {
    id: 'deemed',
    name: 'The citizen taxed nowhere',
    blurb: 'Indian citizen, 40 days in India, not liable to tax in any other country, income other than from foreign sources above Rs. 15,00,000.',
    source: 'Illustration of section 6(7) (s70)',
    facts: { nationality: 'citizen', situation: 'none', incomeAbove: true, notLiableElsewhere: true, daysYear: 40, daysPrev4: 100, nr9of10: false, daysPrev7: 300 },
  },
]
