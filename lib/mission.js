// Mission tracker seed data extracted from the Mission Control dashboard
// (masters_mission_control_v2.jsx). Scholarship / university / professor /
// CGPA / notes collections.

const SCHOLARSHIPS = [
  { name: 'MEXT Embassy Track', country: 'Japan', deadline: '2027-05-31', cgpaReq: 'No hard cutoff (holistic)', status: 'Research', priority: 'A', coverage: 'Full Tuition + ~¥144,000/month + Airfare', docs: 'Research Plan (critical), Transcripts, IELTS, Health Certificate, 2 Rec Letters, Application Form', notes: 'Apply through Bangladesh Embassy of Japan. Research Plan is the #1 document. Professor connection dramatically boosts chance.', url: 'https://www.studyinjapan.go.jp/en/' },
  { name: 'MEXT University Recommendation', country: 'Japan', deadline: '2027-06-01', cgpaReq: 'Professor endorsement is key', status: 'Planning', priority: 'A', coverage: 'Same as Embassy MEXT', docs: 'Professor Acceptance Letter, Research Plan, Transcripts, IELTS', notes: 'Requires a Japanese professor to nominate you first. Launch professor emails January 2027. Faster & more prestigious track.', url: 'https://www.studyinjapan.go.jp/en/' },
  { name: 'GKS / KGSP Graduate', country: 'South Korea', deadline: '2027-04-01', cgpaReq: '2.64 min - YOU QUALIFY NOW', status: 'Research', priority: 'A', coverage: 'Full Tuition + ~KRW 900,000/month + Airfare + 1yr Korean language', docs: 'Application Form, Transcripts, Study Plan, 2 Rec Letters, Awards Proof, Bank Statement', notes: 'RARE: you meet the GPA minimum right now. Strong achievements give you the edge. HIGH PRIORITY.', url: 'https://www.niied.go.kr' },
  { name: 'DAAD Helmut-Schmidt', country: 'Germany', deadline: '2027-10-01', cgpaReq: 'Above-average + work experience', status: 'Planning', priority: 'A', coverage: '€934/month + Health Insurance + Travel Allowance', docs: 'Degree Certificate, Transcripts, Motivation Letter, CV, 2 Rec Letters, Work Certificate', notes: 'Apply AFTER graduation Dec 2027. Values professional experience. 2yr corporate + business turnaround = key asset.', url: 'https://www.daad.de' },
  { name: 'DAAD Development-Related Courses', country: 'Germany', deadline: '2027-08-15', cgpaReq: 'Above-average + work experience (holistic)', status: 'Research', priority: 'B', coverage: 'Full Tuition + €1,200/month + insurance + travel', docs: 'Degree Certificate, Transcripts, Motivation Letter, CV, Work Proof, 2 Rec Letters', notes: 'Distinct from Helmut-Schmidt. Robotics for agriculture/infrastructure qualifies. 15-25% probability.', url: 'https://www.daad.de/en/study-and-research-in-germany/scholarships/' },
  { name: 'MOE Taiwan Scholarship', country: 'Taiwan', deadline: '2027-03-15', cgpaReq: '3.0/4.0 equivalent', status: 'Research', priority: 'A', coverage: 'Full Tuition + NT$15,000-25,000/month allowance', docs: 'Transcripts, SOP, 2 Rec Letters, Health Certificate, Financial Docs', notes: 'UNDERRATED: less Bangladesh competition vs Japan/Korea. 30-45% probability. NTUST, NTHU, NTU.', url: 'https://www.scholarship.moe.gov.tw' },
  { name: 'Australia Awards (AAS)', country: 'Australia', deadline: '2027-04-30', cgpaReq: 'Holistic - leadership over GPA', status: 'Research', priority: 'B', coverage: 'Full Tuition + ~AUD 27,000/yr + Airfare + Health Insurance', docs: 'Transcripts, 3 Essays, 2 Professional References, Leadership Evidence', notes: 'CAUTION: 2-year return to BD required. Frame robotics -> BD agricultural/disaster monitoring.', url: 'https://www.dfat.gov.au/australia-awards' },
  { name: 'Chevening UK', country: 'United Kingdom', deadline: '2026-11-01', cgpaReq: 'Leadership-focused, no hard GPA cutoff', status: 'Planning', priority: 'C', coverage: 'Full Tuition + £1,236/month', docs: '4 Essays (500 words each), 2 References, 2yr Work Experience', notes: 'Long shot - spend 10 quality hours on essays max. Leadership impact + networking plan.', url: 'https://www.chevening.org' },
  { name: 'Professor RA (Multi-Country)', country: 'Multiple', deadline: '2027-09-01', cgpaReq: 'None - professor decides', status: 'Research', priority: 'A', coverage: 'Full Tuition + Stipend (varies by country/lab)', docs: 'Research Pitch Email, CV, GitHub Portfolio, Paper(s), Video Demo', notes: '30-50% probability (professor-dependent). HIGHEST flexibility. ROS2+SLAM stack is the key asset.', url: '' },
  { name: 'Politecnico di Torino Internal', country: 'Italy', deadline: '2027-09-01', cgpaReq: '3.0 equivalent (holistic)', status: 'Watching', priority: 'B', coverage: 'Partial tuition waiver + possible living grant', docs: 'Transcripts, SOP, Rec Letters, Language Scores', notes: '20-35% probability. Low Bangladesh competition. MSc Mechatronics. Multiple scholarship cycles/yr.', url: 'https://www.polito.it/en/' },
  { name: 'Erasmus Mundus EMARO+', country: 'Europe', deadline: '2027-12-01', cgpaReq: '3.5+ typical - REACH only', status: 'Watching', priority: 'C', coverage: '€1,400/month + Tuition', docs: 'Transcripts, SOP, 2 References, Language Scores', notes: 'Extremely competitive. Only if CGPA reaches 3.0+ AND paper published. Stretch application.', url: 'https://www.master-emaro.eu' },
];

const UNIVERSITIES = [
  { name: 'Tohoku University', country: 'Japan', dept: 'Grad School of Engineering - Robotics & Mechatronics', scholarship: 'MEXT', status: 'Research', appDeadline: '2027-05-01', priority: 'A', url: 'https://www.tohoku.ac.jp/en/', notes: 'Space Robotics Lab. Very MEXT-friendly. Sendai: affordable. Strong autonomous systems.' },
  { name: 'Nagoya University', country: 'Japan', dept: 'Grad School of Informatics - Intelligent Systems Eng.', scholarship: 'MEXT + RA', status: 'Research', appDeadline: '2027-05-01', priority: 'A', url: 'https://www.nagoya-u.ac.jp/en/', notes: 'Core target. Prof Yuichi Kobayashi: mobile robots, sensor fusion - strong cold-email match.' },
  { name: 'Ritsumeikan University', country: 'Japan', dept: 'Grad School of Science & Engineering', scholarship: 'MEXT', status: 'Research', appDeadline: '2027-05-01', priority: 'A', url: 'https://en.ritsumei.ac.jp/', notes: 'Core target. Medium competition, more accessible than Tokyo/Osaka. Known for robotics.' },
  { name: 'JAIST', country: 'Japan', dept: 'School of Information Science - Robotics & Cognition', scholarship: 'MEXT', status: 'Research', appDeadline: '2027-05-01', priority: 'A', url: 'https://www.jaist.ac.jp/english/', notes: 'Fully English-medium. Welcomes non-traditional profiles. Smaller, personal campus.' },
  { name: 'Osaka University', country: 'Japan', dept: 'Grad School of Eng. - Intelligent Robotics Lab', scholarship: 'MEXT Univ. Rec.', status: 'Research', appDeadline: '2027-06-01', priority: 'B', url: 'https://www.osaka-u.ac.jp/en', notes: 'Ishiguro Lab: world-leading. Very competitive. Only realistic with strong professor connection.' },
  { name: 'Kyushu University', country: 'Japan', dept: 'Grad School of Engineering', scholarship: 'MEXT', status: 'Research', appDeadline: '2027-05-01', priority: 'B', url: 'https://www.kyushu-u.ac.jp/en/', notes: 'Safe target. Strong engineering school, less competition than Tokyo/Osaka.' },
  { name: 'KAIST', country: 'South Korea', dept: 'Dept. of Mechanical Engineering or EE - Robotics', scholarship: 'GKS', status: 'Research', appDeadline: '2027-04-01', priority: 'A', url: 'https://www.kaist.ac.kr/en/', notes: 'Top 5 engineering school in Asia. World-class autonomous systems research.' },
  { name: 'Sungkyunkwan University (SKKU)', country: 'South Korea', dept: 'School of Mechanical Engineering - Robotics', scholarship: 'GKS', status: 'Research', appDeadline: '2027-04-01', priority: 'A', url: 'https://www.skku.edu/eng/', notes: 'Core target. Strong Samsung partnership. Robotics and autonomous systems faculty.' },
  { name: 'Hanyang University', country: 'South Korea', dept: 'Dept of Robotics / Electrical Engineering', scholarship: 'GKS + RA', status: 'Research', appDeadline: '2027-04-01', priority: 'A', url: 'https://www.hanyang.ac.kr/web/eng', notes: 'Core target. GKS + RA possible. Strong robotics dept, both Seoul and ERICA campuses.' },
  { name: 'POSTECH', country: 'South Korea', dept: 'Dept. of Mechanical Engineering - Robotics', scholarship: 'GKS', status: 'Research', appDeadline: '2027-04-01', priority: 'B', url: 'https://www.postech.ac.kr/eng/', notes: 'Smaller, focused research university. Strong smart manufacturing + robotics.' },
  { name: 'Pusan National University', country: 'South Korea', dept: 'Robot Engineering', scholarship: 'GKS', status: 'Research', appDeadline: '2027-04-01', priority: 'B', url: 'https://www.pusan.ac.kr/eng/', notes: 'Safe target. Dedicated Robot Engineering dept - rare. Lower competition than KAIST/SKKU.' },
  { name: 'Chonnam National University', country: 'South Korea', dept: 'Robotics Engineering', scholarship: 'GKS', status: 'Research', appDeadline: '2027-04-01', priority: 'B', url: 'https://www.jnu.ac.kr/eng/', notes: 'Safe target. Dedicated Robotics Engineering program. Good safety net.' },
  { name: 'H-BRS (Hochschule Bonn-Rhein-Sieg)', country: 'Germany', dept: 'MSc Autonomous Systems', scholarship: 'DAAD Helmut-Schmidt', status: 'Research', appDeadline: '2027-10-01', priority: 'A', url: 'https://www.h-brs.de/en', notes: 'DAAD-partnered. English-medium. Designed for international students with work experience. PRIORITY.' },
  { name: 'TU Berlin', country: 'Germany', dept: 'MSc Computer Engineering (Robotics track)', scholarship: 'DAAD', status: 'Research', appDeadline: '2027-07-15', priority: 'B', url: 'https://www.tu.berlin/en/', notes: 'English-medium. Free tuition. Berlin tech hub. No hard GPA cutoff for admission.' },
  { name: 'TU Hamburg', country: 'Germany', dept: 'MSc Mechatronics', scholarship: 'RA / DAAD', status: 'Research', appDeadline: '2027-07-15', priority: 'B', url: 'https://www.tuhh.de/tuhh/en/', notes: 'Core target. Medium competition. Industrial robotics in Hamburg port-city ecosystem. Free tuition.' },
  { name: 'NTUST', country: 'Taiwan', dept: 'MSc Mechanical Engineering / EE', scholarship: 'MOE Taiwan', status: 'Research', appDeadline: '2027-03-15', priority: 'A', url: 'https://www.ntust.edu.tw/home.php', notes: 'Core target. MOE Taiwan eligible. Strong manufacturing + robotics. Taipei tech hub.' },
  { name: 'NTHU (National Tsing Hua)', country: 'Taiwan', dept: 'MSc Power Mechanical Engineering', scholarship: 'MOE Taiwan', status: 'Research', appDeadline: '2027-03-15', priority: 'A', url: 'https://www.nthu.edu.tw/', notes: 'Core target. Strong STEM reputation. Hsinchu Science Park = tech connections.' },
  { name: 'Politecnico di Torino', country: 'Italy', dept: 'MSc Mechatronics Engineering', scholarship: 'Internal + Erasmus+', status: 'Research', appDeadline: '2027-09-01', priority: 'B', url: 'https://www.polito.it/en/', notes: 'Low tuition (~€2,700/yr, often waived). Multiple scholarship cycles/yr. Low BD competition.' },
  { name: 'Universita di Bologna', country: 'Italy', dept: 'MSc Robotics Engineering (EMARO+)', scholarship: 'Erasmus+ / Internal', status: 'Watching', appDeadline: '2027-12-01', priority: 'C', url: 'https://www.unibo.it/en/', notes: 'Oldest university in the world. EMARO+ consortium. Very low tuition. Stretch.' },
  { name: 'Concordia University', country: 'Canada', dept: 'MEng / MASc Electrical & Computer Engineering', scholarship: 'RA / OGS', status: 'Research', appDeadline: '2028-01-15', priority: 'B', url: 'https://www.concordia.ca', notes: 'Montreal = AI hub (MILA). Active robotics labs. RA funding via professor.' },
  { name: 'University of Manitoba', country: 'Canada', dept: 'MASc Electrical & Computer Engineering', scholarship: 'RA', status: 'Research', appDeadline: '2028-02-01', priority: 'B', url: 'https://umanitoba.ca', notes: 'Active field robotics lab. Agricultural robotics fits your business background.' },
  { name: 'Worcester Polytechnic Institute (WPI)', country: 'USA', dept: 'MS Robotics Engineering', scholarship: 'RA / TA / Fellowship', status: 'Research', appDeadline: '2028-01-15', priority: 'B', url: 'https://www.wpi.edu', notes: 'One of very few standalone MS Robotics programs. Holistic review. International friendly.' },
  { name: 'Oregon State University', country: 'USA', dept: 'MS ECE (Robotics)', scholarship: 'RA', status: 'Research', appDeadline: '2028-01-01', priority: 'B', url: 'https://oregonstate.edu', notes: 'Strong agricultural/field robotics lab. Precision-ag angle fits your background.' },
  { name: 'University of Queensland (UQ)', country: 'Australia', dept: 'MEng Science - Robotics', scholarship: 'Australia Awards / RTP', status: 'Research', appDeadline: '2027-11-01', priority: 'B', url: 'https://www.uq.edu.au', notes: 'AAS eligible. Agricultural robotics and mining automation focus.' },
  { name: 'Orebro University', country: 'Sweden', dept: 'MSc Robotics and Intelligent Systems', scholarship: 'RA', status: 'Watching', appDeadline: '2028-01-15', priority: 'C', url: 'https://www.oru.se/english/', notes: 'Stretch. AASS lab is world-class (Magnusson, Lilienthal). Tuition risk without scholarship.' },
];

const PROFESSORS = [
  { name: 'Prof. Kazunori Ohno', university: 'Tohoku University', country: 'Japan', field: 'SLAM, Autonomous Navigation, Rescue Robotics', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Strong cold-email match. Mention Kibo competition - JAXA-affiliated recognition.', scholarship: 'MEXT Univ. Rec.', url: 'https://www.rm.is.tohoku.ac.jp/' },
  { name: 'Prof. Kazuya Yoshida', university: 'Tohoku University', country: 'Japan', field: 'Space Robotics, Autonomous Systems', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Kibo challenge highly relevant - Yoshida Lab works on space-grade autonomous systems.', scholarship: 'MEXT Univ. Rec.', url: 'https://www.astro.mech.tohoku.ac.jp/' },
  { name: 'Prof. Yuichi Kobayashi', university: 'Nagoya University', country: 'Japan', field: 'Mobile Robots, Sensor Fusion, Manipulation', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Direct research match: LiDAR+IMU sensor fusion maps well to his research.', scholarship: 'MEXT Univ. Rec.', url: '' },
  { name: '', university: 'JAIST', country: 'Japan', field: 'Robotics & Cognition / Sensor Fusion', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Fully English-medium. Welcoming to non-traditional profiles.', scholarship: 'MEXT Univ. Rec.', url: 'https://www.jaist.ac.jp/english/' },
  { name: '', university: 'Osaka University', country: 'Japan', field: 'Intelligent Robotics / Humanoid Systems', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Ishiguro Lab: world-leading. Need a very strong research pitch.', scholarship: 'MEXT Univ. Rec.', url: 'https://www.osaka-u.ac.jp/en' },
  { name: '', university: 'NAIST', country: 'Japan', field: 'Computer Vision / SLAM / Autonomous Navigation', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Strong in vision-based SLAM. English programs. Good MEXT eligibility.', scholarship: 'MEXT Univ. Rec.', url: '' },
  { name: 'Prof. Hyun Myung', university: 'KAIST', country: 'South Korea', field: 'SLAM, LiDAR Mapping, Autonomous Systems', status: 'To Contact', email: '', contacted: '', response: '', notes: 'World-leading SLAM researcher. Very competitive. Only email after paper is accepted.', scholarship: 'GKS / RA', url: 'https://urobot.kaist.ac.kr/' },
  { name: '', university: 'POSTECH', country: 'South Korea', field: 'Smart Manufacturing / Robotics', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Smaller, focused research university. Strong industry connections. GKS eligible.', scholarship: 'GKS', url: 'https://www.postech.ac.kr/eng/' },
  { name: '', university: 'UNIST', country: 'South Korea', field: 'Electrical Engineering / Robotics', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Newer university, aggressive international recruitment, excellent RA funding.', scholarship: 'GKS', url: '' },
  { name: '', university: 'H-BRS', country: 'Germany', field: 'Autonomous Systems / Embedded Robotics', status: 'To Contact', email: '', contacted: '', response: '', notes: 'DAAD Helmut-Schmidt partnered program. Ask about GPA conversion from Bangladesh.', scholarship: 'DAAD', url: 'https://www.h-brs.de/en' },
  { name: '', university: 'TU Berlin', country: 'Germany', field: 'Computer Engineering / Robotics', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Free tuition. English-medium MSc. Ask about WS 2028 intake.', scholarship: 'DAAD', url: 'https://www.tu.berlin/en/' },
  { name: 'Prof. Cyrill Stachniss', university: 'University of Bonn', country: 'Germany', field: 'SLAM, Probabilistic Robotics (world-leading)', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Very competitive. Only approach after paper accepted. Reference his exact papers.', scholarship: 'RA / DAAD', url: 'https://www.ipb.uni-bonn.de/' },
  { name: 'Prof. Wolfram Burgard', university: 'TU Nuremberg', country: 'Germany', field: 'Probabilistic Robotics, SLAM', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Pioneer of probabilistic robotics. Specific, deep pitch only.', scholarship: 'RA', url: '' },
  { name: 'Prof. Matteo Matteucci', university: 'Politecnico di Milano', country: 'Italy', field: 'SLAM, Autonomous Vehicles, Computer Vision', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Good cold-email candidate. Research matches your stack. Mention interest in PoliTo too.', scholarship: 'RA / Internal', url: '' },
  { name: 'Prof. Martin Magnusson', university: 'Orebro University', country: 'Sweden', field: 'LiDAR SLAM, 3D Mapping', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Direct LiDAR SLAM match. Note Sweden tuition risk - confirm funding.', scholarship: 'RA', url: 'https://www.oru.se/english/' },
  { name: 'Prof. Achim Lilienthal', university: 'Orebro University', country: 'Sweden', field: 'Autonomous Systems, Gas/Environmental Sensing', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Head of AASS lab. Email both Magnusson and Lilienthal at Orebro.', scholarship: 'RA', url: '' },
  { name: 'Prof. Li-Chen Fu', university: 'National Taiwan University (NTU)', country: 'Taiwan', field: 'Autonomous Mobile Robots, Control Systems', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Taiwan top autonomous robotics researcher. MOE scholarship + professor support.', scholarship: 'MOE Taiwan / RA', url: '' },
  { name: '', university: 'Concordia University', country: 'Canada', field: 'Intelligent Systems / Robotics', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Montreal = AI hub (MILA). RA funding via supervisor. Reference Mitacs.', scholarship: 'RA', url: 'https://www.concordia.ca' },
  { name: '', university: 'University of Manitoba', country: 'Canada', field: 'Field Robotics / ECE', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Active field robotics lab. Agricultural robotics angle fits.', scholarship: 'RA', url: 'https://umanitoba.ca' },
  { name: '', university: 'Oregon State University', country: 'USA', field: 'Agricultural / Field Robotics', status: 'To Contact', email: '', contacted: '', response: '', notes: 'Precision-ag robotics angle. RA available.', scholarship: 'RA', url: 'https://oregonstate.edu' },
];

const CGPA = {
  cgpa: 2.61,
  completedCredits: 70,
  totalDegreeCredits: 151,
  target: 3.2,
  backlogs: [
    { course: 'Digital Electronics', credits: 3, done: false, newGrade: 0 },
    { course: 'Accounting', credits: 2, done: false, newGrade: 0 },
    { course: 'Electronic Circuits II', credits: 3, done: false, newGrade: 0 },
  ],
  futureSems: [],
  notes: 'GKS cutoff 2.64 - you qualify. Backlog grade replacement (8 credits at 0.00) is the biggest CGPA lever. Retakes: Digital Electronics (Aug 2026), Accounting (Jan 2027), Electronic Circuits II (Jul 2027).',
};

const NOTES = [
  {
    title: 'Important Links',
    color: '#f59e0b',
    entries: [
      { title: 'MEXT Application Portal', content: 'https://www.studyinjapan.go.jp/en/\nBangladesh Embassy Japan: https://www.bd.emb-japan.go.jp/itpr_en/index.html' },
      { title: 'GKS Official Site', content: 'https://www.niied.go.kr\nApply via Bangladesh Embassy Seoul.' },
      { title: 'Taiwan MOE Scholarship', content: 'https://www.scholarship.moe.gov.tw' },
      { title: 'DAAD Scholarship', content: 'https://www.daad.de' },
      { title: 'Chevening UK', content: 'https://www.chevening.org' },
      { title: 'Mitacs Globalink', content: 'https://www.mitacs.ca/globalink' },
    ],
  },
  {
    title: 'Email Templates',
    color: '#8b5cf6',
    entries: [
      { title: 'Japan Professor Email Template', content: 'Subject: Prospective MEXT Research Student - Autonomous Robotics\n\nDear Professor [Name],\nI am writing to express strong interest in joining your laboratory as a MEXT research student. I have read your recent paper [title] on [topic], and my ROS2 + LiDAR/IMU SLAM robot project directly connects to it...\n\nAttach: CV, GitHub portfolio, robot demo video link, IEEE award proof.' },
      { title: 'US Professor Email Template', content: 'Subject: Prospective PhD/MS Student - Robotics/Sensor Fusion - Fall 2028\n\nDear Professor [Name],\nI plan to apply to your program formally in September. Before applying, I wanted to confirm you are accepting students for Fall 2028... My paper [title] is [status].' },
    ],
  },
  {
    title: 'Key Contacts',
    color: '#10b981',
    entries: [
      { title: 'UAP Academic Advisor', content: 'For CGPA recovery + retake policy. Meet in August 2026.' },
      { title: 'Golden Power Engineering', content: 'Ex-manager writes professional recommendation letter. Maintain warm relationship now.' },
    ],
  },
  {
    title: 'Research Notes',
    color: '#3b82f6',
    entries: [
      { title: 'Tier Realism & Probability', content: 'Tier 3 (Realistic PRIMARY): Tohoku, Nagoya, Ritsumeikan, Polito, Orebro, Hanyang, SKKU, TU Hamburg, NTUST - 20-40%.\nTier 4 (SAFE): mid-tier KR/JP national, IT, TW, NTHU - 40-65%.\nElite (MIT/ETH/Imperial): <2% - do not apply.\n\nHONEST ODDS:\nPaper accepted + IELTS 7.0 + prof contact -> 60-75%\nIELTS 7.0 but no paper -> 30-45%\nNo paper, no IELTS -> 10-20%\n\nCOUNTRY PRIORITY:\n1. Japan MEXT 25-40% | 2. Korea GKS 15-30% | 3. Germany DAAD 15-30%\n4. Taiwan MOE 30-45% (UNDERRATED) | 5. Italy 10-20% | 6. Sweden RA 10-20%\n\nSkip GRE (not required in Europe/Asia). No generic applications without professor contact first.' },
    ],
  },
];

module.exports = { SCHOLARSHIPS, UNIVERSITIES, PROFESSORS, CGPA, NOTES };
