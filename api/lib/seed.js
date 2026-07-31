// Roadmap-derived seed data for Sadnan's career plan.
// Dates use ISO (UTC); display helpers convert to Asia/Dhaka (+6).

function dateISO(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

// Key scholarship / application deadlines
const DEADLINES = [
  { title: 'IELTS Academic exam (target 7.0+)', dueAt: dateISO(2026, 6, 30), category: 'language', phase: 'Foundations', notes: 'Register + prepare. If below 6.5, retake in August.', critical: true },
  { title: 'Paper #1 hard deadline - submit to conference (ICCAS/URAI/ROBIO)', dueAt: dateISO(2026, 9, 30), category: 'research', phase: 'Foundations', notes: 'Stop everything else and submit this month. Primary ICCAS July 2026; backups ROBIO/URAI Aug-Sep.', critical: true },
  { title: 'GRE exam (if pursuing USA)', dueAt: dateISO(2026, 9, 15), category: 'standardized', phase: 'Foundations', notes: 'Target Quant 165+, Verbal 155+.', critical: false },
  { title: 'Mitacs Globalink Research Award application', dueAt: dateISO(2026, 10, 1), category: 'opportunity', phase: 'Foundations', notes: '5 Canadian robotics professors; applications open ~Sept.', critical: true },
  { title: 'Chevening UK application (one long shot)', dueAt: dateISO(2026, 10, 31), category: 'scholarship', phase: 'Gear Up', notes: '4 essays, leadership + impact narrative. 10 hours max.', critical: false },
  { title: 'SOP full first draft (1,000-1,200 words)', dueAt: dateISO(2026, 10, 25), category: 'documents', phase: 'Gear Up', notes: 'Business Turnaround -> Systems Thinking -> Robotics -> Future Research Vision.', critical: true },
  { title: 'Recommendation letter requests (3 referees)', dueAt: dateISO(2026, 11, 15), category: 'documents', phase: 'Gear Up', notes: 'Robotics supervisor, engineering professor, Golden Power professional contact. 2-month lead.', critical: true },
  { title: 'Academic CV (international format)', dueAt: dateISO(2026, 12, 1), category: 'documents', phase: 'Gear Up', notes: 'Education, Research, Publications (under review), Awards, Skills, Work, Leadership, Languages.', critical: false },
  { title: 'Professor outreach FULL LAUNCH (10 JP + 5 DE + 5 CA)', dueAt: dateISO(2027, 1, 31), category: 'outreach', phase: 'Outreach', notes: 'Most important month. Personalized emails, video call prep, 10-min robot demo.', critical: true },
  { title: 'Australia Awards application (AAS) window', dueAt: dateISO(2027, 4, 15), category: 'scholarship', phase: 'Outreach', notes: 'Opens Feb 2027. Bangladesh development framing essential.', critical: false },
  { title: 'GKS Korea application (embassy track)', dueAt: dateISO(2027, 3, 31), category: 'scholarship', phase: 'Outreach', notes: 'GPA 2.64 cutoff - you are 2.68. Study plan separate from SOP.', critical: true },
  { title: 'MEXT Embassy Track application (Japan)', dueAt: dateISO(2027, 5, 31), category: 'scholarship', phase: 'Outreach', notes: 'Research plan 2,000-3,000 words is the most important document. Embassy interview May-June.', critical: true },
  { title: 'MEXT research plan (2,000-3,000 words)', dueAt: dateISO(2027, 2, 28), category: 'documents', phase: 'Outreach', notes: 'Get Japanese translation help.', critical: true },
  { title: 'Germany H-BRS + 2-3 program applications (Winter 2027/Summer 2028)', dueAt: dateISO(2027, 4, 30), category: 'university', phase: 'Outreach', notes: 'anabin.kmk.org evaluation.', critical: false },
  { title: 'Paper #2 first draft', dueAt: dateISO(2027, 4, 30), category: 'research', phase: 'Outreach', notes: 'Target IROS 2027 or ICRA 2027.', critical: false },
  { title: 'Goethe A2/B1 German exam', dueAt: dateISO(2027, 6, 30), category: 'language', phase: 'Peak', notes: 'Strengthens German applications + Blue Card.', critical: false },
  { title: 'US university applications open (5-8 apps, Fall 2028)', dueAt: dateISO(2027, 12, 15), category: 'university', phase: 'Peak', notes: 'WPI, CU Boulder, Northeastern, Oregon State, Texas A&M. Email professors BEFORE applying.', critical: true },
  { title: 'DAAD Helmut-Schmidt application (2028 intake)', dueAt: dateISO(2027, 10, 31), category: 'scholarship', phase: 'Peak', notes: 'Apply AFTER Dec 2027 graduation. Needs degree certificate.', critical: true },
  { title: 'Graduation - certified transcripts + degree', dueAt: dateISO(2027, 12, 31), category: 'milestone', phase: 'Peak', notes: '10 certified copies of transcripts.', critical: true },
  { title: 'JLPT N5 exam (Japanese)', dueAt: dateISO(2027, 7, 15), category: 'language', phase: 'Peak', notes: 'Shows MEXT commitment.', critical: false },
];

// Plan phases (from the roadmap's monthly plan)
const PHASES = [
  { key: 'Foundations', label: 'Foundations (Mar-Sep 2026)', start: dateISO(2026, 3, 1), end: dateISO(2026, 9, 30), status: 'active', focus: ['IELTS', 'Paper #1', 'GRE decision', 'Mitacs Globalink', 'CGPA recovery'] },
  { key: 'GearUp', label: 'Gear Up (Oct-Dec 2026)', start: dateISO(2026, 10, 1), end: dateISO(2026, 12, 31), status: 'pending', focus: ['Chevening', 'SOP', 'Recommendation letters', 'Academic CV', 'GKS documents', 'Year-end review'] },
  { key: 'Outreach', label: 'Outreach (Jan-Jun 2027)', start: dateISO(2027, 1, 1), end: dateISO(2027, 6, 30), status: 'pending', focus: ['Professor emails JP/DE/CA/US', 'MEXT application + interview', 'GKS application', 'AAS application', 'Paper #2'] },
  { key: 'Peak', label: 'Peak Applications (Jul-Dec 2027)', start: dateISO(2027, 7, 1), end: dateISO(2027, 12, 31), status: 'pending', focus: ['US applications', 'DAAD application', 'Graduation', 'German exam', 'Results & backups'] },
];

// Milestones (checkpoints to celebrate/track)
const MILESTONES = [
  { title: 'IELTS 7.0+ secured', dueAt: dateISO(2026, 7, 15), category: 'language', status: 'pending', phase: 'Foundations' },
  { title: 'Paper #1 submitted to IEEE conference', dueAt: dateISO(2026, 9, 30), category: 'research', status: 'pending', phase: 'Foundations' },
  { title: 'Mitacs Globalink submitted', dueAt: dateISO(2026, 10, 1), category: 'opportunity', status: 'pending', phase: 'Foundations' },
  { title: '25+ professors researched & contact list built', dueAt: dateISO(2026, 12, 31), category: 'outreach', status: 'pending', phase: 'GearUp' },
  { title: 'MEXT application submitted', dueAt: dateISO(2027, 5, 31), category: 'scholarship', status: 'pending', phase: 'Outreach' },
  { title: 'Graduation day', dueAt: dateISO(2027, 12, 31), category: 'milestone', status: 'pending', phase: 'Peak' },
  { title: 'Fully funded MSc/RA offer secured', dueAt: dateISO(2028, 4, 30), category: 'milestone', status: 'pending', phase: 'Peak' },
];

// Initial tasks (immediate actions for the current month)
const TASKS = [
  { title: 'Review all remaining semesters and pick A/A+ courses', category: 'academic', priority: 'high', phase: 'Foundations', status: 'open', dueAt: dateISO(2026, 8, 7) },
  { title: 'Calculate exact CGPA trajectory to reach 3.0 by Dec 2027', category: 'academic', priority: 'high', phase: 'Foundations', status: 'open', dueAt: dateISO(2026, 8, 10) },
  { title: 'Identify 3 target conferences (ROBIO, ICCAS, URAI) deadlines', category: 'research', priority: 'high', phase: 'Foundations', status: 'open', dueAt: dateISO(2026, 8, 12) },
  { title: 'Update LinkedIn + Google Scholar + ResearchGate + YouTube demo', category: 'presence', priority: 'high', phase: 'Foundations', status: 'open', dueAt: dateISO(2026, 8, 20) },
  { title: 'Build Japanese professor contact list (10 professors)', category: 'outreach', priority: 'medium', phase: 'Foundations', status: 'open', dueAt: dateISO(2026, 8, 31) },
  { title: 'Meet UAP academic advisor about grade recovery + retake policy', category: 'academic', priority: 'medium', phase: 'Foundations', status: 'open', dueAt: dateISO(2026, 8, 15) },
];

const GOALS = [
  { goal: 'Fully funded MSc/RA in Robotics, Autonomous Systems, or Embedded AI', by: '2028 intake', status: 'active' },
  { goal: 'Submit Paper #1 to an IEEE conference', by: 'September 2026', status: 'active' },
  { goal: 'IELTS 7.0+', by: 'June 2026', status: 'active' },
  { goal: 'CGPA recovery to 3.0+ with strong upward trend', by: 'December 2027', status: 'active' },
  { goal: 'Build 25+ professor/research contacts', by: 'December 2026', status: 'active' },
];

module.exports = { DEADLINES, PHASES, MILESTONES, TASKS, GOALS };
