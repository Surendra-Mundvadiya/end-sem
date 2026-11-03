import type { UnitId } from '../../../data'

/*
 * Memory hooks. The hook (acronym, phrase, picture or numbers) is ours; every item it encodes is quoted from the
 * slide in `slideId` (checked word for word against the notes). Where a hook reorders the list, `reordered` is set.
 */

export type HookKind = 'acronym' | 'phrase' | 'picture' | 'numbers'

export interface MnItem {
  /** Letter, word or number shown on the badge. */
  key: string
  /** The item, worded as in the notes. */
  text: string
  /** Optional colour for picture hooks. */
  tone?: 'ok' | 'warn' | 'bad'
}

export interface Mnemonic {
  id: string
  unitId: UnitId
  /** What the hook encodes. */
  title: string
  hook: string
  kind: HookKind
  /** The vivid line that makes the hook stick. */
  tagline: string
  items: MnItem[]
  slideId: string
  reordered?: boolean
  /** Extra context from the same slide. */
  note?: string
  /** Weights to draw as a stacked bar (percentages adding to 100). */
  weights?: number[]
}

export const MNEMONICS: Mnemonic[] = [
  /* ---------- Unit I ---------- */
  {
    id: 'tax-features',
    unitId: 'u1',
    title: 'The five features of a tax',
    hook: 'EPIC + N',
    kind: 'acronym',
    tagline: 'A tax is EPIC, but promises No special service in return.',
    slideId: 's0',
    reordered: true,
    items: [
      { key: 'E', text: 'Enforceable: the law provides machinery to assess, collect and punish evasion.' },
      { key: 'P', text: 'For public purposes: the proceeds go to the Consolidated Fund (Article 266) and meet general public needs.' },
      { key: 'I', text: 'Imposed by law: no tax can be levied or collected except by authority of law (Article 265).' },
      { key: 'C', text: 'Compulsory: the payer has no choice; non payment leads to recovery, interest and penalty.' },
      { key: 'N', text: 'No quid pro quo: the payer cannot demand a special service in return.' },
    ],
    note: 'In the Shirur Mutt case, Mukherjea J. adopted the definition given by Latham C.J. in Matthews v. Chicory Marketing Board.',
  },
  {
    id: 'tax-components',
    unitId: 'u1',
    title: 'The four components of a tax (Govind Saran Ganga Saran)',
    hook: 'PERM',
    kind: 'acronym',
    tagline: 'Every tax needs a PERM. If any one part is uncertain, the levy fails, like a perm that will not hold.',
    slideId: 's1',
    reordered: true,
    items: [
      { key: 'P', text: 'The person liable to pay.' },
      { key: 'E', text: 'The taxable event that attracts the levy.' },
      { key: 'R', text: 'The rate of tax.' },
      { key: 'M', text: 'The measure or value to which the rate applies.' },
    ],
    note: 'Under the 2025 Act, the taxable event is earning total income in a tax year (section 4(2)), the person is “every person” (section 2(77)), the rate comes from the Finance Act (section 4(1)) or section 202(1), and the measure is total income computed under the Act (sections 2(108) and 5).',
  },
  {
    id: 'canons',
    unitId: 'u1',
    title: 'Adam Smith’s four canons (The Wealth of Nations, 1776)',
    hook: 'ECCE',
    kind: 'acronym',
    tagline: '“Ecce!” is Latin for “behold”: behold the four canons, in the notes’ order.',
    slideId: 's5',
    items: [
      { key: 'E', text: 'Equality: contribution in proportion to ability. Progressive slabs serve this canon.' },
      { key: 'C', text: 'Certainty: the amount, time and manner of payment should be clear.' },
      { key: 'C', text: 'Convenience: collection at a convenient time and in a convenient manner, as with deduction of tax from salary at source.' },
      { key: 'E', text: 'Economy: low cost of collection and minimal harm to productive activity.' },
    ],
    note: 'Later writers added productivity, elasticity, flexibility, simplicity and diversity. Bonus hook: they added a “DEF P.S.” to Smith’s letter.',
  },
  {
    id: 'plan-avoid-evade',
    unitId: 'u1',
    title: 'Planning, avoidance and evasion',
    hook: 'Green · Amber · Red',
    kind: 'picture',
    tagline: 'Read it like a traffic light: planning may go ahead, avoidance is met by GAAR, evasion is illegal.',
    slideId: 's7',
    items: [
      { key: 'Green', tone: 'ok', text: 'Planning means arranging one’s affairs within the law and its purpose, such as claiming a deduction the law offers.' },
      { key: 'Amber', tone: 'warn', text: 'Avoidance uses the letter of the law to defeat its purpose, often through artificial arrangements.' },
      { key: 'Red', tone: 'bad', text: 'Evasion is illegal non payment through concealment or fraud, and it attracts penalty and prosecution (Chapters XXI and XXII).' },
    ],
    note: 'Parliament’s answer to avoidance is the General Anti Avoidance Rule in Chapter XI of the 2025 Act (sections 178 to 184).',
  },

  /* ---------- Unit II ---------- */
  {
    id: 'fc-duties',
    unitId: 'u2',
    title: 'What the Finance Commission recommends (Article 280(3))',
    hook: 'Don’t Give Panchayats Peanuts',
    kind: 'phrase',
    tagline: 'Four duties under Article 280(3), in the notes’ order.',
    slideId: 's32',
    items: [
      {
        key: 'D',
        text: 'the distribution of the net proceeds of shareable taxes between the Union and the States, and their allocation among the States (vertical and horizontal devolution);',
      },
      { key: 'G', text: 'the principles governing grants in aid under Article 275;' },
      {
        key: 'P',
        text: 'measures to augment the Consolidated Fund of a State to supplement the resources of Panchayats and Municipalities (added by the Seventy Third and Seventy Fourth Amendments, 1992); and',
      },
      { key: 'P', text: 'any other matter referred to it by the President in the interests of sound finance.' },
    ],
    note: 'Under Article 280, the President constitutes a Finance Commission every fifth year or earlier, with a Chairman and four other members.',
  },
  {
    id: 'fc15-weights',
    unitId: 'u2',
    title: 'Fifteenth Finance Commission: shares among States',
    hook: 'I Pick A Forest, Dear Taxman',
    kind: 'phrase',
    tagline: 'Six criteria, in the order the notes give them: 45, 15, 15, 10, 12.5 and 2.5, adding up to 100.',
    slideId: 's33',
    items: [
      { key: 'I', text: 'income distance (45%)' },
      { key: 'P', text: 'population as per the 2011 Census (15%)' },
      { key: 'A', text: 'area (15%)' },
      { key: 'F', text: 'forest and ecology (10%)' },
      { key: 'D', text: 'demographic performance (12.5%)' },
      { key: 'T', text: 'tax and fiscal efforts (2.5%)' },
    ],
    weights: [45, 15, 15, 10, 12.5, 2.5],
    note: 'It fixed the States’ share at 41% of the divisible pool, and the Sixteenth Commission kept it at 41%.',
  },

  /* ---------- Unit III ---------- */
  {
    id: 'residence-days',
    unitId: 'u3',
    title: 'When an individual is resident (section 6)',
    hook: '182 | 60 + 365',
    kind: 'numbers',
    tagline: 'About half a year in India, or two months now plus a year’s worth spread over the four years before.',
    slideId: 's70',
    items: [
      { key: '182', text: 'in India for 182 days or more in that year' },
      { key: '60+365', text: 'for 60 days or more in that year and 365 days or more in the four preceding years (section 6(2))' },
      { key: '120', text: 'if his income other than income from foreign sources exceeds Rs. 15,00,000, the condition applies with 120 days in place of 60 (section 6(5))' },
      { key: '15 L', text: 'An Indian citizen who is not liable to tax in any other country because of domicile or residence, and whose income other than from foreign sources exceeds Rs. 15,00,000, is deemed resident (section 6(7))' },
    ],
    note: 'The 60 day condition does not apply to an Indian citizen leaving India in the year as a crew member of an Indian ship or for employment abroad (section 6(3)), or to an Indian citizen or person of Indian origin visiting India (section 6(4)), subject to the 120 day rule.',
  },
  {
    id: 'nor',
    unitId: 'u3',
    title: 'Not ordinarily resident (section 6(13))',
    hook: '9/10 · 729/7',
    kind: 'numbers',
    tagline: '729 days is one day short of two full years (730): under two years in India out of the last seven, and you are not ordinarily resident.',
    slideId: 's70',
    items: [
      { key: '9/10', text: 'non resident in nine of the ten preceding years' },
      { key: '729/7', text: 'in India for 729 days or less in the seven preceding years' },
      { key: '120+', text: 'a citizen or person of Indian origin with such income above Rs. 15,00,000 who stayed 120 days or more but less than 182 days' },
      { key: 'Deemed', text: 'a deemed resident citizen' },
    ],
  },
  {
    id: 'scope',
    unitId: 'u3',
    title: 'Scope of income by residential status',
    hook: '3 · 2½ · 2',
    kind: 'numbers',
    tagline: 'Count the buckets of income taxed: three, two and a half, two.',
    slideId: 's72',
    items: [
      {
        key: '3',
        text: 'Resident and ordinarily resident: income received or deemed received in India, accruing or deemed to accrue in India, and accruing outside India.',
      },
      {
        key: '2½',
        text: 'Not ordinarily resident: the first two, and foreign income only if derived from a business controlled in or a profession set up in India.',
      },
      { key: '2', text: 'Non resident: only income received or deemed received in India, or accruing or deemed to accrue in India.' },
    ],
  },
  {
    id: 'agri',
    unitId: 'u3',
    title: 'Agricultural income (section 2(5))',
    hook: 'BRAN',
    kind: 'acronym',
    tagline: 'Agricultural income is BRAN, the husk the land throws off: Building, Rent, Agriculture, Nursery.',
    slideId: 's66',
    reordered: true,
    items: [
      {
        key: 'B',
        text: 'income from a farm building on or near the land, required by the cultivator or receiver of rent as a dwelling house, store house or out building because of his connection with the land',
      },
      { key: 'R', text: 'any rent or revenue derived from land situated in India and used for agricultural purposes;' },
      {
        key: 'A',
        text: 'any income derived from such land by: agriculture; a process ordinarily employed by a cultivator or receiver of rent in kind to make the produce fit to be taken to market; or the sale by a cultivator or receiver of rent in kind of produce on which no other process has been performed;',
      },
      { key: 'N', text: 'income derived from saplings or seedlings grown in a nursery.' },
    ],
    note: 'It excludes income from such a building or land used for any other purpose (such as letting for residence or business), and income from transferring urban agricultural land.',
  },
  {
    id: 'mutuality',
    unitId: 'u3',
    title: 'Mutuality: the three conditions (Bangalore Club)',
    hook: 'IMP',
    kind: 'acronym',
    tagline: 'A person cannot make a profit out of himself, and no IMP can either.',
    slideId: 's56',
    items: [
      { key: 'I', text: 'complete identity between contributors and participants;' },
      { key: 'M', text: 'actions of the contributors and participants in furtherance of the mandate of the association; and' },
      { key: 'P', text: 'no scope for profiteering by contributors from a fund that can only be spent on or returned to them.' },
    ],
    note: 'The doctrine originated in New York Life Insurance Co. v. Styles (1889).',
  },

  /* ---------- Unit IV ---------- */
  {
    id: 'heads',
    unitId: 'u4',
    title: 'The five heads of income (section 13)',
    hook: 'SHiP CO',
    kind: 'acronym',
    tagline: 'A SHIP COmpany with five holds, in section order. The last hold, other sources, takes whatever is left.',
    slideId: 's80',
    items: [
      { key: 'S', text: 'Salaries (sections 15 to 19)' },
      { key: 'H', text: 'Income from house property (sections 20 to 25)' },
      { key: 'P', text: 'Profits and gains of business or profession (sections 26 to 66)' },
      { key: 'C', text: 'Capital gains (sections 67 to 91)' },
      { key: 'O', text: 'Income from other sources (sections 92 to 95)' },
    ],
    note: 'The heads are mutually exclusive (United Commercial Bank).',
  },
  {
    id: 'salary-tenses',
    unitId: 'u4',
    title: 'What section 15 charges as salary',
    hook: 'Now · Ahead · Behind',
    kind: 'picture',
    tagline: 'Salary is caught in every tense: due now, paid ahead, or arrears from behind.',
    slideId: 's86',
    items: [
      { key: 'Now', text: 'salary due from an employer (including a former employer) in the tax year, whether paid or not;' },
      { key: 'Ahead', text: 'salary paid or allowed in the tax year, though not due or before it became due (advance salary); and' },
      { key: 'Behind', text: 'arrears of salary paid or allowed in the tax year, if not taxed earlier.' },
    ],
    note: 'Salary is therefore taxed on the due or receipt basis, whichever is earlier.',
  },
  {
    id: 'total-income',
    unitId: 'u4',
    title: 'Computing total income, step by step',
    hook: 'Ravi Eats Hot Chapatis, Leaving Dal Today',
    kind: 'phrase',
    tagline: 'Seven steps, from residence to the tax payable.',
    slideId: 's81',
    items: [
      { key: 'R', text: 'determine residential status (section 6) and the scope of income (section 5);' },
      { key: 'E', text: 'leave out exempt income (sections 11 and 12 with the Schedules);' },
      { key: 'H', text: 'compute income under each head, with the deductions allowed under that head;' },
      { key: 'C', text: 'add the income of other persons included by sections 96 to 100 (clubbing);' },
      { key: 'L', text: 'set off losses and brought forward losses (sections 108 to 121), giving the gross total income (section 122(10));' },
      { key: 'D', text: 'subtract Chapter VIII deductions, unless the new regime bars them, giving the total income, rounded off under section 516; and' },
      {
        key: 'T',
        text: 'apply the rates (Finance Act or section 202, and special rates such as section 195), then the rebate and reliefs (sections 156 to 160), surcharge and cess, and credit for tax deducted or collected at source and advance tax.',
      },
    ],
  },

  /* ---------- Unit V ---------- */
  {
    id: 'hp-conditions',
    unitId: 'u5',
    title: 'The three conditions of the house property charge (section 20)',
    hook: 'BON',
    kind: 'acronym',
    tagline: 'The charge on annual value is “bon” only when all three hold.',
    slideId: 's99',
    items: [
      {
        key: 'B',
        text: 'the property is a building (any structure with walls and a roof, such as a house, flat, shop or godown) or land appurtenant to it (such as a courtyard or garage);',
      },
      { key: 'O', text: 'the assessee is the owner; and' },
      { key: 'N', text: 'the property is not used for the assessee’s own taxable business or profession.' },
    ],
    note: 'Income from letting vacant land not attached to a building falls under other sources or business.',
  },
  {
    id: 'hp-deductions',
    unitId: 'u5',
    title: 'Deductions from annual value (section 22)',
    hook: 'SIP',
    kind: 'acronym',
    tagline: 'Take a SIP from the annual value: the 30% standard deduction, the interest, then pre construction interest in five slices.',
    slideId: 's105',
    items: [
      { key: 'S', text: 'Standard deduction: 30% of the annual value, whatever the actual expenditure. No other repair or maintenance deduction is allowed.' },
      { key: 'I', text: 'Interest payable on capital borrowed to acquire, construct, repair, renew or reconstruct the property, on an accrual basis.' },
      {
        key: 'P',
        text: 'Pre construction interest: interest for the period before the tax year in which the property is acquired or constructed, allowed in five equal instalments from that year',
      },
    ],
    note: 'For self occupied houses, interest and pre construction interest together are limited to Rs. 2,00,000, or Rs. 30,000 where its conditions are not met (section 22(2) and (4)). Under the new regime, no interest deduction is allowed on a self occupied house. For let out houses, section 22 sets no limit on interest.',
  },
  {
    id: 'deemed-owners',
    unitId: 'u5',
    title: 'Deemed owners (section 25)',
    hook: 'CLIPS',
    kind: 'acronym',
    tagline: 'Five people the law CLIPS to the property as its owner.',
    slideId: 's101',
    reordered: true,
    items: [
      { key: 'C', text: 'a member of a cooperative society, company or association to whom a building is allotted or leased under a house building scheme;' },
      {
        key: 'L',
        text: 'a person who acquires rights in a building (other than a monthly lease or a lease of up to one year) by sale, exchange or a lease of at least twelve years, or through membership, shares or any arrangement that enables enjoyment of the property.',
      },
      { key: 'I', text: 'the holder of an impartible estate;' },
      { key: 'P', text: 'a person in possession under part performance of a contract under section 53A of the Transfer of Property Act, 1882; and' },
      {
        key: 'S',
        text: 'an individual who transfers property without adequate consideration to his or her spouse (except under an agreement to live apart) or to a minor child (other than a married daughter);',
      },
    ],
  },

  /* ---------- Unit VI ---------- */
  {
    id: 'depreciation',
    unitId: 'u6',
    title: 'When depreciation is allowed (section 33)',
    hook: 'AOU',
    kind: 'acronym',
    tagline: 'Depreciation is the taxman’s IOU, and you claim it with an AOU.',
    slideId: 's117',
    items: [
      {
        key: 'A',
        text: 'the asset is a tangible asset (buildings, machinery, plant or furniture) or an intangible asset acquired on or after 1 April 1998 (know how, patents, copyrights, trademarks, licences, franchises or similar business or commercial rights), but not goodwill;',
      },
      { key: 'O', text: 'the asset is owned, wholly or partly, by the assessee; and' },
      { key: 'U', text: 'it is used wholly and exclusively for the business or profession, with only a fair proportion allowed for partial business use (section 33(3)(b)).' },
    ],
  },
  {
    id: 'deemed-profits',
    unitId: 'u6',
    title: 'Deemed profits (section 38)',
    hook: 'Real Businessmen Should Bank Wisely',
    kind: 'phrase',
    tagline: 'Five receipts taxed as business income of the year in which they arise, in the order of clauses (a) to (e).',
    slideId: 's125',
    items: [
      {
        key: 'R',
        text: 'the benefit of remission or cessation of a trading liability for which a deduction was allowed, including a unilateral write off in the assessee’s own accounts, and any later recovery of a loss or expenditure allowed earlier;',
      },
      { key: 'B', text: 'a balancing charge on sale of assets of a power undertaking;' },
      { key: 'S', text: 'the excess on sale of a scientific research asset;' },
      { key: 'B', text: 'recovery of a bad debt in excess of the amount not allowed; and' },
      { key: 'W', text: 'withdrawals from a special reserve under section 32(e).' },
    ],
    note: 'These apply even if the business has ceased (section 38(5)).',
  },
  {
    id: 'actual-payment',
    unitId: 'u6',
    title: 'Deductible only on actual payment (section 37)',
    hook: 'Take Care: Late Bills Irritate Railway Managers',
    kind: 'phrase',
    tagline: 'Late bills are the point: these are allowed only when actually paid.',
    slideId: 's124',
    items: [
      { key: 'T', text: 'Taxes, duties, cess and fees' },
      { key: 'C', text: 'employer’s contributions to provident, gratuity and welfare funds' },
      { key: 'L', text: 'leave encashment' },
      { key: 'B', text: 'bonus or commission to employees' },
      { key: 'I', text: 'interest to specified financial entities' },
      { key: 'R', text: 'amounts payable to the Indian Railways' },
      {
        key: 'M',
        text: 'amounts payable to micro and small enterprises beyond the time allowed under section 15 of the Micro, Small and Medium Enterprises Development Act, 2006',
      },
    ],
    note: 'If paid after the year ends but by the due date of the return, they are allowed for the year of the liability, except payments to micro and small enterprises (section 37(3)).',
  },
]
