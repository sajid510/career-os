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
  { key: 'Restart', label: 'Foundations Restart (Aug-Sep 2026)', start: dateISO(2026, 8, 1), end: dateISO(2026, 9, 30), status: 'done', focus: ['CGPA recovery', 'Papers submitted ×2 (ICECE + ICCIT)', 'GitHub portfolio + robot demo', 'Scholarship tracker setup', 'Document collection'] },
  { key: 'Submit', label: 'Submission & Exams (Oct-Dec 2026)', start: dateISO(2026, 10, 1), end: dateISO(2026, 12, 31), status: 'active', focus: ['ICECE/ICCIT decisions (Nov 1)', 'Spring finals prep + prep leave', 'Chevening (go/no-go)', 'SOP + CV + rec letters', 'Transcripts'] },
  { key: 'Outreach', label: 'Outreach & Applications (Jan-Apr 2027)', start: dateISO(2027, 1, 1), end: dateISO(2027, 4, 30), status: 'pending', focus: ['Professor outreach JP/DE/CA/US', 'CSC + Eiffel (Jan windows)', 'MEXT research plan', 'IELTS background daily', 'Paper #2'] },
  { key: 'Interviews', label: 'Interviews & Final Push (May-Aug 2027)', start: dateISO(2027, 5, 1), end: dateISO(2027, 8, 31), status: 'pending', focus: ['MEXT interview', 'Spring finals', 'Final semester starts', 'Germany apps'] },
  { key: 'AppsGrad', label: 'Applications & Graduation (Sep-Dec 2027)', start: dateISO(2027, 9, 1), end: dateISO(2027, 12, 31), status: 'pending', focus: ['US + Canada apps', 'DAAD', 'Final exams', 'Graduation'] },
  { key: 'Cycle28', label: '2028 Cycle & Offers (Jan-Aug 2028)', start: dateISO(2028, 1, 1), end: dateISO(2028, 8, 31), status: 'pending', focus: ['GKS + Taiwan MOE + MIS + Turkiye', 'IELTS-armed applications', 'Offers & enrollment'] },
];

const DEADLINES = [
  { title: 'ICECE 2026 notification — decision day (BUET, Dhaka)', dueAt: dateISO(2026, 11, 1), category: 'research', phase: 'Submit', notes: 'If accepted: update SOP, CV, GitHub, professor emails the same day. If rejected: extract reviewer feedback toward Paper #3; ICCIT still pending.', critical: true },
  { title: 'Chevening UK application (long shot)', dueAt: dateISO(2026, 11, 1), category: 'scholarship', phase: 'Submit', notes: '4 essays, leadership + impact narrative. 10 focused hours max.', critical: false },
  { title: 'Recommendation letters requested (3 referees)', dueAt: dateISO(2026, 11, 15), category: 'documents', phase: 'Submit', notes: 'Robotics supervisor, engineering professor, Golden Power contact. 2-month lead + SOP draft + talking points.', critical: true },
  { title: 'SOP final draft (1,000 words)', dueAt: dateISO(2026, 12, 15), category: 'documents', phase: 'Submit', notes: 'Business Turnaround -> Systems Thinking -> Robotics -> Future Research Vision.', critical: true },
  { title: 'Academic CV (international format)', dueAt: dateISO(2026, 12, 20), category: 'documents', phase: 'Submit', notes: 'Education, Research, Publications, Awards, Skills, Work, Leadership, Languages.', critical: false },
  { title: 'MEXT research plan (2,500-3,000 words)', dueAt: dateISO(2027, 3, 1), category: 'documents', phase: 'Outreach', notes: 'The most important MEXT document. Get Japanese translation help.', critical: true },
  { title: 'GKS Korea Embassy Track application (2028 cycle)', dueAt: dateISO(2028, 4, 1), category: 'scholarship', phase: 'Cycle28', notes: 'GPA 2.64 cutoff - must be crossed via retakes. Embassy track Feb-Apr 2028 with IELTS in hand. Strong achievements give you the edge once eligible.', critical: true },
  { title: 'Taiwan MOE Scholarship application (2028 cycle)', dueAt: dateISO(2028, 3, 15), category: 'scholarship', phase: 'Cycle28', notes: 'Needs ~3.0 at graduation. NTUST, NTHU, NTU. Verify MOI/IELTS per program.', critical: false },
  { title: 'Journal manuscript submit (IROS 2027 or alternate robotics journal)', dueAt: dateISO(2027, 3, 5), category: 'research', phase: 'Outreach', notes: 'Verify exact deadline + track at venue site first. Methods frozen Nov 2026, data from Dec 2026 break, drafted Jan-Feb 2027.', critical: true },
  { title: 'Paper #2 submit — IROS/ROBIO 2027', dueAt: dateISO(2027, 4, 30), category: 'research', phase: 'Outreach', notes: 'Improve on ICECE/ICCIT submissions: SLAM, navigation planning, or field test results.', critical: false },
  { title: 'MEXT Embassy Track application (Japan)', dueAt: dateISO(2027, 5, 31), category: 'scholarship', phase: 'Interviews', notes: 'Bangladesh Embassy of Japan. Research Plan + interview May-Jun.', critical: true },
  { title: 'Goethe A2 German exam', dueAt: dateISO(2027, 6, 30), category: 'language', phase: 'Interviews', notes: 'Shows commitment to Germany + Blue Card path.', critical: false },
  { title: 'IELTS Academic exam — target 7.0+', dueAt: dateISO(2027, 8, 15), category: 'language', phase: 'Interviews', notes: 'Exact date per June booking (British Council, Academic module). Unlocks all 2028 applications.', critical: true },
  { title: 'Eiffel Excellence Scholarship (via French institution)', dueAt: dateISO(2027, 1, 6), category: 'scholarship', phase: 'Outreach', notes: 'Official Campus France close early Jan (page lists Jan 6/8 - use earliest). Institutions-only: student-side internal deadlines Oct-Nov 2026, move NOW. Bangladesh eligible, under-29 rule.', critical: false },
  { title: 'CSC China Type A application (Bangladesh window)', dueAt: dateISO(2027, 1, 10), category: 'scholarship', phase: 'Outreach', notes: 'EXPECTED from 2026 pattern (window closed Jan 10 2026) - confirm via embassy notice ~Dec 2026. Pre-admission letter + MOI (conditional per program).', critical: true },
  { title: 'JLPT N5 exam (Japanese, Dhaka)', dueAt: dateISO(2026, 12, 6), category: 'language', phase: 'Submit', notes: 'JUAAB Dhaka, 4356 TK. Registration open since Sep 1 - register NOW (end date unpublished). Shows MEXT commitment.', critical: false },
  { title: 'German university applications (WS 2028 intake)', dueAt: dateISO(2027, 8, 31), category: 'university', phase: 'Interviews', notes: 'H-BRS priority. TU Berlin, RPTU, TU Hamburg alternatives. July-Aug deadlines.', critical: true },
  { title: 'DAAD EPOS application (H-BRS route, 2028 intake)', dueAt: dateISO(2027, 10, 31), category: 'scholarship', phase: 'AppsGrad', notes: 'Correct programme for engineering (Helmut-Schmidt removed - social sciences only). Verify exact course deadline (typically Aug-Oct). Needs IELTS 6.5+ (Aug 2027 fits) + work experience.', critical: true },
  { title: 'US applications: WPI MS Robotics (holistic review)', dueAt: dateISO(2027, 10, 15), category: 'university', phase: 'AppsGrad', notes: 'One of very few standalone MS Robotics programs. Email professors BEFORE applying. RA funding is supervisor-dependent.', critical: true },
  { title: 'US applications: Oregon State field robotics (precision-ag angle)', dueAt: dateISO(2027, 11, 15), category: 'university', phase: 'AppsGrad', notes: 'Max 2-3 US programs total (WPI + Oregon State only). Professor relationship = higher success rate. Only apply if ICECE/ICCIT paper accepted.', critical: true },
  { title: 'Graduation — degree + certified transcripts', dueAt: dateISO(2027, 12, 31), category: 'milestone', phase: 'AppsGrad', notes: '10 certified transcript copies. Update all applications with final CGPA.', critical: true },
];

const MILESTONES = [
  { title: 'GitHub portfolio + robot demo video live', dueAt: dateISO(2026, 9, 1), category: 'presence', status: 'pending', phase: 'Restart' },
  { title: 'Two papers submitted (ICECE + ICCIT 2026)', dueAt: dateISO(2026, 10, 31), category: 'research', status: 'done', phase: 'Submit' },
  { title: 'ICECE 2026 decision received', dueAt: dateISO(2026, 11, 1), category: 'research', status: 'pending', phase: 'Submit' },
  { title: 'Supervisor secured as co-author', dueAt: dateISO(2026, 10, 7), category: 'research', status: 'done', phase: 'Submit' },
  { title: 'Journal submitted (IROS 2027 or robotics journal)', dueAt: dateISO(2027, 3, 5), category: 'research', status: 'pending', phase: 'Outreach' },
  { title: 'Thesis v2 complete, ready for 2028 journal run', dueAt: dateISO(2027, 12, 20), category: 'research', status: 'pending', phase: 'AppsGrad' },
  { title: 'ICCIT 2026 decision received', dueAt: dateISO(2026, 12, 20), category: 'research', status: 'pending', phase: 'Submit' },
  { title: 'IELTS 7.0+ secured', dueAt: dateISO(2027, 8, 31), category: 'language', status: 'pending', phase: 'Interviews' },
  { title: 'SOP + CV + 3 recommendation letters complete', dueAt: dateISO(2026, 12, 20), category: 'documents', status: 'pending', phase: 'Submit' },
  { title: '25+ professors contacted (JP/DE/CA/KR/US/TW)', dueAt: dateISO(2027, 3, 31), category: 'outreach', status: 'pending', phase: 'Outreach' },
  { title: 'MEXT + CSC + Eiffel submitted (2027 cycle)', dueAt: dateISO(2027, 5, 1), category: 'scholarship', status: 'pending', phase: 'Outreach' },
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
  T('Calculate exact CGPA trajectory to 3.0+', 'academic', 'high', 'Restart', dateISO(2026, 10, 12), 'Use current 2.59 CGPA over 76 earned credits (F excluded until retaken). Backlog math: 6 F courses, 17 credits. Print and pin on wall.'),
  T('Course selection + backlog retake enrolment', 'academic', 'high', 'Restart', dateISO(2026, 10, 13), 'Confirm retake registrations are locked for Nov exams. No registration = no 2.64 crossing. with high lab/project component. Enrol in Digital Electronics retake first.'),
  T('Set up Google Scholar, ResearchGate + update LinkedIn', 'presence', 'medium', 'Restart', dateISO(2026, 10, 14), 'Add IEEE awards, robotics projects, Golden Power Engineering. Upload robot demo to YouTube.'),
  T('Create master scholarship tracker spreadsheet', 'scholarship', 'medium', 'Restart', dateISO(2026, 10, 15), 'Log: MEXT, GKS, DAAD EPOS, Taiwan MOE, CSC, Eiffel, Chevening. Fields: deadline, GPA req, docs, status.'),
  T('Record ICECE/ICCIT submission details (IDs, tracks, timelines)', 'research', 'high', 'Submit', dateISO(2026, 10, 12), 'Save confirmation emails, paper IDs, reviewer timelines. Needed for professor emails + acceptance kit.'),
  T('Post both papers to arXiv cs.RO as preprints', 'research', 'high', 'Submit', dateISO(2026, 10, 11), 'Google Scholar-findable immediately. 45 minutes. Zero downside.'),
  T('Fix GitHub: populate/private robot-oda-tracking, fix ultron_devboard link, pin top 3', 'presence', 'medium', 'Submit', dateISO(2026, 10, 11), 'Professors check GitHub - empty repo raises follow-through questions. 30 minutes.'),
  T('Update Academic CV: BEAR, Ultron UV, 2 papers, Webmaster', 'documents', 'high', 'Submit', dateISO(2026, 10, 14), 'Current CVs miss your three strongest achievements. 2 hours.'),
  T('Request MOI certificate from UAP Registrar', 'documents', 'high', 'Submit', dateISO(2026, 10, 15), 'Free, ~3 days. Substitutes IELTS for MEXT Embassy Track + CSC English-medium programs in 2027 cycle.'),
  T('Register CSC portal account (campuschina.org)', 'scholarship', 'medium', 'Submit', dateISO(2026, 10, 13), 'Explore university portal now; highest-probability new route must not start cold in December.'),
  T('Register JLPT N5 (JUAAB Dhaka, Dec 6 exam)', 'language', 'high', 'Submit', dateISO(2026, 10, 12), 'Registration open since Sep 1, end date unpublished - register NOW. 4356 TK. Then 30 min/day prep.'),
  T('Add submitted papers to Google Scholar, ResearchGate, GitHub READMEs', 'presence', 'medium', 'Submit', dateISO(2026, 10, 14), 'List as under-review with venue + date. Professors check these before replying.'),
  T('Build GitHub portfolio: ROS2 SLAM, sensor fusion, OpenCV repos', 'presence', 'high', 'Restart', dateISO(2026, 10, 20), 'Clean repos with READMEs, results, diagrams, video links. Professors will Google you.'),
  T('Record professional robot demo video (2-3 min, narrated)', 'presence', 'high', 'Restart', dateISO(2026, 10, 24), 'Robot navigating autonomously, SLAM map building, obstacle avoidance. Link in every professor email and CV.'),
  T('Lit review sprint W1: 3 papers (1 per member) + shared notes doc', 'research', 'high', 'Submit', dateISO(2026, 10, 18), 'Journal groundwork: SLAM + sensor fusion + hospital robotics. One-page summary each, supervisor-approved format.'),
  T('Prepare acceptance-update kit (result paragraph + CV line + email snippet)', 'documents', 'high', 'Submit', dateISO(2026, 10, 20), 'Pre-write so ICECE/ICCIT acceptances ship to SOP, CV and professor emails within 24h.'),
  T('Lit review sprint W2: 3 papers (1 per member)', 'research', 'high', 'Submit', dateISO(2026, 10, 25), 'Continue journal groundwork. Flag methods that could shape our methodology.'),
  T('Lit review sprint W3: 3 papers (1 per member)', 'research', 'high', 'Submit', dateISO(2026, 11, 1), 'Same day as ICECE decision - reviews in the morning, decision response in the evening.'),
  T('Lit review sprint W4 (final 3) + METHODOLOGY FREEZE workshop', 'research', 'critical', 'Submit', dateISO(2026, 11, 4), '10+ papers total. Team + supervisor lock EVERY journal methodology before prep leave starts Nov 5. No new methods after this.'),

  // ---- SEP 2026: Foundations Restart 2 ----
  T('Notify recommenders of submitted papers (adds letter weight)', 'documents', 'medium', 'Submit', dateISO(2026, 10, 24), 'Share paper titles + venues so referees cite research output concretely.'),
  T('Prepare 10-min results talk (MEXT interview + professor calls)', 'outreach', 'medium', 'Submit', dateISO(2026, 10, 28), 'Robot demo + submitted-paper story. Reusable for video calls from January.'),
  T('Collect Ultron UV metrics: 20+ trials (ATE, success rate, loop closure)', 'research', 'high', 'Submit', dateISO(2026, 10, 25), 'Zero metrics = zero technical credibility in professor emails. Any numbers beat none.'),
  // ---- Strategy v2 country research sequence: country -> universities -> scholarships -> professors ----
  T('Research FRANCE: Eiffel rules + ENSTA Bretagne + INRIA/RTAB-Map links', 'research', 'high', 'Submit', dateISO(2026, 10, 20), 'Visa + intakes; Brest costs; ENSTA English MSc + deadlines + docs; Eiffel Jan-2027 institutional path; MOI/IELTS per program.'),
  T('Research JAPAN: visa, intakes, costs, MEXT routes, MOI rules', 'research', 'high', 'Submit', dateISO(2026, 10, 25), 'Post-study work options; April vs September intakes; Sendai/Nagoya/Nomi costs; JSPS/RIKEN funding landscape; JLPT needs; entrance-exam rules.'),
  T('Research Japanese universities: JAIST, Tohoku, Nagoya, Ritsumeikan', 'research', 'high', 'Submit', dateISO(2026, 11, 2), 'English programs + MOI acceptance each; Ohno/Yoshida/Honda labs + deadlines + RA funding; internal scholarships.'),
  T('Research CHINA: CSC + HIT/ZJU/NUAA + pre-admission letters', 'research', 'high', 'Submit', dateISO(2026, 11, 9), 'Visa + intakes; Harbin/Hangzhou/Nanjing costs; CSC window + ~80 BD quota evidence; MOI per program; Jiangsu/Zhejiang provincials in parallel.'),
  T('Research MALAYSIA: MIS + UTM CAIRO + UPM', 'research', 'medium', 'Outreach', dateISO(2026, 11, 16), 'Visa + Sep/Feb intakes; KL costs; MIS Mar-Apr 2028 window + Bangladesh eligibility; FRGS RA stipends + IELTS/MOI rules; find CAIRO professor name.'),
  T('Research GERMANY: EPOS + H-BRS/TU Berlin/TU Hamburg + blocked account', 'research', 'medium', 'Outreach', dateISO(2026, 11, 23), '18-month job-seeker visa; intakes; Sankt Augustin costs; EPOS Oct-Nov 2027 window + 2yr-experience fit; blocked-account math; MOI recognition.'),
  T('Research PORTUGAL: IST/ISR-Lisboa + Ventura/Bernardino + FCT', 'research', 'medium', 'Submit', dateISO(2026, 12, 5), 'Visa + intake; Lisbon costs; ISR groups (mobile robots, SLAM); FCT Dec-Feb timeline + MSc RA availability; IELTS-for-visa vs MOI.'),
  T('Research ITALY: PoliTo/PoliMi/Sapienza + Matteucci + internal cycles', 'research', 'medium', 'Outreach', dateISO(2026, 12, 12), 'Visa + Sept intake + cycles; Turin/Milan/Rome costs; internal scholarship deadlines; RA ~EUR 900/mo terms; MOI acceptance per school.'),
  T('Research CANADA: MASc thesis routes + Concordia/Manitoba profs + NSERC', 'research', 'medium', 'Outreach', dateISO(2027, 1, 10), 'PGWP rules; Jan/Sept intakes; Montreal/Manitoba costs; NSERC RA stipends 17-22k CAD + tuition coverage; study-permit IELTS rules; FIND both professor names.'),
  T('Research TAIWAN: NTUST/NTHU/NTU + institutional vs MOE + Fu lab', 'research', 'medium', 'Outreach', dateISO(2027, 1, 17), 'Visa + intakes; Taipei costs; NTUST top-20% institutional route (no 3.0 gate); MOE Mar 2028 + 3.0 mapping; MOI acceptance.'),
  T('Research SOUTH KOREA: GKS-2028 + KAIST/SKKU/UNIST/Hanyang/Pusan RA', 'research', 'medium', 'Outreach', dateISO(2027, 1, 24), 'D-2/E-7 visas; Mar/Sept intakes; Daejeon/Seoul/Ulsan costs; GKS Feb-Apr 2028 + 2.64 gate math; RA stipends + IELTS/MOI rules.'),
  T('Research SINGAPORE: NTU RIS + MAE scholarship + EP pathway', 'research', 'low', 'Outreach', dateISO(2027, 2, 7), 'Student pass + EP (SGD 4-6k/mo); Jan/Aug intakes; costs; MAE simultaneous-application rule; no-GPA-cutoff confirmation; find NTU-SG robotics names.'),
  T('Research USA: WPI/Oregon State RA + TOEFL/GRE waivers + costs', 'research', 'low', 'Outreach', dateISO(2027, 2, 14), 'F-1 + STEM OPT 36mo; Fall intake; Worcester/Corvallis costs; NSF RA stipends 25-35k USD; TOEFL vs MOI; GRE waiver per program; apply ONLY if paper accepted.'),
  T('Research TURKEY (conditional): Turkiye Scholarships + METU/Bogazici/ITU', 'research', 'low', 'Outreach', dateISO(2027, 2, 21), 'ONLY if graduation trajectory clears 3.0 (75% rule). Jan-Feb 2028 window; ~4% acceptance; METU autonomous systems + professor names; own language assessment rules.'),
  T('Write Research Plan v1 (2,500 words, JAIST focus)', 'documents', 'high', 'Submit', dateISO(2026, 12, 10), 'The document that compensates for GPA. Iterate 5x before January launch.'),
  T('Approach supervisor - confirm formal co-authorship terms', 'research', 'high', 'Restart', dateISO(2026, 10, 16), 'Supervisor secured: confirm authorship order, review turnaround, and journal-target responsibilities in writing.'),
  T('ICECE decision day — act within 24h', 'research', 'critical', 'Submit', dateISO(2026, 11, 1), 'Accepted: deploy acceptance kit everywhere. Rejected: extract reviewer feedback toward Paper #3; ICCIT still pending.'),
  T('Warm-up outreach: email Prof. Ohno & Prof. Yoshida (Tohoku)', 'outreach', 'medium', 'Restart', dateISO(2026, 10, 28), 'Mention Kibo challenge + ICECE/ICCIT submitted papers - JAXA-affiliated recognition plus under-review work. Attach GitHub + video demo.'),
  T('ICCIT decision watch — check site, log outcome', 'research', 'high', 'Submit', dateISO(2026, 12, 15), 'Notification TBA (Cox\u2019s Bazar, Dec 18-20). Check weekly; same 24h acceptance routine.'),
  T('Reviewer-feedback file: log all incoming ICECE/ICCIT comments', 'research', 'medium', 'Restart', dateISO(2026, 11, 3), 'Every reviewer sentence becomes a future-paper or rebuttal asset.'),

  // ---- OCT 2026: Submission & Exams 1 ----
  T('Share ICECE outcome with recommenders within 48h', 'documents', 'medium', 'Submit', dateISO(2026, 11, 3), 'Acceptance strengthens letters; rejection still shows research activity.'),
  T('Update outreach tracker with paper decision news', 'outreach', 'medium', 'Submit', dateISO(2026, 11, 5), 'Every contacted professor gets the decision news; strengthens the January launch.'),
  T('Scope Paper #3 from reviewer feedback (contingent on decisions)', 'research', 'medium', 'Submit', dateISO(2026, 12, 22), 'Only if feedback reveals a clear next contribution. Builds on both submissions.'),
  T('Chevening: write 4 essays (~500 words each)', 'scholarship', 'high', 'Submit', dateISO(2026, 10, 15), 'Leadership, networking, UK study choice, career impact. 10 focused hours.'),
  T('SOP first full draft (1,000 words)', 'documents', 'high', 'Submit', dateISO(2026, 10, 20), 'Business Turnaround -> Systems Thinking -> Robotics -> Future Vision. One story.'),
  T('Start collecting certified documents (transcripts, police clearance)', 'documents', 'high', 'Submit', dateISO(2026, 10, 25), 'Takes 1-2 weeks in Bangladesh. Start now for GKS/Taiwan/MEXT.'),
  T('Email Prof. Yuichi Kobayashi (Nagoya) - sensor fusion match', 'outreach', 'medium', 'Submit', dateISO(2026, 10, 30), 'Cite one of his papers, explain the connection to your robot project.'),

  // ---- NOV 2026: Submission & Exams 2 ----
  T('Submit Chevening application', 'scholarship', 'high', 'Submit', dateISO(2026, 11, 1), 'One attempt. Review essays one final time.'),
  T('Request 3 recommendation letters (do it THIS WEEK)', 'documents', 'high', 'Submit', dateISO(2026, 11, 5), 'Robotics supervisor, engineering professor, Golden Power colleague. Provide SOP draft + talking points. Prep leave + finals leave no room later - ask now.'),
  T('SOP second draft - incorporate feedback', 'documents', 'high', 'Submit', dateISO(2026, 11, 12), 'Best English professor critique: compelling story? Engineering link clear?'),
  T('Academic CV (international format)', 'documents', 'medium', 'Submit', dateISO(2026, 11, 15), 'Education, Research/Publications, Awards, Skills, Work, Leadership, Languages. 2 pages max.'),

  // ---- DEC 2026: Submission & Exams 3 ----
  T('SOP third draft - final polish + proofread', 'documents', 'high', 'Submit', dateISO(2026, 12, 1), 'Grammar, flow, 800-1000 words, country variants. Native proofread.'),
  T('Brief all 3 recommenders with talking points', 'documents', 'medium', 'Submit', dateISO(2026, 12, 5), 'SOP draft + scholarship description + 5 bullet points to emphasise.'),
  T('Eiffel: secure institutional nomination path (internal deadlines Oct-Nov)', 'scholarship', 'high', 'Submit', dateISO(2026, 11, 15), 'Eiffel is institutions-only: identify nominating French institution + ENSTA contact NOW, before Campus France closes early Jan.'),
  T('CSC watch: check embassy notice for 2027 Type A window', 'scholarship', 'high', 'Submit', dateISO(2026, 12, 1), 'Last Bangladesh window closed Jan 10. Confirm dates, quota, MOI stance the week it publishes.'),
  T('Fall semester assignment push - submit everything', 'academic', 'high', 'Submit', dateISO(2026, 12, 15), 'Each assignment is CGPA. Zero tolerance for late submissions.'),
  T('Year-end review: update all trackers', 'notes', 'medium', 'Submit', dateISO(2026, 12, 20), 'Review CGPA, reassess scholarship shortlist, plan January.'),
  T('Paper #2 outline - advanced contribution', 'research', 'medium', 'Submit', dateISO(2026, 12, 22), 'Lessons from ICECE/ICCIT submissions. Target IROS/ROBIO 2027.'),
  T('Hardware campaign GO/NO-GO checkpoint', 'research', 'critical', 'Submit', dateISO(2026, 12, 5), 'If December experiments slip, the March journal deadline cascades. Adjust timeline + writing start BEFORE January, not after.'),
  T('Hardware test campaign: run physical robot, collect journal datasets', 'research', 'critical', 'Submit', dateISO(2026, 12, 15), 'Semester break window. Full sensor logs, nav trials, failure cases - everything the journal methods need.'),
  T('Curate experiment data + draft all journal figures/tables', 'research', 'high', 'Submit', dateISO(2026, 12, 28), 'Clean datasets, captioned figures, results tables ready before writing starts.'),

  // ---- JAN 2027: Outreach launch ----
  T('Submit CSC China Type A application (Bangladesh window)', 'scholarship', 'critical', 'Outreach', dateISO(2027, 1, 10), 'Confirm window via embassy notice first. Include pre-admission letter if secured + MOI where accepted.'),
  T('CSC pre-contact: email HIT + ZJU robotics faculty for pre-admission letters', 'scholarship', 'high', 'Submit', dateISO(2026, 11, 18), 'Pre-admission letters take 4-6 weeks to secure. January emailing leaves zero buffer - start now.'),
  T('Warm-up email: Prof. Seung-Mok Lee (Kookmin, best-fit lab)', 'outreach', 'high', 'Submit', dateISO(2026, 11, 22), 'Tightest topic match in tracker (LiDAR-vision SLAM, ROS2). Junior faculty recruiting for 2027. First email goes here, not January.'),
  T('Verify Stipendium Hungaricum: Bangladesh quota + BME program English rule', 'scholarship', 'high', 'Submit', dateISO(2026, 10, 17), 'If eligible: BME Budapest EE/Mechatronics English MSc becomes the backup lane. Decide go/no-go this week.'),
  T('LAUNCH: email 10 Japanese professors', 'outreach', 'critical', 'Outreach', dateISO(2027, 1, 4), 'Personalised each. Read 2 recent papers each. Attach CV + robot video + IEEE award.'),
  T('Email 5 German professors (H-BRS, TU Berlin, TU Hamburg)', 'outreach', 'high', 'Outreach', dateISO(2027, 1, 8), '"Applying for DAAD EPOS (Development-Related Postgraduate Courses) for H-BRS MSc Autonomous Systems. Are you accepting research students for WS 2028?"'),
  T('Follow up Korean professors (KAIST/POSTECH/UNIST)', 'outreach', 'medium', 'Outreach', dateISO(2027, 1, 12), 'Polite follow-up if no reply within 3 weeks.'),
  T('Email 5 Canadian professors (Concordia, Manitoba, SFU, York)', 'outreach', 'medium', 'Outreach', dateISO(2027, 1, 16), 'NSERC-funded RA interest + listed their lab as preference. Thesis-based MASc only.'),
  T('MEXT Research Plan outline (2,500-3,000 words)', 'documents', 'high', 'Outreach', dateISO(2027, 1, 20), 'Background, Research Problem, Proposed Approach, Expected Results, Schedule, Japan fit.'),
  T('Spring 2027: course selection + 2nd backlog retake', 'academic', 'high', 'Outreach', dateISO(2027, 1, 24), 'Enrol in Accounting retake. Strategic course choice for max GPA.'),
  T('IELTS foundation checkpoint: daily 30-45m habit holding since Oct', 'language', 'medium', 'Outreach', dateISO(2027, 1, 31), 'Reading/Listening daily + 3 essays/week since Jan. Must be automatic by now - intensive starts May.'),
  T('IELTS Writing Task 2 set: 3 timed essays (Jan)', 'language', 'medium', 'Outreach', dateISO(2027, 1, 28), 'Writing + Speaking cap engineers at Band 6. Weekly sets Jan-Apr; get feedback on each.'),
  T('IELTS Writing Task 2 set: 3 timed essays (Feb)', 'language', 'medium', 'Outreach', dateISO(2027, 2, 28), 'Same weekly discipline. Track band trend per essay.'),
  T('IELTS Writing Task 2 set: 3 timed essays (Mar)', 'language', 'medium', 'Outreach', dateISO(2027, 3, 28), 'Same weekly discipline. Argument structure + cohesion focus.'),
  T('IELTS Writing Task 2 set: 3 timed essays (Apr)', 'language', 'medium', 'Outreach', dateISO(2027, 4, 28), 'Final foundation set before May intensive. Must be at 6.5+ level.'),
  T('Record all professor responses in tracker', 'outreach', 'high', 'Outreach', dateISO(2027, 1, 28), 'Positive response: schedule video call within the week.'),

  // ---- FEB 2027: Applications build ----
  T('GKS: finalise all documents for Embassy Track', 'scholarship', 'high', 'Cycle28', dateISO(2028, 2, 5), 'Certified transcripts, police clearance, bank statement, health certificate, awards proof. Only if 2.64 crossed.'),
  T('MEXT Research Plan full draft', 'documents', 'critical', 'Outreach', dateISO(2027, 2, 9), 'Cite specific lab work. Get Japanese translation help.'),
  T('Country-specific SOP variants (JP/DE/KR/US)', 'documents', 'high', 'Outreach', dateISO(2027, 2, 12), 'Japan: formal/research. Germany: experience + development. Korea: academic-industry. USA: ambition.'),
  T('Taiwan MOE: complete + submit application', 'scholarship', 'high', 'Cycle28', dateISO(2028, 2, 16), 'Deadline Mar 15 2028. Needs ~3.0 at graduation. NTUST/NTHU/NTU.'),
  T('Journal draft v1: methods + experiments sections', 'research', 'high', 'Outreach', dateISO(2027, 1, 31), 'Two-month writing block starts. Methods from frozen Nov-2026 set, experiments from Dec datasets.'),
  T('Email Prof. Hyun Myung (KAIST) - only if paper accepted', 'outreach', 'medium', 'Outreach', dateISO(2027, 2, 24), 'Very competitive. Do not email before paper is accepted.'),

  // ---- MAR 2027: Applications ----
  T('Submit MEXT Embassy application (Bangladesh Embassy Japan)', 'scholarship', 'critical', 'Outreach', dateISO(2027, 3, 1), 'Assemble all docs. Research Plan is #1. Submit promptly.'),
  T('Submit Taiwan MOE application (deadline Mar 15 2028)', 'scholarship', 'high', 'Cycle28', dateISO(2028, 3, 5), 'Complete application with all required documents. Only if ~3.0 reached.'),
  T('Email 8-10 US professors for Fall 2028 RA', 'outreach', 'high', 'Outreach', dateISO(2027, 3, 8), 'Specific research connection required. "Prospective PhD/MS Student - Robotics/Sensor Fusion".'),
  T('Submit GKS Embassy Track application', 'scholarship', 'critical', 'Cycle28', dateISO(2028, 3, 12), 'Bangladesh Embassy Seoul. Only if retakes crossed 2.64 - verify CGPA first.'),
  T('Submit NTU Singapore MSc RIS + MAE scholarship application', 'scholarship', 'high', 'AppsGrad', dateISO(2027, 10, 31), 'Jan 2028 intake. Apply MAE simultaneously. Verify English rule per program.'),
  T('Submit Malaysia MIS application (UTM/UPM)', 'scholarship', 'high', 'Cycle28', dateISO(2028, 4, 1), 'Mar-Apr 2028 window with Aug 2027 IELTS in hand. CAIRO professor interest letter attached.'),
  T('Turkiye Scholarships application (CONDITIONAL on 3.0)', 'scholarship', 'medium', 'Cycle28', dateISO(2028, 2, 1), 'Apply ONLY if graduation trajectory clears 75% (~3.0). ~4% acceptance; METU focus. Skip otherwise - no sunk cost.'),
  T('Compare all offers: funding, lab, location, work rights', 'notes', 'high', 'Cycle28', dateISO(2028, 6, 15), 'Decision matrix. 2027-cycle results (Eiffel May, CSC Jun-Jul, MEXT Aug-Sep) vs 2028 arrivals.'),
  T('Student visa application for chosen country', 'documents', 'critical', 'Cycle28', dateISO(2028, 7, 15), 'Financial proof, medical, police clearance, admission letter. Start the week the offer is accepted.'),
  T('MEXT interview prep begins', 'scholarship', 'high', 'Outreach', dateISO(2027, 3, 16), '5-min research plan explanation, why Japan, career goals, BD contribution. Formal dress.'),
  T('Spring midterms - academic focus', 'academic', 'high', 'Outreach', dateISO(2027, 3, 20), 'Second-to-last semester. Aggressive revision.'),

  // ---- APR 2027: Applications + paper 2 ----
  T('Follow up Japanese professors who responded positively', 'outreach', 'high', 'Outreach', dateISO(2027, 4, 2), '10-min video presentation of robot project. Offer video call. Reference MEXT timeline.'),
  T('Journal full draft: all sections + supervisor review round', 'research', 'high', 'Outreach', dateISO(2027, 2, 24), 'Cite ICECE/ICCIT submitted papers as prior work. Supervisor red-pen pass before submission.'),
  T('Submit journal: IROS 2027 or alternate robotics journal', 'research', 'critical', 'Outreach', dateISO(2027, 3, 5), 'Verify exact deadline + track at venue site first (IROS usually early March). Fallback: alternate robotics journal, same week.'),
  T('Finalise SOP for all country variants + native proofread', 'documents', 'high', 'Outreach', dateISO(2027, 4, 10), '4 variants, 800-1,200 words each.'),
  T('University application documents: master folder', 'documents', 'medium', 'Outreach', dateISO(2027, 4, 15), 'Transcripts, Research Plan, SOP, CV, Rec Letters, Awards, Publications.'),
  T('GKS document screening - await notification', 'scholarship', 'medium', 'Cycle28', dateISO(2028, 4, 22), 'Notified within 4-6 weeks. Prepare for interview or additional docs.'),
  T('Prepare 10-min robot video presentation', 'outreach', 'medium', 'Outreach', dateISO(2027, 4, 28), 'For video calls with interested professors.'),

  // ---- MAY 2027: Finals + interviews ----
  T('Spring finals prep - academic focus', 'academic', 'high', 'Interviews', dateISO(2027, 5, 5), 'Penultimate semester finals. Important for CGPA.'),
  T('Spring final exams', 'academic', 'critical', 'Interviews', dateISO(2027, 5, 12), 'Fight for maximum GPA. Backlog retake grades replace 0.00.'),
  T('MEXT Embassy interview (if shortlisted)', 'scholarship', 'critical', 'Interviews', dateISO(2027, 5, 18), 'Formal dress. Original documents. Know your Research Plan by heart.'),
  T('Video calls with interested professors', 'outreach', 'high', 'Interviews', dateISO(2027, 5, 22), '10-min presentation. "What would you want me to work on?"'),
  T('Update all application docs with Spring 2027 grades', 'documents', 'medium', 'Interviews', dateISO(2027, 5, 26), 'New CGPA, publications, updated CV.'),
  T('Goethe A2 German exam prep + book', 'language', 'low', 'Interviews', dateISO(2027, 5, 29), 'A2 certificate shows commitment to Germany.'),
  T('Book IELTS slot (British Council, fills 6-8 weeks ahead)', 'language', 'high', 'Interviews', dateISO(2027, 6, 15), 'Academic module (not General). August exam target 7.0-7.5.'),
  T('IELTS intensive block: 2h/day mocks + Writing Task 2 + Speaking', 'language', 'high', 'Interviews', dateISO(2027, 6, 30), 'May-Jun intensive. Cambridge 15-18 series. Writing/Speaking band-6 caps are the enemy.'),

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
  T('Canada final outreach - aggressive follow-up', 'outreach', 'medium', 'Interviews', dateISO(2027, 7, 12), 'NSERC RA angle + submitted papers. No Mitacs (BD ineligible).'),
  T('Prepare all US application documents', 'documents', 'high', 'Interviews', dateISO(2027, 7, 16), 'GRE decision (skip for EU/Asia). Finalise SOP, CV, 3 rec letters, transcripts.'),
  T('JLPT N5 exam (Dhaka, Dec 6)', 'language', 'medium', 'Submit', dateISO(2026, 12, 6), 'JUAAB Dhaka. 30 min/day prep from now. Soft signal to every Japanese professor.'),
  T('Final semester academic maximum effort', 'academic', 'high', 'Interviews', dateISO(2027, 7, 24), 'Attend every class, lab, tutorial. Ask for feedback early.'),

  // ---- AUG 2027: Germany + US portals ----
  T('Submit 2-3 German university applications (WS 2028)', 'scholarship', 'critical', 'Interviews', dateISO(2027, 8, 3), 'H-BRS priority. TU Berlin, RPTU, TU Hamburg. Full docs + motivation letter.'),
  T('Thesis v2: freeze novel upgrade scope (same robot + upgrades)', 'research', 'high', 'Interviews', dateISO(2027, 9, 1), 'Academic thesis on the v2 robot. Scope locked with supervisor before final-semester load peaks.'),
  T('Thesis v2 manuscript complete', 'research', 'critical', 'AppsGrad', dateISO(2027, 11, 25), 'Full thesis ready ahead of graduation; 2028 journal submission prep starts immediately after.'),
  T('DAAD EPOS motivation letter — H-BRS Autonomous Systems', 'scholarship', 'high', 'Interviews', dateISO(2027, 8, 8), 'Emphasise professional experience + development impact. Verify exact course deadline (typically Aug-Oct).'),
  T('Create US university portal accounts + upload docs', 'documents', 'medium', 'Interviews', dateISO(2027, 8, 12), 'Portals open Aug-Sep. Upload early. Do not wait for deadlines.'),
  T('Confirm publication status of both papers - update CV', 'documents', 'medium', 'Interviews', dateISO(2027, 8, 18), '"Published" strongest. "Under review" still good. Update everywhere.'),
  T('Final semester: continue maximum academic effort', 'academic', 'high', 'Interviews', dateISO(2027, 8, 24), 'Your final CGPA is being decided this semester.'),

  // ---- SEP 2027: US batch 1 + DAAD + midterms ----
  T('US professors: final pre-application email', 'outreach', 'high', 'AppsGrad', dateISO(2027, 9, 2), '"My application is coming in October/November. My paper [title] is now [status]."'),
  T('Submit WPI MS Robotics application', 'scholarship', 'critical', 'AppsGrad', dateISO(2027, 9, 6), 'SOP, CV, transcripts, 3 rec letters. Confirm recommenders submitted. WPI + Oregon State only.'),
  T('Submit DAAD EPOS application (H-BRS MSc Autonomous Systems)', 'scholarship', 'critical', 'AppsGrad', dateISO(2027, 10, 25), 'Verify exact course deadline first (typically Aug-Oct). Lead with: 2+ years work experience, robotics achievements, international experience.'),
  T('Submit Canada apps (Concordia, Manitoba MASc)', 'scholarship', 'high', 'AppsGrad', dateISO(2027, 9, 14), 'Thesis-based MASc with NSERC RA angle. Follow up professors immediately after applying.'),
  T('Final semester midterms - academic focus', 'academic', 'high', 'AppsGrad', dateISO(2027, 9, 18), 'Last midterms ever. Give everything.'),
  T('Final semester midterm exams', 'academic', 'critical', 'AppsGrad', dateISO(2027, 9, 24), 'Backlog course grade replaces 0.00 - calculate exact CGPA impact.'),

  // ---- OCT 2027: US remaining + graduation docs ----
  T('Submit Oregon State field robotics application', 'scholarship', 'critical', 'AppsGrad', dateISO(2027, 10, 2), 'Precision-ag angle + family farm narrative. Professor relationship = higher success rate. Only if paper accepted.'),
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
  { goal: 'Submit Paper #1 to an IEEE-indexed conference', by: 'October 2026', status: 'done' },
  { goal: 'Convert ICECE (Nov 1) + ICCIT decisions into SOP/CV/professor updates', by: 'December 2026', status: 'active' },
  { goal: 'Journal submitted (IROS 2027 or robotics journal)', by: 'March 2027', status: 'active' },
  { goal: 'Thesis v2 complete, journal submission ASAP in 2028', by: '2028', status: 'active' },
  { goal: 'IELTS 7.0+ (background Oct-Apr + intensive May-Jun, book slot June)', by: 'August 2027', status: 'active' },
  { goal: 'CGPA recovery to 3.0+ with strong upward trend', by: 'December 2027', status: 'active' },
  { goal: '25+ professor/research contacts', by: 'March 2027', status: 'active' },
  { goal: 'MEXT + CSC + Eiffel submitted (2027 cycle)', by: 'May 2027', status: 'active' },
  { goal: 'GKS + Taiwan MOE + MIS + Turkiye submitted (2028 cycle, IELTS-armed)', by: 'April 2028', status: 'active' },
];

const SUMMARY = 'Two-cycle strategy v2 (Oct 2026, rebased from the August 2026 restart). 2027 cycle runs IELTS-free via MOI certificate (Nov 2026): MEXT Embassy Apr 2027, CSC China Jan 2027, Eiffel Jan 2027, PoliTo/Portugal/Italy/Germany-direct. 2028 cycle opens with IELTS 7.0+ (Aug 2027 exam; background Oct-Apr, intensive May-Jun): GKS, DAAD EPOS, MIS, NTU, Taiwan MOE, Canada, USA. Two conference papers already submitted with supervisor co-author (ICECE + ICCIT 2026, decisions from Nov 1) - track results and convert acceptances into SOP/CV/professor updates. Journal campaign: 3 members review 1 paper/week till Nov 2026 (10+ papers), methodologies frozen before finals, hardware experiments in Dec 2026 break, manuscript Jan-Feb 2027, journal submitted ~Mar 2027. Thesis v2 (novel upgrades, same robot) due Dec 2027, journal submission ASAP in 2028. Oct-Dec 2026: Spring finals prep + 7-day prep leave, Chevening decision pending, SOP/CV/recommendation letters (ask referees now, not during finals). Rhythm is time-varying: strict weekly rhythm until finals ~Nov 15, then prep-leave/academic-full rhythm, then ~1mo post-finals research break, then new semester routine TBD. Professor outreach Jan-Mar 2027. Graduation Dec 2027, fully-funded offer target 2028 intake.';

module.exports = { PHASES, DEADLINES, MILESTONES, TASKS, GOALS, SUMMARY };
