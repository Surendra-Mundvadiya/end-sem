/*
 * History of taxation. Unit I part 2 (s2) is the backbone; other dated milestones come from the slides cited on
 * each event. Undated items (ancient and medieval, and the Constitution) carry no year: the notes give none.
 */

export type EraId = 'ancient' | 'medieval' | 'ideas' | 'british' | 'independence' | 'act'

export interface Era {
  id: EraId
  name: string
  span: string
}

export const ERAS: Era[] = [
  { id: 'ancient', name: 'Ancient India', span: 'Manusmriti, Arthashastra, Raghuvamsha' }, // s2
  { id: 'medieval', name: 'Medieval period', span: 'Land revenue' }, // s2
  { id: 'ideas', name: 'Ideas from abroad', span: '1689 and 1776' }, // s10, s5
  { id: 'british', name: 'British period', span: '1860 to 1935' }, // s2
  { id: 'independence', name: 'After Independence', span: 'The Constitution to 2021' }, // s2, s3, s8, s22, s24
  { id: 'act', name: 'The 2025 Act', span: 'February 2025 to April 2026' }, // s2, s45, s48
]

export interface TimelineEvent {
  id: string
  era: EraId
  /** Big marker text: a year, or a label when the notes give no year. */
  marker: string
  /** Day and month, when the notes give them. */
  dateLabel?: string
  /** Sortable date (YYYY-MM-DD; 00 for unknown parts). Absent for undated items. */
  sortKey?: string
  title: string
  summary: string
  detail: string
  /** Label for the ordering game, written so it does not give the year away. */
  gameLabel?: string
  slideId: string
}

export const EVENTS: TimelineEvent[] = [
  /* Ancient India (s2) */
  {
    id: 'manu',
    era: 'ancient',
    marker: 'Ancient',
    title: 'The Manusmriti, Chapter VII',
    summary: 'Take moderate taxes, little by little, as the leech, the calf and the bee take their food.',
    detail:
      'The Manusmriti (Chapter VII) asks the king to take moderate taxes, little by little, as the leech, the calf and the bee take their food, and allows him a share of the crop of one sixth, one eighth or one twelfth.',
    slideId: 's2',
  },
  {
    id: 'kautilya',
    era: 'ancient',
    marker: 'Ancient',
    title: 'Kautilya’s Arthashastra',
    summary: 'An organised revenue system, with its own officials.',
    detail: 'Kautilya’s Arthashastra describes an organised revenue system with officials such as the samaharta (collector general) and the sannidhata (treasurer).',
    slideId: 's2',
  },
  {
    id: 'kalidasa',
    era: 'ancient',
    marker: 'Ancient',
    title: 'Kalidasa’s Raghuvamsha',
    summary: 'King Dilipa taxed his subjects only for their welfare.',
    detail: 'Kalidasa’s Raghuvamsha praises King Dilipa, who taxed his subjects only for their welfare, as the sun draws up water only to return it a thousandfold as rain.',
    slideId: 's2',
  },

  /* Medieval (s2) */
  {
    id: 'todarmal',
    era: 'medieval',
    marker: 'Medieval',
    title: 'Akbar and Raja Todar Mal',
    summary: 'Land revenue was the main source of income.',
    detail: 'Land revenue was the main source of income. Under Akbar, Raja Todar Mal reorganised it on the basis of measurement of land and average produce.',
    slideId: 's2',
  },

  /* Ideas from abroad */
  {
    id: 'billofrights',
    era: 'ideas',
    marker: '1689',
    sortKey: '1689-00-00',
    title: 'The English Bill of Rights',
    summary: 'No levy of money for the Crown without the grant of Parliament.',
    detail: 'The English Bill of Rights, 1689 made it illegal to levy money for the Crown without the grant of Parliament. Article 265 carries the same idea.',
    gameLabel: 'England makes it illegal to levy money for the Crown without the grant of Parliament',
    slideId: 's10',
  },
  {
    id: 'smith',
    era: 'ideas',
    marker: '1776',
    sortKey: '1776-00-00',
    title: 'Adam Smith, The Wealth of Nations',
    summary: 'The four canons: equality, certainty, convenience and economy.',
    detail:
      'Adam Smith’s four canons in The Wealth of Nations (1776) remain the starting point: equality, certainty, convenience and economy. Later writers added productivity, elasticity, flexibility, simplicity and diversity.',
    gameLabel: 'Adam Smith sets out four canons of taxation',
    slideId: 's5',
  },

  /* British period (s2) */
  {
    id: 'y1860',
    era: 'british',
    marker: '1860',
    sortKey: '1860-00-00',
    title: 'Income tax is first introduced',
    summary: 'By James Wilson, the first Finance Member.',
    detail: 'Income tax was first introduced in 1860 by James Wilson, the first Finance Member, to meet the financial strain after the revolt of 1857.',
    gameLabel: 'James Wilson, the first Finance Member, introduces income tax',
    slideId: 's2',
  },
  {
    id: 'y1886',
    era: 'british',
    marker: '1886',
    sortKey: '1886-00-00',
    title: 'The Income Tax Act, 1886',
    summary: 'It gave income tax a lasting form.',
    detail: 'The Income Tax Act, 1886 gave it a lasting form, followed by the Acts of 1918 and 1922.',
    gameLabel: 'An Income Tax Act gives the tax a lasting form',
    slideId: 's2',
  },
  {
    id: 'y1918',
    era: 'british',
    marker: '1918',
    sortKey: '1918-00-00',
    title: 'The Income Tax Act, 1918',
    summary: 'The next Act after 1886.',
    detail: 'The Income Tax Act, 1886 gave it a lasting form, followed by the Acts of 1918 and 1922.',
    slideId: 's2',
  },
  {
    id: 'y1922',
    era: 'british',
    marker: '1922',
    sortKey: '1922-00-00',
    title: 'The Income Tax Act, 1922',
    summary: 'The Act the Law Commission reviewed before the 1961 Act.',
    // s2; the last sentence is from the notes' introduction ("How to read the references")
    detail:
      'The Acts of 1918 and 1922 followed the 1886 Act. The Income Tax Act, 1961 came into force on 1 April 1962, after the Law Commission’s Twelfth Report (1958) on the 1922 Act. Most leading cases in the notes were decided under the 1961 Act or the 1922 Act.',
    slideId: 's2',
  },
  {
    id: 'y1935',
    era: 'british',
    marker: '1935',
    sortKey: '1935-00-00',
    title: 'The Government of India Act, 1935',
    summary: 'Taxes on income other than agricultural income go to the Federal List (Entry 54).',
    detail: 'The Government of India Act, 1935 placed taxes on income other than agricultural income in the Federal List (Entry 54) and left agricultural income to the provinces.',
    gameLabel: 'Taxes on income other than agricultural income are placed in the Federal List (Entry 54)',
    slideId: 's2',
  },

  /* After Independence */
  {
    id: 'constitution',
    era: 'independence',
    marker: 'The Constitution',
    title: 'The taxing power is divided',
    summary: 'Parliament: taxes on income other than agricultural income. The States: taxes on agricultural income.',
    detail: 'The Constitution gave Parliament taxes on income other than agricultural income (Entry 82, List I) and the States taxes on agricultural income (Entry 46, List II).',
    slideId: 's2',
  },
  {
    id: 'y1956',
    era: 'independence',
    marker: '1956',
    sortKey: '1956-00-00',
    title: 'Nicholas Kaldor’s report',
    summary: 'It led to the wealth, expenditure and gift tax Acts.',
    detail: 'Nicholas Kaldor’s report (1956) led to the Wealth Tax Act, 1957, the Expenditure Tax Act, 1957 and the Gift Tax Act, 1958.',
    gameLabel: 'Nicholas Kaldor’s report',
    slideId: 's2',
  },
  {
    id: 'y1957',
    era: 'independence',
    marker: '1957',
    sortKey: '1957-00-00',
    title: 'The Wealth Tax Act and the Expenditure Tax Act',
    summary: 'Both followed Kaldor’s report.',
    detail: 'Nicholas Kaldor’s report (1956) led to the Wealth Tax Act, 1957, the Expenditure Tax Act, 1957 and the Gift Tax Act, 1958.',
    slideId: 's2',
  },
  {
    id: 'y1958',
    era: 'independence',
    marker: '1958',
    sortKey: '1958-00-00',
    title: 'The Gift Tax Act, and the Law Commission’s Twelfth Report',
    summary: 'The Twelfth Report examined the 1922 Act.',
    detail: 'The Gift Tax Act, 1958 followed Kaldor’s report. The Law Commission’s Twelfth Report (1958) on the 1922 Act preceded the Income Tax Act, 1961.',
    slideId: 's2',
  },
  {
    id: 'y1962',
    era: 'independence',
    marker: '1962',
    dateLabel: '1 April',
    sortKey: '1962-04-01',
    title: 'The Income Tax Act, 1961 comes into force',
    summary: 'On 1 April 1962, after the Law Commission’s Twelfth Report.',
    // s2; the last sentence is from s45
    detail:
      'The Income Tax Act, 1961 came into force on 1 April 1962, after the Law Commission’s Twelfth Report (1958) on the 1922 Act. It had been amended almost every year for six decades by the time it was replaced.',
    gameLabel: 'The Act that the 2025 Act replaced comes into force',
    slideId: 's2',
  },
  {
    id: 'y1963',
    era: 'independence',
    marker: '1963',
    sortKey: '1963-00-00',
    title: 'The Central Boards of Revenue Act, 1963',
    summary: 'The two Boards that administer direct and indirect taxes.',
    detail:
      'Direct taxes are administered by the Central Board of Direct Taxes and indirect taxes by the Central Board of Indirect Taxes and Customs, both under the Central Boards of Revenue Act, 1963.',
    slideId: 's3',
  },
  {
    id: 'y1998',
    era: 'independence',
    marker: '1998',
    dateLabel: '1 October',
    sortKey: '1998-10-01',
    title: 'Gift tax stops applying',
    summary: 'To gifts made on or after 1 October 1998.',
    detail: 'Gift tax ceased to apply to gifts made on or after 1 October 1998.',
    gameLabel: 'Gift tax stops applying to new gifts',
    slideId: 's2',
  },
  {
    id: 'y2000',
    era: 'independence',
    marker: '2000',
    sortKey: '2000-00-00',
    title: 'The Eightieth Amendment: one divisible pool',
    summary: 'Article 272 removed; Union List taxes shared as a single pool.',
    detail:
      'The Constitution (Eightieth Amendment) Act, 2000 removed Article 272 and made all Union List taxes, with the stated exceptions, a single divisible pool, following the Tenth Finance Commission’s alternative scheme of devolution.',
    gameLabel: 'Article 272 is removed and Union List taxes become a single divisible pool',
    slideId: 's22',
  },
  {
    id: 'y2010',
    era: 'independence',
    marker: '2010',
    sortKey: '2010-00-00',
    title: 'The Direct Taxes Code Bill',
    summary: 'Introduced in 2010; it lapsed in 2014.',
    detail: 'A Direct Taxes Code Bill introduced in 2010 lapsed in 2014.',
    gameLabel: 'A Direct Taxes Code Bill is introduced (it later lapsed)',
    slideId: 's2',
  },
  {
    id: 'y2012',
    era: 'independence',
    marker: '2012',
    sortKey: '2012-00-00',
    title: 'Retrospective tax on indirect transfers',
    summary: 'After Vodafone, the Finance Act, 2012 amended the 1961 Act retrospectively.',
    detail: 'After Vodafone, the Finance Act, 2012 retrospectively amended the 1961 Act to tax indirect transfers.',
    gameLabel: 'After Vodafone, the 1961 Act is amended retrospectively to tax indirect transfers',
    slideId: 's8',
  },
  {
    id: 'y2015',
    era: 'independence',
    marker: '2015',
    sortKey: '2015-00-00',
    title: 'Wealth tax abolished',
    summary: 'By the Finance Act, 2015.',
    detail: 'Wealth tax was abolished by the Finance Act, 2015.',
    gameLabel: 'Wealth tax is abolished',
    slideId: 's2',
  },
  {
    id: 'y2016',
    era: 'independence',
    marker: '2016',
    sortKey: '2016-00-00',
    title: 'GST: the One Hundred and First Amendment',
    summary: 'Articles 246A, 269A and 279A.',
    detail: 'The One Hundred and First Amendment (2016) introduced Articles 246A, 269A and 279A.',
    gameLabel: 'The One Hundred and First Amendment introduces Articles 246A, 269A and 279A (GST)',
    slideId: 's24',
  },
  {
    id: 'y2021',
    era: 'independence',
    marker: '2021',
    sortKey: '2021-00-00',
    title: 'The Taxation Laws (Amendment) Act, 2021',
    summary: 'No demand on the retrospective basis for transfers before 28 May 2012.',
    detail:
      'The Taxation Laws (Amendment) Act, 2021 provided that no demand would be raised on that basis for transfers before 28 May 2012, subject to conditions. Indirect transfers are now dealt with prospectively in section 9(10).',
    gameLabel: 'Parliament provides that no demand will be raised on old indirect transfers, subject to conditions',
    slideId: 's8',
  },

  /* The 2025 Act (s2 unless noted) */
  {
    id: 'bill',
    era: 'act',
    marker: '2025',
    dateLabel: '13 February',
    sortKey: '2025-02-13',
    title: 'The Income Tax Bill, 2025 is introduced',
    summary: 'Examined by a Select Committee of 31 members.',
    detail: 'The Income Tax Bill, 2025 was introduced on 13 February 2025.',
    gameLabel: 'The Income Tax Bill, 2025 is introduced',
    slideId: 's2',
  },
  {
    id: 'select',
    era: 'act',
    marker: '2025',
    dateLabel: '21 July',
    sortKey: '2025-07-21',
    title: 'The Select Committee reports',
    summary: '31 members, chaired by Baijayant Panda.',
    detail: 'The Bill was examined by a Select Committee of 31 members chaired by Baijayant Panda, which reported on 21 July 2025.',
    gameLabel: 'The Select Committee chaired by Baijayant Panda reports',
    slideId: 's2',
  },
  {
    id: 'withdrawn',
    era: 'act',
    marker: '2025',
    dateLabel: '8 August',
    sortKey: '2025-08-08',
    title: 'The first Bill is withdrawn',
    summary: 'Three days later, the Income Tax (No. 2) Bill, 2025 passed the Lok Sabha.',
    detail: 'The Bill was withdrawn on 8 August 2025.',
    gameLabel: 'The first Bill is withdrawn',
    slideId: 's2',
  },
  {
    id: 'loksabha',
    era: 'act',
    marker: '2025',
    dateLabel: '11 August',
    sortKey: '2025-08-11',
    title: 'The No. 2 Bill passes the Lok Sabha',
    summary: 'Passed as a Money Bill.',
    detail:
      'The Income Tax (No. 2) Bill, 2025 was passed by the Lok Sabha on 11 August 2025, as a Money Bill. A Money Bill is introduced only in the Lok Sabha, and the Rajya Sabha can only make recommendations within fourteen days (Article 109).',
    gameLabel: 'The Income Tax (No. 2) Bill passes the Lok Sabha',
    slideId: 's10',
  },
  {
    id: 'rajyasabha',
    era: 'act',
    marker: '2025',
    dateLabel: '12 August',
    sortKey: '2025-08-12',
    title: 'The Rajya Sabha passes it',
    summary: 'One day after the Lok Sabha.',
    detail: 'The Income Tax (No. 2) Bill, 2025 was passed by the Lok Sabha on 11 August and by the Rajya Sabha on 12 August 2025.',
    gameLabel: 'The Income Tax (No. 2) Bill passes the Rajya Sabha',
    slideId: 's2',
  },
  {
    id: 'assent',
    era: 'act',
    marker: '2025',
    dateLabel: '21 August',
    sortKey: '2025-08-21',
    title: 'Assent: Act 30 of 2025',
    summary: 'The Income Tax Act, 2025 receives assent.',
    detail: 'It received assent on 21 August 2025. It is Act 30 of 2025, and its long title describes it as an Act to consolidate and amend the law relating to income tax.',
    gameLabel: 'The Income Tax Act, 2025 receives assent',
    slideId: 's45',
  },
  {
    id: 'rules',
    era: 'act',
    marker: '2026',
    dateLabel: '20 March',
    sortKey: '2026-03-20',
    title: 'The Income Tax Rules, 2026 are notified',
    summary: 'Under section 533, by Notification No. 22/2026.',
    detail: 'The Income Tax Rules, 2026 were notified under section 533 by Notification No. 22/2026, G.S.R. 198(E), dated 20 March 2026, and came into force on 1 April 2026.',
    gameLabel: 'The Income Tax Rules, 2026 are notified',
    slideId: 's48',
  },
  {
    id: 'inforce',
    era: 'act',
    marker: '2026',
    dateLabel: '1 April',
    sortKey: '2026-04-01',
    title: 'The 2025 Act comes into force',
    summary: 'Section 1(3). The first tax year runs from 1 April 2026 to 31 March 2027.',
    detail:
      'The Act came into force on 1 April 2026 (section 1(3)). The first tax year under the 2025 Act runs from 1 April 2026 to 31 March 2027; income earned from 1 April 2025 to 31 March 2026 remains under the 1961 Act.',
    gameLabel: 'The Income Tax Act, 2025 comes into force',
    slideId: 's64',
  },
]

/** Events usable in the ordering game: dated, with a label that hides the year. */
export const GAME_EVENTS = EVENTS.filter((e) => e.sortKey && e.gameLabel)

export function formatWhen(e: TimelineEvent): string {
  return e.dateLabel ? `${e.dateLabel} ${e.marker}` : e.marker
}
