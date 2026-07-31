// Career OS — "Restart Mission" plan (starts August 2026).
// Rebased from the Mission Control dashboard (masters_mission_control_v2.jsx).
// Zero progress assumed (Mar-Jul 2026 tasks not done), so foundations are
// compressed into Aug-Sep 2026. Mission end unchanged: grad Dec 2027,
// fully-funded MSc/RA offer for the 2028 intake.
// Dates are ISO UTC; display helpers convert to Asia/Dhaka (+6).

function dateISO(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

const PHASES = [
  { key: 'Restart', label: 'Foundations Restart (Aug-Sep 2026)', start: dateISO(2026, 8, 1), end: dateISO(2026, 9, 30), status: 'active', focus: ['CGPA recovery', 'Paper #1 build', 'GitHub portfolio + robot demo', 'IELTS kickoff', 'Document collection'] },
  { key: 'Submit', label: 'Submission & Exams (Oct-Dec 2026)', start: dateISO(2026, 10, 1), end: dateISO(2026, 12, 31), status: 'pending', focus: ['Submit Paper #1', 'IELTS exam (Dec)', 'Chevening', 'SOP + CV + rec letters', 'Transcripts'] },
  { key: 'Outreach', label: 'Outreach & Applications (Jan-Apr 2027)', start: dateISO(2027, 1, 1), end: dateISO(2027, 4, 30), status: 'pending', focus: ['Professor outreach JP/DE/CA/US', 'MEXT + GKS + AAS + Taiwan MOE', 'MEXT research plan', 'Paper #2'] },
  { key: 'Interviews', label: 'Interviews & Final Push (May-Aug 2027)', start: dateISO(2027, 5, 1), end: dateISO(2027, 8, 31), status: 'pending', focus: ['MEXT interview', 'Spring finals', 'Final semester starts', 'Germany apps'] },
  { key: 'AppsGrad', label: 'Applications & Graduation (Sep-Dec 2027)', start: dateISO(2027, 9, 1), end: dateISO(2027, 12, 31), status: 'pending', focus: ['US + Canada apps', 'DAAD', 'Final exams', 'Graduation'] },
];

const DEADLINES = [
  { title: 'Book IELTS Academic exam (December 2026)', dueAt: dateISO(2026, 9, 10), category: 'language', phase: 'Restart', notes: 'Register via British Council Bangladesh. Book the December date now to secure the preferred centre.', critical: true },
  { title: 'Paper #1 submit — URAI/ROBIO (IEEE-indexed)', dueAt: dateISO(2026, 10, 31), category: 'research', phase: 'Submit', notes: 'Primary URAI (Oct). Backup ROBIO (Nov). ICCAS July has passed - submit to the next IEEE conference without delay.', critical: true },
  { title: 'Chevening UK application (long shot)', dueAt: dateISO(2026, 11, 1), category: 'scholarship', phase: 'Submit', notes: '4 essays, leadership + impact narrative. 10 focused hours max.', critical: false },
  { title: 'Recommendation letters requested (3 referees)', dueAt: dateISO(2026, 11, 15), category: 'documents', phase: 'Submit', notes: 'Robotics supervisor, engineering professor, Golden Power contact. 2-month lead + SOP draft + talking points.', critical: true },
  { title: 'IELTS Academic exam — target 7.0+', dueAt: dateISO(2026, 12, 10), category: 'language', phase: 'Submit', notes: 'No band below 6.5. If below: register a Feb/Mar 2027 retake immediately.', critical: true },
  { title: 'SOP final draft (1,000 words)', dueAt: dateISO(2026, 12, 15), category: 'documents', phase: 'Submit', notes: 'Business Turnaround -> Systems Thinking -> Robotics -> Future Research Vision.', critical: true },
  { title: 'Academic CV (international format)', dueAt: dateISO(2026, 12, 20), category: 'documents', phase: 'Submit', notes: 'Education, Research, Publications, Awards, Skills, Work, Leadership, Languages.', critical: false },
  { title: 'MEXT research plan (2,500-3,000 words)', dueAt: dateISO(2027, 3, 1), category: 'documents', phase: 'Outreach', notes: 'The most important MEXT document. Get Japanese translation help.', critical: true },
  { title: 'Taiwan MOE Scholarship application', dueAt: dateISO(2027, 3, 15), category: 'scholarship', phase: 'Outreach', notes: 'UNDERRATED path: 30-45% probability. NTUST, NTHU, NTU. Less Bangladesh competition.', critical: false },
  { title: 'GKS Korea Embassy Track application', dueAt: dateISO(2027, 4, 1), category: 'scholarship', phase: 'Outreach', notes: 'GPA 2.64 cutoff - you qualify NOW. Strong achievements give you the edge.', critical: true },
  { title: 'Australia Awards (AAS) application', dueAt: dateISO(2027, 4, 30), category: 'scholarship', phase: 'Outreach', notes: 'Leadership over GPA. Robotics -> Bangladesh agriculture/disaster monitoring framing.', critical: false },
  { title: 'Paper #2 submit — IROS/ROBIO 2027', dueAt: dateISO(2027, 4, 30), category: 'research', phase: 'Outreach', notes: 'Improve on Paper #1: SLAM, navigation planning, or field test results.', critical: false },
  { title: 'MEXT Embassy Track application (Japan)', dueAt: dateISO(2027, 5, 31), category: 'scholarship', phase: 'Interviews', notes: 'Bangladesh Embassy of Japan. Research Plan + interview May-Jun.', critical: true },
  { title: 'Goethe A2 German exam', dueAt: dateISO(2027, 6, 30), category: 'language', phase: 'Interviews', notes: 'Shows commitment to Germany + Blue Card path.', critical: false },
  { title: 'JLPT N5 exam (Japanese)', dueAt: dateISO(2027, 7, 15), category: 'language', phase: 'Interviews', notes: 'Shows MEXT commitment.', critical: false },
  { title: 'German university applications (WS 2028 intake)', dueAt: dateISO(2027, 8, 31), category: 'university', phase: 'Interviews', notes: 'H-BRS priority. TU Berlin, RPTU, TU Hamburg alternatives. July-Aug deadlines.', critical: true },
  { title: 'DAAD Helmut-Schmidt application (2028 intake)', dueAt: dateISO(2027, 10, 1), category: 'scholarship', phase: 'AppsGrad', notes: 'Apply AFTER Dec 2027 graduation. Work experience is your key asset.', critical: true },
  { title: 'US applications batch 1 (WPI, CU Boulder, Northeastern)', dueAt: dateISO(2027, 10, 15), category: 'university', phase: 'AppsGrad', notes: 'Email professors BEFORE applying. RA funding is supervisor-dependent.', critical: true },
  { title: 'US applications remaining (Oregon State, Utah, Texas A&M)', dueAt: dateISO(2027, 11, 15), category: 'university', phase: 'AppsGrad', notes: '5-8 total US applications, realistic-to-reach spread.', critical: true },
  { title: 'Graduation — degree + certified transcripts', dueAt: dateISO(2027, 12, 31), category: 'milestone', phase: 'AppsGrad', notes: '10 certified transcript copies. Update all applications with final CGPA.', critical: true },
];

const MILESTONES = [
  { title: 'GitHub portfolio + robot demo video live', dueAt: dateISO(2026, 9, 1), category: 'presence', status: 'pending', phase: 'Restart' },
  { title: 'Paper #1 submitted to IEEE conference', dueAt: dateISO(2026, 10, 31), category: 'research', status: 'pending', phase: 'Submit' },
  { title: 'IELTS 7.0+ secured', dueAt: dateISO(2026, 12, 15), category: 'language', status: 'pending', phase: 'Submit' },
  { title: 'SOP + CV + 3 recommendation letters complete', dueAt: dateISO(2026, 12, 20), category: 'documents', status: 'pending', phase: 'Submit' },
  { title: '25+ professors contacted (JP/DE/CA/KR/US/TW)', dueAt: dateISO(2027, 3, 31), category: 'outreach', status: 'pending', phase: 'Outreach' },
  { title: 'MEXT + GKS + AAS + Taiwan MOE submitted', dueAt: dateISO(2027, 5, 1), category: 'scholarship', status: 'pending', phase: 'Outreach' },
  { title: 'MEXT embassy interview completed', dueAt: dateISO(2027, 6, 30), category: 'scholarship', status: 'pending', phase: 'Interviews' },
  { title: 'German applications submitted (WS 2028)', dueAt: dateISO(2027, 8, 31), category: 'university', status: 'pending', phase: 'Interviews' },
  { title: 'US + DAAD applications submitted', dueAt: dateISO(2027, 10, 15), category: 'university', status: 'pending', phase: 'AppsGrad' },
  { title: 'Graduation day', dueAt: dateISO(2027, 12, 31), category: 'milestone', status: 'pending', phase: 'AppsGrad' },
  { title: 'Fully funded MSc/RA offer secured', dueAt: dateISO(2028, 4, 30), category: 'milestone', status: 'pending', phase: 'AppsGrad' },
];

function T(title, category, priority, phase, dueAt, description) {
  return { title, category, priority, phase, dueAt, description, status: 'open', source: 'mission', outcome: '', rating: 0, completedAt: '', createdAt: '' };
}

const TASKS = [
  // ---- AUG 2026: Foundations Restart 1 ----
  T('Calculate exact CGPA trajectory to 3.0+', 'academic', 'high', 'Restart', dateISO(2026, 8, 5), 'Use current 2.61 CGPA, 70/151 credits. Backlog replacement math (8 credits at 0.00). Print and pin on wall.'),
  T('Course selection + backlog retake enrolment', 'academic', 'high', 'Restart', dateISO(2026, 8, 7), 'Choose courses with high lab/project component. Enrol in Digital Electronics retake first.'),
  T('Set up Google Scholar, ResearchGate + update LinkedIn', 'presence', 'medium', 'Restart', dateISO(2026, 8, 7), 'Add IEEE awards, robotics projects, Golden Power Engineering. Upload robot demo to YouTube.'),
  T('Create master scholarship tracker spreadsheet', 'scholarship', 'medium', 'Restart', dateISO(2026, 8, 8), 'Log: MEXT, GKS, DAAD, AAS, Taiwan MOE, Chevening, EMARO+. Fields: deadline, GPA req, docs, status.'),
  T('Book IELTS Academic exam (December 2026)', 'language', 'high', 'Restart', dateISO(2026, 8, 10), 'Register via British Council Bangladesh. Early booking secures preferred test centre.'),
  T('Paper #1: define exact scope & contribution', 'research', 'high', 'Restart', dateISO(2026, 8, 12), '"Low-Cost AMR using ROS2, LiDAR+IMU Sensor Fusion & SLAM - Implementation & Evaluation". One focused contribution.'),
  T('Paper #1: literature review - collect + annotate 25 papers', 'research', 'high', 'Restart', dateISO(2026, 8, 18), 'IEEE Xplore + arXiv: ROS2 SLAM, sensor fusion AMR, LiDAR IMU fusion, low-cost autonomous robot. 3-sentence summaries.'),
  T('Build GitHub portfolio: ROS2 SLAM, sensor fusion, OpenCV repos', 'presence', 'high', 'Restart', dateISO(2026, 8, 20), 'Clean repos with READMEs, results, diagrams, video links. Professors will Google you.'),
  T('Record professional robot demo video (2-3 min, narrated)', 'presence', 'high', 'Restart', dateISO(2026, 8, 24), 'Robot navigating autonomously, SLAM map building, obstacle avoidance. Link in every professor email and CV.'),
  T('IELTS: study exam format & band descriptors', 'language', 'medium', 'Restart', dateISO(2026, 8, 26), 'Understand 4 sections + band 7.0 descriptors. 30 min daily.'),
  T('Paper #1: write Related Work (2-3 pages, IEEE format)', 'research', 'high', 'Restart', dateISO(2026, 8, 29), 'Group papers by approach, identify limitations, lead to your contribution. Overleaf IEEE template.'),

  // ---- SEP 2026: Foundations Restart 2 ----
  T('Paper #1: write Introduction - full draft', 'research', 'high', 'Restart', dateISO(2026, 9, 2), 'Hook -> problem -> proposed solution -> contributions -> structure. 1.5 pages.'),
  T('IELTS Listening: Sections 1 & 2 daily practice', 'language', 'medium', 'Restart', dateISO(2026, 9, 5), 'Form-filling, multiple choice. Cambridge IELTS 14-18. 20 min daily.'),
  T('Paper #1: write Methodology with system diagrams', 'research', 'high', 'Restart', dateISO(2026, 9, 8), 'Hardware: LiDAR, IMU, Jetson Nano, chassis. Software: ROS2 architecture, SLAM algorithm. Block diagram.'),
  T('Approach supervisor - get co-author commitment', 'research', 'high', 'Restart', dateISO(2026, 9, 10), 'Present the outline to a professor. Co-author legitimises and strengthens the paper.'),
  T('Paper #1: run experiments + collect all results (10+ trials)', 'research', 'high', 'Restart', dateISO(2026, 9, 14), 'Navigation accuracy, obstacle detection rate, computation latency. Log everything.'),
  T('Warm-up outreach: email Prof. Ohno & Prof. Yoshida (Tohoku)', 'outreach', 'medium', 'Restart', dateISO(2026, 9, 16), 'Mention Kibo challenge - JAXA-affiliated recognition. Attach GitHub + video demo.'),
  T('Paper #1: write Results & Discussion', 'research', 'high', 'Restart', dateISO(2026, 9, 20), 'Tables, graphs vs baseline. Honest limitations. IEEE figures.'),
  T('Paper #1: Conclusion + Abstract + first full draft', 'research', 'high', 'Restart', dateISO(2026, 9, 24), 'Write abstract LAST (250 words). Submit draft to co-author for review.'),
  T('IELTS Mock Test #1 (full timed conditions)', 'language', 'high', 'Restart', dateISO(2026, 9, 28), 'All 4 sections. Score honestly. Identify 2 weakest areas.'),

  // ---- OCT 2026: Submission & Exams 1 ----
  T('Paper #1: incorporate feedback - second draft', 'research', 'high', 'Submit', dateISO(2026, 10, 2), 'Revise per co-author comments. Ask 2 peers to review.'),
  T('Paper #1: plagiarism check + IEEE figure formatting', 'research', 'high', 'Submit', dateISO(2026, 10, 6), 'Target <15% similarity. High-res, IEEE-formatted figures.'),
  T('SUBMIT Paper #1 to URAI/ROBIO (IEEE-indexed)', 'research', 'critical', 'Submit', dateISO(2026, 10, 10), 'Do not delay. URAI ~Oct, ROBIO ~Nov. Backup: any IEEE conference.'),
  T('IELTS Writing Task 1 & 2 weekly practice', 'language', 'medium', 'Submit', dateISO(2026, 10, 12), 'Task 1 bar charts/process; Task 2 opinion/discussion essays. 40 min each.'),
  T('Chevening: write 4 essays (~500 words each)', 'scholarship', 'high', 'Submit', dateISO(2026, 10, 15), 'Leadership, networking, UK study choice, career impact. 10 focused hours.'),
  T('SOP first full draft (1,000 words)', 'documents', 'high', 'Submit', dateISO(2026, 10, 20), 'Business Turnaround -> Systems Thinking -> Robotics -> Future Vision. One story.'),
  T('Start collecting certified documents (transcripts, police clearance)', 'documents', 'high', 'Submit', dateISO(2026, 10, 25), 'Takes 1-2 weeks in Bangladesh. Start now for GKS/Taiwan/MEXT.'),
  T('Email Prof. Yuichi Kobayashi (Nagoya) - sensor fusion match', 'outreach', 'medium', 'Submit', dateISO(2026, 10, 30), 'Cite one of his papers, explain the connection to your robot project.'),

  // ---- NOV 2026: Submission & Exams 2 ----
  T('Submit Chevening application', 'scholarship', 'high', 'Submit', dateISO(2026, 11, 1), 'One attempt. Review essays one final time.'),
  T('Request 3 recommendation letters (2-month lead)', 'documents', 'high', 'Submit', dateISO(2026, 11, 5), 'Robotics supervisor, engineering professor, Golden Power colleague. Provide SOP draft + talking points.'),
  T('IELTS Mock Test #2 + analyse results', 'language', 'high', 'Submit', dateISO(2026, 11, 8), 'Focus on timing. Track band trends.'),
  T('SOP second draft - incorporate feedback', 'documents', 'high', 'Submit', dateISO(2026, 11, 12), 'Best English professor critique: compelling story? Engineering link clear?'),
  T('Academic CV (international format)', 'documents', 'medium', 'Submit', dateISO(2026, 11, 15), 'Education, Research/Publications, Awards, Skills, Work, Leadership, Languages. 2 pages max.'),
  T('IELTS Writing intensive - Task 2 essays', 'language', 'medium', 'Submit', dateISO(2026, 11, 19), '4 essays. Argument structure, cohesion, complex grammar. Band rubrics.'),
  T('IELTS Mock Test #3 - final prep conditions', 'language', 'high', 'Submit', dateISO(2026, 11, 24), 'Full 2h45min, no breaks, phone off.'),
  T('IELTS final revision - no new material', 'language', 'medium', 'Submit', dateISO(2026, 11, 28), 'Tricky grammar, essay structures, vocabulary. Rest well.'),

  // ---- DEC 2026: Submission & Exams 3 ----
  T('SOP third draft - final polish + proofread', 'documents', 'high', 'Submit', dateISO(2026, 12, 1), 'Grammar, flow, 800-1000 words, country variants. Native proofread.'),
  T('Brief all 3 recommenders with talking points', 'documents', 'medium', 'Submit', dateISO(2026, 12, 5), 'SOP draft + scholarship description + 5 bullet points to emphasise.'),
  T('SIT IELTS ACADEMIC EXAM - target 7.0+', 'language', 'critical', 'Submit', dateISO(2026, 12, 10), 'Stay calm, manage time, answer every question.'),
  T('Fall semester assignment push - submit everything', 'academic', 'high', 'Submit', dateISO(2026, 12, 15), 'Each assignment is CGPA. Zero tolerance for late submissions.'),
  T('Year-end review: update all trackers', 'notes', 'medium', 'Submit', dateISO(2026, 12, 20), 'Check IELTS bands, update CGPA, reassess scholarship shortlist, plan January.'),
  T('Paper #2 outline - advanced contribution', 'research', 'medium', 'Submit', dateISO(2026, 12, 22), 'Lessons from Paper #1. Target IROS/ROBIO 2027.'),

  // ---- JAN 2027: Outreach launch ----
  T('LAUNCH: email 10 Japanese professors', 'outreach', 'critical', 'Outreach', dateISO(2027, 1, 4), 'Personalised each. Read 2 recent papers each. Attach CV + robot video + IEEE award.'),
  T('Email 5 German professors (H-BRS, TU Berlin, RPTU, KIT)', 'outreach', 'high', 'Outreach', dateISO(2027, 1, 8), '"Applying for DAAD Helmut-Schmidt. Are you accepting research students for WS 2028?"'),
  T('Follow up Korean professors (KAIST/POSTECH/UNIST)', 'outreach', 'medium', 'Outreach', dateISO(2027, 1, 12), 'Polite follow-up if no reply within 3 weeks.'),
  T('Email 5 Canadian professors (Concordia, Manitoba, SFU, York)', 'outreach', 'medium', 'Outreach', dateISO(2027, 1, 16), 'Mention Mitacs Globalink application + listed their lab as preference.'),
  T('MEXT Research Plan outline (2,500-3,000 words)', 'documents', 'high', 'Outreach', dateISO(2027, 1, 20), 'Background, Research Problem, Proposed Approach, Expected Results, Schedule, Japan fit.'),
  T('Spring 2027: course selection + 2nd backlog retake', 'academic', 'high', 'Outreach', dateISO(2027, 1, 24), 'Enrol in Accounting retake. Strategic course choice for max GPA.'),
  T('Record all professor responses in tracker', 'outreach', 'high', 'Outreach', dateISO(2027, 1, 28), 'Positive response: schedule video call within the week.'),

  // ---- FEB 2027: Applications build ----
  T('Australia Awards: start application + 3 essays', 'scholarship', 'high', 'Outreach', dateISO(2027, 2, 2), 'Why study / BD development contribution / career plan. 600-800 words each.'),
  T('GKS: finalise all documents for Embassy Track', 'scholarship', 'high', 'Outreach', dateISO(2027, 2, 5), 'Certified transcripts, police clearance, bank statement, health certificate, awards proof.'),
  T('MEXT Research Plan full draft', 'documents', 'critical', 'Outreach', dateISO(2027, 2, 9), 'Cite specific lab work. Get Japanese translation help.'),
  T('Country-specific SOP variants (JP/DE/KR/US)', 'documents', 'high', 'Outreach', dateISO(2027, 2, 12), 'Japan: formal/research. Germany: experience + development. Korea: academic-industry. USA: ambition.'),
  T('Taiwan MOE: complete + submit application', 'scholarship', 'high', 'Outreach', dateISO(2027, 2, 16), 'Deadline Mar 15. 30-45% probability. NTUST/NTHU/NTU.'),
  T('Paper #2: introduction & methodology', 'research', 'medium', 'Outreach', dateISO(2027, 2, 20), 'Cite Paper #1 as prior work - shows research continuity.'),
  T('Email Prof. Hyun Myung (KAIST) - only if paper accepted', 'outreach', 'medium', 'Outreach', dateISO(2027, 2, 24), 'Very competitive. Do not email before paper is accepted.'),

  // ---- MAR 2027: Applications ----
  T('Submit MEXT Embassy application (Bangladesh Embassy Japan)', 'scholarship', 'critical', 'Outreach', dateISO(2027, 3, 1), 'Assemble all docs. Research Plan is #1. Submit promptly.'),
  T('Submit Taiwan MOE application (deadline Mar 15)', 'scholarship', 'high', 'Outreach', dateISO(2027, 3, 5), 'Complete application with all required documents.'),
  T('Email 8-10 US professors for Fall 2028 RA', 'outreach', 'high', 'Outreach', dateISO(2027, 3, 8), 'Specific research connection required. "Prospective PhD/MS Student - Robotics/Sensor Fusion".'),
  T('Submit GKS Embassy Track application', 'scholarship', 'critical', 'Outreach', dateISO(2027, 3, 12), 'Bangladesh Embassy Seoul. CGPA 2.64 cutoff - you qualify NOW.'),
  T('MEXT interview prep begins', 'scholarship', 'high', 'Outreach', dateISO(2027, 3, 16), '5-min research plan explanation, why Japan, career goals, BD contribution. Formal dress.'),
  T('Spring midterms - academic focus', 'academic', 'high', 'Outreach', dateISO(2027, 3, 20), 'Second-to-last semester. Aggressive revision.'),
  T('Submit Australia Awards application (before Apr 30)', 'scholarship', 'high', 'Outreach', dateISO(2027, 3, 26), 'Complete with all essays and references.'),

  // ---- APR 2027: Applications + paper 2 ----
  T('Follow up Japanese professors who responded positively', 'outreach', 'high', 'Outreach', dateISO(2027, 4, 2), '10-min video presentation of robot project. Offer video call. Reference MEXT timeline.'),
  T('Submit Paper #2 to IROS/ROBIO 2027', 'research', 'high', 'Outreach', dateISO(2027, 4, 6), 'Two papers (even under review) strengthens all applications.'),
  T('Finalise SOP for all country variants + native proofread', 'documents', 'high', 'Outreach', dateISO(2027, 4, 10), '4 variants, 800-1,200 words each.'),
  T('University application documents: master folder', 'documents', 'medium', 'Outreach', dateISO(2027, 4, 15), 'Transcripts, IELTS, Research Plan, SOP, CV, Rec Letters, Awards, Publications.'),
  T('GKS document screening - await notification', 'scholarship', 'medium', 'Outreach', dateISO(2027, 4, 22), 'Notified within 4-6 weeks. Prepare for interview or additional docs.'),
  T('Prepare 10-min robot video presentation', 'outreach', 'medium', 'Outreach', dateISO(2027, 4, 28), 'For video calls with interested professors.'),

  // ---- MAY 2027: Finals + interviews ----
  T('Spring finals prep - academic focus', 'academic', 'high', 'Interviews', dateISO(2027, 5, 5), 'Penultimate semester finals. Important for CGPA.'),
  T('Spring final exams', 'academic', 'critical', 'Interviews', dateISO(2027, 5, 12), 'Fight for maximum GPA. Backlog retake grades replace 0.00.'),
  T('MEXT Embassy interview (if shortlisted)', 'scholarship', 'critical', 'Interviews', dateISO(2027, 5, 18), 'Formal dress. Original documents. Know your Research Plan by heart.'),
  T('Video calls with interested professors', 'outreach', 'high', 'Interviews', dateISO(2027, 5, 22), '10-min presentation. "What would you want me to work on?"'),
  T('Update all application docs with Spring 2027 grades', 'documents', 'medium', 'Interviews', dateISO(2027, 5, 26), 'New CGPA, publications, updated CV.'),
  T('Goethe A2 German exam prep + book', 'language', 'low', 'Interviews', dateISO(2027, 5, 29), 'A2 certificate shows commitment to Germany.'),

  // ---- JUN 2027: Results + final planning ----
  T('Await MEXT/GKS results - respond within 24h', 'scholarship', 'high', 'Interviews', dateISO(2027, 6, 3), 'Check email daily. Prepare follow-up documents in advance.'),
  T('US professors pre-application email', 'outreach', 'medium', 'Interviews', dateISO(2027, 6, 8), '"I plan to apply formally in September. Are you accepting students for Fall 2028?"'),
  T('Final semester (Fall 2027) registration - last GPA push', 'academic', 'high', 'Interviews', dateISO(2027, 6, 12), 'Include 3rd backlog retake course. Max GPA this final semester.'),
  T('If accepted: onboarding; if not: activate backups', 'scholarship', 'high', 'Interviews', dateISO(2027, 6, 16), 'Rejected: immediately activate USA/Canada/Germany backup paths. No wallowing.'),
  T('Paper #2 reviewer responses (if any)', 'research', 'medium', 'Interviews', dateISO(2027, 6, 22), 'Respond within 2 weeks maximum.'),
  T('Goethe A2 exam', 'language', 'low', 'Interviews', dateISO(2027, 6, 28), 'Some German programs and employers value it.'),

  // ---- JUL 2027: Final semester start + Germany ----
  T('Fall 2027 (FINAL semester) begins - 3rd backlog enrolment', 'academic', 'critical', 'Interviews', dateISO(2027, 7, 1), 'Last chance to replace the remaining 0.00 grade. Priority enrolment.'),
  T('Germany: finalise H-BRS + TU Berlin applications', 'scholarship', 'high', 'Interviews', dateISO(2027, 7, 6), 'WS 2028 intake. Check each university deadline carefully.'),
  T('Canada final outreach - aggressive follow-up', 'outreach', 'medium', 'Interviews', dateISO(2027, 7, 12), 'Reference Mitacs. "Two conference papers submitted and IELTS 7.0."'),
  T('Prepare all US application documents', 'documents', 'high', 'Interviews', dateISO(2027, 7, 16), 'GRE decision (skip for EU/Asia). Finalise SOP, CV, 3 rec letters, transcripts.'),
  T('JLPT N5 exam (Japanese)', 'language', 'low', 'Interviews', dateISO(2027, 7, 20), 'Shows MEXT commitment.'),
  T('Final semester academic maximum effort', 'academic', 'high', 'Interviews', dateISO(2027, 7, 24), 'Attend every class, lab, tutorial. Ask for feedback early.'),

  // ---- AUG 2027: Germany + US portals ----
  T('Submit 2-3 German university applications (WS 2028)', 'scholarship', 'critical', 'Interviews', dateISO(2027, 8, 3), 'H-BRS priority. TU Berlin, RPTU, TU Hamburg. Full docs + motivation letter.'),
  T('DAAD Helmut-Schmidt prep - motivation letter', 'scholarship', 'high', 'Interviews', dateISO(2027, 8, 8), 'Emphasise professional experience + development impact.'),
  T('Create US university portal accounts + upload docs', 'documents', 'medium', 'Interviews', dateISO(2027, 8, 12), 'Portals open Aug-Sep. Upload early. Do not wait for deadlines.'),
  T('Confirm publication status of both papers - update CV', 'documents', 'medium', 'Interviews', dateISO(2027, 8, 18), '"Published" strongest. "Under review" still good. Update everywhere.'),
  T('Final semester: continue maximum academic effort', 'academic', 'high', 'Interviews', dateISO(2027, 8, 24), 'Your final CGPA is being decided this semester.'),

  // ---- SEP 2027: US batch 1 + DAAD + midterms ----
  T('US professors: final pre-application email', 'outreach', 'high', 'AppsGrad', dateISO(2027, 9, 2), '"My application is coming in October/November. My paper [title] is now [status]."'),
  T('Submit first batch US apps (WPI, CU Boulder, Northeastern)', 'scholarship', 'critical', 'AppsGrad', dateISO(2027, 9, 6), 'Each: SOP, CV, IELTS, transcripts, 3 rec letters. Confirm recommenders submitted.'),
  T('Submit DAAD Helmut-Schmidt (deadline Oct 1)', 'scholarship', 'critical', 'AppsGrad', dateISO(2027, 9, 10), 'Lead with: 2+ years work experience, robotics achievements, international experience.'),
  T('Submit Canada apps (Concordia, Manitoba MASc)', 'scholarship', 'high', 'AppsGrad', dateISO(2027, 9, 14), 'Include Mitacs connection. Follow up professors immediately after applying.'),
  T('Final semester midterms - academic focus', 'academic', 'high', 'AppsGrad', dateISO(2027, 9, 18), 'Last midterms ever. Give everything.'),
  T('Final semester midterm exams', 'academic', 'critical', 'AppsGrad', dateISO(2027, 9, 24), 'Backlog course grade replaces 0.00 - calculate exact CGPA impact.'),

  // ---- OCT 2027: US remaining + graduation docs ----
  T('Submit remaining US apps (Oregon State, Utah, Texas A&M)', 'scholarship', 'critical', 'AppsGrad', dateISO(2027, 10, 2), '5-8 total US applications. Professor relationship = higher success rate.'),
  T('DAAD submission confirmed', 'scholarship', 'high', 'AppsGrad', dateISO(2027, 10, 6), 'October deadline is firm.'),
  T('Graduation documentation: confirm credits + request 10 transcripts', 'documents', 'high', 'AppsGrad', dateISO(2027, 10, 12), 'Meet registrar. Confirm all credits, graduation application deadline.'),
  T('Chevening results (if applied) - interview prep', 'scholarship', 'medium', 'AppsGrad', dateISO(2027, 10, 18), 'Interview is in-person at British High Commission.'),
  T('Politecnico di Torino MSc Mechatronics application', 'scholarship', 'medium', 'AppsGrad', dateISO(2027, 10, 24), 'Low competition from Bangladesh. Internal scholarship cycles.'),
  T('Final semester: strong finish - last submissions', 'academic', 'high', 'AppsGrad', dateISO(2027, 10, 28), 'Submit all assignments, projects, lab reports. Build rapport for rec letter updates.'),

  // ---- NOV 2027: Final exams ----
  T('Collect 10 sealed certified transcripts', 'documents', 'high', 'AppsGrad', dateISO(2027, 11, 2), 'Different deadlines need different transcript copies. Get them now.'),
  T('Application status review - follow up all pending', 'scholarship', 'medium', 'AppsGrad', dateISO(2027, 11, 5), 'Send status check emails. Note interview invitations.'),
  T('FINAL EXAMS PREP - most important academic week', 'academic', 'critical', 'AppsGrad', dateISO(2027, 11, 10), 'Determines graduating CGPA. Total concentration.'),
  T('FINAL EXAMS - graduating CGPA locked in', 'academic', 'critical', 'AppsGrad', dateISO(2027, 11, 17), 'Give everything. Every extra 0.1 on CGPA changes your scholarship narrative.'),
  T('Update final CGPA in all application documents', 'documents', 'high', 'AppsGrad', dateISO(2027, 11, 24), 'As soon as results post: update CV, SOP references, portals.'),

  // ---- DEC 2027: Graduation ----
  T('Collect degree certificate & official transcripts', 'documents', 'critical', 'AppsGrad', dateISO(2027, 12, 2), 'Keep originals safe. Make copies.'),
  T('Share graduation confirmation with all applications', 'scholarship', 'high', 'AppsGrad', dateISO(2027, 12, 5), '"I confirm I have completed my BSc EEE from UAP, graduating December 2027."'),
  T('Follow up all pending US decisions', 'scholarship', 'medium', 'AppsGrad', dateISO(2027, 12, 10), 'Most US decisions Jan-Mar 2028. Confirm documents received.'),
  T('DAAD: confirm processing + university admission status', 'scholarship', 'medium', 'AppsGrad', dateISO(2027, 12, 14), 'German universities confirm admission Jan-Feb 2028. Stay in contact.'),
  T('Year-end strategic review - evaluate all options', 'notes', 'high', 'AppsGrad', dateISO(2027, 12, 20), 'Accepted, pending, rejected. Contingency plan. Best career + quality of life?'),
  T('Celebrate & prepare for the next chapter', 'notes', 'medium', 'AppsGrad', dateISO(2027, 12, 28), 'You made it to graduation. Execute the offers that have arrived.'),
];

const GOALS = [
  { goal: 'Fully funded MSc/RA in Robotics, Autonomous Systems, or Embedded AI', by: '2028 intake', status: 'active' },
  { goal: 'Submit Paper #1 to an IEEE-indexed conference', by: 'October 2026', status: 'active' },
  { goal: 'IELTS 7.0+', by: 'December 2026', status: 'active' },
  { goal: 'CGPA recovery to 3.0+ with strong upward trend', by: 'December 2027', status: 'active' },
  { goal: '25+ professor/research contacts', by: 'March 2027', status: 'active' },
  { goal: 'MEXT + GKS + AAS + Taiwan MOE submitted', by: 'May 2027', status: 'active' },
];

const SUMMARY = 'Restart of the fully-funded Masters mission from August 2026 (zero prior progress assumed). Compressed foundations: GPA recovery + Paper #1 + GitHub/robot-demo portfolio + IELTS kickoff in Aug-Sep 2026. Paper #1 submitted Oct 2026, IELTS exam Dec 2026, SOP/CV/recommendation letters by Dec 2026. Professor outreach Jan-Mar 2027 (JP/DE/CA/KR/US/TW), Taiwan MOE + GKS + AAS + MEXT submitted by May 2027, MEXT interview May-Jun 2027. Final semester Jul-Dec 2027, German apps Aug 2027, DAAD + US + Canada apps Sep-Nov 2027, graduation Dec 2027, fully-funded offer by Apr 2028.';

module.exports = { PHASES, DEADLINES, MILESTONES, TASKS, GOALS, SUMMARY };
