// lib/__fixtures__/work_mode_fixtures.ts
//
// Centralized fixture library for work_mode scoring tests.
// 5 core user profiles (one per mode), 5 blended crossover profiles,
// 1 weak control (Dingus), and 21 job fixtures covering all modes,
// intensity tiers, false-positive traps, and discriminator traps.

import type { WorkMode } from "../work_mode";

// ─── Types ──────────────────────────────────────────────────

export type UserFixture = {
  name: string;
  expectedMode: WorkMode | null; // null = weak/unclassified
  resumeText: string;
  promptAnswers: Record<number, string>;
};

export type JobFixture = {
  name: string;
  expectedMode: WorkMode | null;
  text: string;
};

// ═══════════════════════════════════════════════════════════
// ─── CORE USER FIXTURES (one per mode) ──────────────────────
// ═══════════════════════════════════════════════════════════

// ─── Chris (Builder / Systems) ──────────────────────────────

export const CHRIS: UserFixture = {
  name: "Chris",
  expectedMode: "builder_systems",
  resumeText:
    "Product Development Manager | 7 years experience in SaaS and B2B\n" +
    "Led product development from market research through launch for enterprise software.\n" +
    "Built systems for evaluating market gaps and customer needs. Created SOPs for product\n" +
    "development workflows. Designed and maintained pitch decks and proposals for executive\n" +
    "stakeholders. Conducted feasibility studies for new product initiatives. Automated\n" +
    "internal workflows and reporting systems. Managed cross-functional product development\n" +
    "teams. Drove go-to-market strategy and customer discovery processes.",
  promptAnswers: {
    1: "design, creating systems, making sop's. building web apps/tools Making pitch decks, call scripts, data miners and customer proposal slide presentations. Creating automated workflows and sharing great tools with coworkers. Marketing and strategy sessions.",
    2: "endless sales cycles, quota driven incentive, jumping from one task to another without real depth or clarity, overall chaos in the company being short staffed and small.",
    3: "design, creating systems, making sop's. Making pitch decks, call scripts, data miners and customer proposal slide presentations. Creating automated workflows and sharing great tools with coworkers. Marketing and strategy sessions.",
    4: "problem solving, product development, customer needs and finding gaps in the market.",
    5: "songwriting, building tools, making graphics, interior design",
  },
};

// ─── Marcus (Sales / Execution) ─────────────────────────────

export const MARCUS: UserFixture = {
  name: "Marcus",
  expectedMode: "sales_execution",
  resumeText:
    "Inside Sales Representative | 5 years in B2B SaaS sales\n" +
    "Quota-carrying Account Executive managing full-cycle sales from prospecting to close.\n" +
    "Consistently exceeded quarterly quota by 120%. Built pipeline through cold calling,\n" +
    "outbound prospecting, and territory management. Managed book of 80+ accounts.\n" +
    "Skilled in objection handling, deal negotiation, and closing. Used Salesforce CRM\n" +
    "daily for pipeline forecasting and revenue tracking. BDR team lead for 6 months.\n" +
    "Experience with commission-based compensation structures and upsell/cross-sell motions.",
  promptAnswers: {
    1: "Closing deals and hitting my number. I love the feeling of winning a new account and the competition of sales.",
    2: "Doing administrative busywork and sitting in long meetings that have nothing to do with selling.",
    3: "People come to me when they need help closing a difficult deal or handling a tough objection.",
    4: "A challenge that excites me is breaking into a brand new territory where nobody knows us yet.",
    5: "I'm best at prospecting, building pipeline, cold calling, and closing new business.",
  },
};

// ─── Priya (Operational / Execution) ────────────────────────

export const PRIYA: UserFixture = {
  name: "Priya",
  expectedMode: "operational_execution",
  resumeText:
    "Operations Coordinator | 4 years in logistics and office management\n" +
    "Managed daily scheduling, procurement, and inventory tracking across 3 warehouse locations.\n" +
    "Handled administrative coordination including payroll processing, invoicing, and data entry.\n" +
    "Organized onboarding logistics for 50+ new hires annually. Maintained ERP system records\n" +
    "and resolved customer support tickets. Processed 200+ orders weekly with accuracy tracking.\n" +
    "Coordinated dispatch schedules and managed vendor procurement relationships.",
  promptAnswers: {
    1: "Keeping everything organized and running smoothly. I love when the schedule is tight and nothing falls through the cracks.",
    2: "Open-ended creative projects with no clear deliverables or timelines drain me.",
    3: "People ask me to coordinate logistics, handle scheduling conflicts, and sort out procurement issues.",
    4: "A challenge that excites me is streamlining a messy process into a clean, repeatable workflow.",
    5: "I'm best at scheduling, coordination, inventory management, and keeping operations on track.",
  },
};

// ─── Fabio (Analytical / Investigative) ─────────────────────

export const FABIO: UserFixture = {
  name: "Fabio",
  expectedMode: "analytical_investigative",
  resumeText:
    "Fabio Bellini Keizer, Oregon Professional Summary As an OSOC Security Analyst and dedicated cybersecurity professional, " +
    "I specialize in penetration testing, vulnerability assessment, and security risk mitigation. " +
    "I bring a strong focus on protecting organizational assets through the design and implementation of comprehensive security measures. " +
    "With hands-on experience in tools such as Kali Linux, Active Directory, and Python, I'm proficient in red team operations and network security auditing. " +
    "My background includes serving as an assistant instructor, mentoring students through practical cybersecurity training programs.",
  promptAnswers: {
    1: "The part that felt most like me was investigating problems, connecting technical details, and turning them into something clear and actionable.",
    2: "What drained me fastest was repetitive work that required a lot of manual effort but did not involve much analysis, problem-solving, or improvement.",
    3: "People often come to me to help make sense of technical situations, especially when something is unclear, urgent, or needs to be explained well.",
    4: "I find complex challenges exciting when they require investigation, critical thinking, and a structured approach.",
    5: "I am best at work that sits at the intersection of analysis, problem-solving, and communication.",
  },
};

// ─── Luna (Creative / Ideation) ─────────────────────────────

export const LUNA: UserFixture = {
  name: "Luna",
  expectedMode: "creative_ideation",
  resumeText:
    "Creative Director | 8 years in brand strategy and content creation\n" +
    "Led creative direction for brand campaigns across digital and print channels.\n" +
    "Developed visual design systems, brand guidelines, and storytelling frameworks.\n" +
    "Managed ideation workshops and concept development for product launches.\n" +
    "Created content strategy for social media, email, and marketing creative.\n" +
    "Art direction for photo shoots and video production. Graphic design background\n" +
    "with UX design experience. Pioneered design thinking methodology for the team.",
  promptAnswers: {
    1: "Coming up with the creative brief and seeing an idea go from concept to something real that moves people.",
    2: "Repetitive execution work where there's no room for creative input or ideation.",
    3: "People come to me for creative direction, branding decisions, and when they need a compelling visual concept.",
    4: "A challenge that excites me is building a brand identity from scratch using storytelling and visual design.",
    5: "I'm best at creative direction, content creation, branding, visual design, and concept development.",
  },
};

// ═══════════════════════════════════════════════════════════
// ─── BLENDED USER FIXTURES (crossover profiles) ─────────────
// ═══════════════════════════════════════════════════════════

// ─── Alex (Builder + Analytical) ────────────────────────────
// DevSecOps — strong systems signals with security/analysis overlay

export const ALEX: UserFixture = {
  name: "Alex",
  expectedMode: "builder_systems", // builder signals dominate
  resumeText:
    "DevSecOps Engineer | 6 years in infrastructure and security\n" +
    "Designed and deployed CI/CD pipelines and automated infrastructure provisioning.\n" +
    "Built security scanning tools integrated into the deployment workflow.\n" +
    "Conducted vulnerability assessments on production systems.\n" +
    "Implemented monitoring and incident investigation processes.\n" +
    "Full-stack engineering background with platform architecture focus.",
  promptAnswers: {
    1: "Building automated systems and investigating security problems. I like the blend of creating things and analyzing threats.",
    2: "Routine operational tasks with no engineering challenge.",
    3: "People come to me for infrastructure architecture and when something breaks and needs root cause analysis.",
    4: "Designing a resilient system that can withstand sophisticated attack vectors.",
    5: "I'm best at automation, infrastructure, security analysis, and building integrated platforms.",
  },
};

// ─── Dana (Sales + Ops) ────────────────────────────────────
// Account manager who splits time between selling and operations

export const DANA: UserFixture = {
  name: "Dana",
  expectedMode: "sales_execution", // sales signals stronger
  resumeText:
    "Account Manager | 4 years in B2B sales and customer operations\n" +
    "Managed a territory of 60 accounts with quota for upsell and cross-sell.\n" +
    "Handled order processing, invoicing, and contract coordination.\n" +
    "Cold called new prospects and built pipeline through outbound prospecting.\n" +
    "Coordinated onboarding logistics for new customers. Tracked inventory\n" +
    "allocations and managed scheduling for account reviews.",
  promptAnswers: {
    1: "Closing deals and keeping my accounts happy. I enjoy the mix of selling and making sure the logistics work.",
    2: "Pure data entry or filing with no client interaction.",
    3: "People ask me to help close tough deals and also to sort out order processing issues.",
    4: "Breaking into a new account that everyone said was impossible to win.",
    5: "I'm best at prospecting, closing new business, coordinating deliveries, and managing client relationships.",
  },
};

// ─── Rio (Creative + Builder) ──────────────────────────────
// Product designer who bridges creative and systems thinking

export const RIO: UserFixture = {
  name: "Rio",
  expectedMode: "creative_ideation", // creative signals stronger
  resumeText:
    "Product Designer | 5 years in UX design and product development\n" +
    "Led UX design for SaaS products, creating visual design systems and prototypes.\n" +
    "Built front-end components and integrated design into the development workflow.\n" +
    "Conducted concept development workshops and ideation sessions with stakeholders.\n" +
    "Created content strategy for product onboarding. Art direction for marketing creative.\n" +
    "Graphic design for brand campaigns with storytelling through interactive experiences.",
  promptAnswers: {
    1: "Designing user experiences and prototyping ideas. I love the space between creative concepting and building the real thing.",
    2: "Pure backend engineering with no user-facing design component.",
    3: "People come to me for visual design decisions and when they need a UX prototype fast.",
    4: "Reimagining a product experience from scratch with both creative and engineering constraints.",
    5: "I'm best at UX design, prototyping, visual design, ideation, and content creation.",
  },
};

// ─── Nadia (Analytical + Creative) ─────────────────────────
// UX researcher blending investigation with creative outputs

export const NADIA: UserFixture = {
  name: "Nadia",
  expectedMode: "analytical_investigative", // analytical signals stronger
  resumeText:
    "UX Researcher | 5 years in user research and data analysis\n" +
    "Conducted investigative research studies analyzing user behavior patterns.\n" +
    "Performed statistical analysis on A/B tests and usability assessments.\n" +
    "Built research insight frameworks and diagnostic models for product teams.\n" +
    "Created content strategy deliverables from research findings.\n" +
    "Managed branding research and campaign effectiveness analysis.",
  promptAnswers: {
    1: "Investigating user problems and turning research data into actionable insights.",
    2: "Repetitive administrative coordination with no analytical component.",
    3: "People come to me when they need to analyze a problem and understand root causes before making design decisions.",
    4: "A challenge that excites me is conducting a deep investigation into why users behave a certain way.",
    5: "I'm best at research, analysis, investigation, insight generation, and translating data into visual storytelling.",
  },
};

// ─── Tomas (Ops + Sales) ───────────────────────────────────
// Customer success manager blending ops coordination with sales motions

export const TOMAS: UserFixture = {
  name: "Tomas",
  expectedMode: "operational_execution", // ops signals stronger
  resumeText:
    "Customer Success Manager | 4 years in customer operations and account management\n" +
    "Coordinated onboarding logistics and scheduling for 100+ enterprise accounts.\n" +
    "Managed customer support escalations and help desk ticketing workflows.\n" +
    "Handled procurement coordination, invoicing, and order processing.\n" +
    "Conducted quarterly business reviews with upsell recommendations.\n" +
    "Administrative management of CRM data entry and filing documentation.",
  promptAnswers: {
    1: "Keeping accounts organized and making sure onboarding runs smoothly. I like being the person who keeps everything on track.",
    2: "Cold calling strangers and high-pressure quota environments.",
    3: "People come to me for scheduling help, resolving support tickets, and coordinating deliverables across teams.",
    4: "Turning a chaotic onboarding process into a repeatable, organized system.",
    5: "I'm best at coordination, scheduling, customer support, data management, and onboarding logistics.",
  },
};

// ═══════════════════════════════════════════════════════════
// ─── WEAK CONTROL FIXTURE ───────────────────────────────────
// Dingus is the weak-control anchor: minimal professional depth,
// no strong domain signal. However the current classifier resolves
// operational_execution from customer-service / scheduling /
// organizing language — this is expected and correct.
// expectedMode remains null to mark the fixture's *intended*
// regression role (low signal density control). Tests should
// assert the actual classified mode (operational_execution)
// rather than assuming null passthrough.
// ═══════════════════════════════════════════════════════════

export const DINGUS: UserFixture = {
  name: "Dingus",
  expectedMode: null, // regression role: weak-control anchor (classifier resolves operational_execution in practice)
  resumeText:
    "Customer Service Associate\n\n" +
    "Responsible for assisting customers with questions and purchases. Handled daily store operations " +
    "including stocking shelves, answering phones, and assisting with general tasks around the store.\n\n" +
    "Occasionally helped with scheduling shifts and organizing paperwork. Assisted team members when " +
    "needed and supported day-to-day store activities.\n\n" +
    "Experience using Microsoft Word and Excel. Strong team player and dependable worker who enjoys " +
    "helping customers and working with others.",
  promptAnswers: {
    1: "Helping customers and working with coworkers. I like being part of a team and getting tasks done together.",
    2: "Doing the same repetitive tasks for long periods of time without much variety.",
    3: "Usually people ask me to help when they need an extra hand with something or when they need help talking to customers.",
    4: "Learning new things and figuring out how to do something better than before.",
    5: "Talking to people, staying organized, and helping wherever I'm needed.",
  },
};

// ─── Jen (Operational / Enablement — legacy canonical) ──────
// Jen's resume blends sales and ops vocabulary, but the classifier
// resolves operational_execution from customer service, coordination,
// and management signals. Her primary regression role is validating
// blended-profile behavior: compatible with ops jobs, adjacent to
// sales, and not misclassified as builder_systems.
// expectedMode remains null to preserve the legacy blended-anchor
// contract. Tests should assert the actual classified mode
// (operational_execution) rather than assuming null.

export const JEN: UserFixture = {
  name: "Jen",
  expectedMode: null, // regression role: blended anchor (classifier resolves operational_execution in practice)
  resumeText:
    "Summary Self-motivated go-getter with over 10 years of experience in sales. Known for exceptional customer service " +
    "and executing sales strategies that produce results. Experience Gracer-West Holdings Salem OR Estate Manager " +
    "Maintained and managed a large household and complex of upscale properties for a private client. " +
    "Role included accounting managing staff coordinating events overseeing new projects and setting up a successful rental property. " +
    "SOYOUU LLC Keizer OR Owner Operated a successful college textbook business for 10 years. " +
    "Skills Customer service Communication skills Computer literacy Leadership Outside Sales Analytical Thinking",
  promptAnswers: {
    1: "I think the interaction with people felt the most like me. I enjoyed managing a team and achieving objectives together.",
    2: "The part that drained me the fastest was dealing with excess material waste.",
    3: "My job title is pretty flexible so that could be a lot of things. To be specific I would say ad hoc tasks that aren't part of my daily routine.",
    4: "A challenge that feels exciting is learning a new tool or taking on unfamiliar tasks.",
    5: "I'm best at relationship and team building, taking on new projects, learning new tools, entrepreneurship.",
  },
};

// ═══════════════════════════════════════════════════════════
// ─── JOB FIXTURES ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

// ─── builder_systems ────────────────────────────────────────

export const SYSTEMS_PRODUCT_JOB: JobFixture = {
  name: "Systems/Product PDM",
  expectedMode: "builder_systems",
  text:
    "Product Development Manager\n" +
    "We are seeking a Product Development Manager to lead our product engineering and systems architecture efforts.\n" +
    "Responsibilities:\n" +
    "- Lead product development from concept through launch\n" +
    "- Design and implement scalable systems and infrastructure\n" +
    "- Create SOPs and workflow automation for development teams\n" +
    "- Build internal tools and integrate third-party platforms\n" +
    "- Define product roadmap and manage sprint planning\n" +
    "- Work with cross-functional stakeholders on technical architecture\n" +
    "- Deploy and monitor production systems\n" +
    "Requirements:\n" +
    "- 5+ years product development or engineering experience\n" +
    "- Experience with agile/scrum methodology\n" +
    "- Strong systems design and integration skills\n" +
    "- Track record of building and shipping software products",
};

export const DEVOPS_ENGINEER_JOB: JobFixture = {
  name: "DevOps Engineer",
  expectedMode: "builder_systems",
  text:
    "DevOps Engineer\n" +
    "We are looking for a DevOps Engineer to build and maintain our CI/CD infrastructure.\n" +
    "Responsibilities:\n" +
    "- Design and implement CI/CD pipelines for automated deployment\n" +
    "- Build infrastructure automation using Terraform and Ansible\n" +
    "- Architect scalable platform systems on AWS\n" +
    "- Integrate monitoring and alerting into the deployment workflow\n" +
    "- Create SOPs for incident response and system recovery\n" +
    "- Develop internal engineering tools and workflow automation\n" +
    "Requirements:\n" +
    "- 4+ years DevOps or infrastructure engineering experience\n" +
    "- Experience with software deployment and platform architecture\n" +
    "- Strong systems design and automation skills",
};

export const FULLSTACK_ENGINEER_JOB: JobFixture = {
  name: "Full-Stack Engineer",
  expectedMode: "builder_systems",
  text:
    "Full-Stack Software Engineer\n" +
    "Join our engineering team to build and ship product features.\n" +
    "Responsibilities:\n" +
    "- Build full-stack web applications using modern frameworks\n" +
    "- Design backend architecture and implement REST APIs\n" +
    "- Deploy applications to production with CI/CD\n" +
    "- Prototype new features and iterate from MVP to production\n" +
    "- Integrate third-party services and platform components\n" +
    "Requirements:\n" +
    "- 3+ years software engineering experience\n" +
    "- Frontend and backend development skills\n" +
    "- Experience building and deploying production systems",
};

// ─── sales_execution ────────────────────────────────────────

export const INSIDE_SALES_JOB: JobFixture = {
  name: "Inside Sales Rep",
  expectedMode: "sales_execution",
  text:
    "Inside Sales Representative\n" +
    "We are looking for a driven Inside Sales Representative to join our growing team.\n" +
    "Responsibilities:\n" +
    "- Make 50+ outbound calls per day to prospective clients\n" +
    "- Manage and grow a pipeline of qualified prospects\n" +
    "- Meet or exceed monthly sales quota and revenue targets\n" +
    "- Conduct product demos and close deals\n" +
    "- Use Salesforce CRM to track pipeline and forecast revenue\n" +
    "- Collaborate with the sales team to develop territory strategies\n" +
    "- Handle objection handling and negotiate pricing\n" +
    "Requirements:\n" +
    "- 2+ years inside sales or BDR/SDR experience\n" +
    "- Track record of meeting or exceeding quota\n" +
    "- Experience with cold calling and outbound prospecting\n" +
    "- Strong communication and closing skills\n" +
    "- Commission-based compensation structure",
};

export const ENTERPRISE_AE_JOB: JobFixture = {
  name: "Enterprise Account Executive",
  expectedMode: "sales_execution",
  text:
    "Enterprise Account Executive\n" +
    "We are hiring a senior Account Executive to manage complex enterprise sales cycles.\n" +
    "Responsibilities:\n" +
    "- Own full-cycle sales from prospecting through close for enterprise accounts\n" +
    "- Build and maintain a qualified pipeline of $2M+ in annual revenue targets\n" +
    "- Conduct discovery calls and product demos with C-level stakeholders\n" +
    "- Negotiate pricing and close deals with 6–12 month sales cycles\n" +
    "- Manage territory strategy and account planning\n" +
    "- Collaborate with the sales team on cross-sell and upsell motions\n" +
    "Requirements:\n" +
    "- 5+ years quota-carrying enterprise sales experience\n" +
    "- Track record of closing $500K+ deals\n" +
    "- Experience with outbound prospecting and pipeline generation\n" +
    "- Strong objection handling and closing skills",
};

export const BDR_OUTBOUND_JOB: JobFixture = {
  name: "BDR Outbound",
  expectedMode: "sales_execution",
  text:
    "Business Development Representative\n" +
    "Grow our pipeline through outbound prospecting and cold calling.\n" +
    "Responsibilities:\n" +
    "- Make 80+ cold calls per day using dialer software\n" +
    "- Book meetings and demos for the Account Executive team\n" +
    "- Prospect new leads via outbound email and phone campaigns\n" +
    "- Meet monthly quota for qualified meetings booked\n" +
    "- Manage territory lists and track pipeline generation\n" +
    "Requirements:\n" +
    "- 1+ year SDR/BDR experience with cold calling\n" +
    "- Commission-based comp with quota-carrying expectations\n" +
    "- Experience with prospecting tools and CRM",
};

// ─── operational_execution ──────────────────────────────────

export const OPS_COORDINATOR_JOB: JobFixture = {
  name: "Operations Coordinator",
  expectedMode: "operational_execution",
  text:
    "Operations Coordinator\n" +
    "We are looking for an Operations Coordinator to support our growing team.\n" +
    "Responsibilities:\n" +
    "- Coordinate daily operations including scheduling and logistics\n" +
    "- Process orders and manage inventory tracking in our ERP system\n" +
    "- Handle administrative tasks including filing and data entry\n" +
    "- Support onboarding and training coordination for new hires\n" +
    "- Manage procurement and invoicing workflows\n" +
    "- Provide customer support and resolve escalated tickets\n" +
    "Requirements:\n" +
    "- 2+ years operations or administrative experience\n" +
    "- Experience with ERP systems and order processing\n" +
    "- Strong organizational and scheduling skills",
};

export const WAREHOUSE_OPS_JOB: JobFixture = {
  name: "Warehouse Operations",
  expectedMode: "operational_execution",
  text:
    "Warehouse Operations Associate\n" +
    "Manage daily warehouse operations and logistics coordination.\n" +
    "Responsibilities:\n" +
    "- Process inbound and outbound orders via inventory management system\n" +
    "- Coordinate dispatch schedules and logistics with carriers\n" +
    "- Handle data entry for procurement and invoicing records\n" +
    "- Manage inventory counts and ERP system updates\n" +
    "- Support onboarding of new warehouse staff\n" +
    "- Administrative filing and bookkeeping for shipment records\n" +
    "Requirements:\n" +
    "- 2+ years logistics or warehouse operations experience\n" +
    "- Experience with inventory management and order processing\n" +
    "- Strong scheduling and coordination skills",
};

export const CALL_CENTER_JOB: JobFixture = {
  name: "Call Center Support",
  expectedMode: "operational_execution",
  text:
    "Customer Support Representative — Call Center\n" +
    "Handle high-volume inbound customer support in a fast-paced call center.\n" +
    "Responsibilities:\n" +
    "- Answer 60+ customer support calls per day via help desk ticketing system\n" +
    "- Process order changes, returns, and scheduling requests\n" +
    "- Data entry for case notes and customer records\n" +
    "- Coordinate with dispatch for delivery scheduling\n" +
    "- Administrative tasks including filing and invoicing\n" +
    "Requirements:\n" +
    "- 1+ year customer service or help desk experience\n" +
    "- Experience with ticketing systems and data entry\n" +
    "- Strong clerical and organizational skills",
};

// Verde Solar Project Manager — construction/field ops domain
// Validates that "green infrastructure" and bare "engineering" (in education)
// do NOT trigger builder_systems, and that OSHA/subcontractors/permits push
// the job firmly into operational_execution.
export const VERDE_SOLAR_PM_JOB: JobFixture = {
  name: "Verde Solar Project Manager",
  expectedMode: "operational_execution",
  text:
    "Solar Project Manager\n" +
    "Verde partners with communities most impacted by environmental injustices to develop solutions.\n" +
    "The Solar Project Manager will lead the development of community and commercial solar projects.\n" +
    "Essential Duties and Responsibilities:\n" +
    "Project Management\n" +
    "Plans, executes, and oversees solar projects from inception to completion, managing budgets, schedules, and resources.\n" +
    "Coordinates internal teams, subcontractors, and vendors to ensure project milestones are achieved.\n" +
    "Conducts weekly progress meetings and provides regular updates to stakeholders.\n" +
    "Assists with grant writing, budgeting, and reporting for public and private funders.\n" +
    "Construction Management\n" +
    "Reviews and approves project budgets and schedules, including permits, consultants, and construction costs.\n" +
    "Negotiates construction contracts, ensures compliance with grant requirements.\n" +
    "Ensures projects comply with local, state, and federal regulations.\n" +
    "Monitors productivity, profitability, and adherence to the National Electrical Code and solar-related standards.\n" +
    "Client and Stakeholder Engagement\n" +
    "Collaborates with community partners, beneficiaries, government agencies, and contractors.\n" +
    "Minimum Qualifications\n" +
    "Bachelor's degree in construction management, project management, environmental science, engineering, or a similar subject.\n" +
    "2 years of related experience.\n" +
    "OSHA 30 Training Certification and Construction Contractors Board exam.",
};

// ─── Integration platform depth trap (execution evidence: integration_platform) ──

export const ZOOMINFO_PSE_JOB: JobFixture = {
  name: "ZoomInfo Partner Solutions Engineer",
  expectedMode: "builder_systems",
  text:
    "Partner Solutions Engineer - ZoomInfo\n" +
    "We are looking for a Partner Solutions Engineer to join our Product organization.\n" +
    "Build Scalable Integrations: Use ZoomInfo's no-code integration tools to create pre-built solutions\n" +
    "that mutual customers can deploy immediately, eliminating the need for custom development.\n" +
    "Develop Partner Connector Solutions: Build integrations to ZoomInfo's external APIs and MCP tools\n" +
    "from various partner connector platforms.\n" +
    "What You'll Bring:\n" +
    "2-3+ years of experience in a technical role such as Integration Engineer, Partner Engineer,\n" +
    "Technical Solutions Engineer, or Professional Services Engineer, preferably within a B2B SaaS company.\n" +
    "Strong technical foundation with hands-on experience working with APIs, webhooks, authentication\n" +
    "protocols, MCP tools, and integration platforms.\n" +
    "Experience with no-code/low-code integration platforms (Zapier, Workato, Tray.io, Make, etc.) is a plus.\n" +
    "Familiarity with GTM tools and workflows (CRM, marketing automation, sales engagement platforms) is a plus.",
};

// ─── analytical_investigative ───────────────────────────────

export const SECURITY_ANALYST_JOB: JobFixture = {
  name: "Cybersecurity Analyst",
  expectedMode: "analytical_investigative",
  text:
    "Cybersecurity Analyst\n" +
    "We are looking for a Cybersecurity Analyst to join our security operations team.\n" +
    "Responsibilities:\n" +
    "- Conduct vulnerability assessments and penetration testing\n" +
    "- Analyze security threats and investigate incidents\n" +
    "- Perform risk analysis and develop mitigation strategies\n" +
    "- Monitor SOC dashboards and respond to alerts\n" +
    "- Author detailed security audit reports\n" +
    "- Research emerging threats and attack techniques\n" +
    "Requirements:\n" +
    "- Security+ or equivalent certification\n" +
    "- Experience with red team operations\n" +
    "- Strong analytical and investigative skills",
};

export const DATA_ANALYST_JOB: JobFixture = {
  name: "Data Analyst",
  expectedMode: "analytical_investigative",
  text:
    "Data Analyst\n" +
    "Analyze business data to surface actionable insights and support strategic decisions.\n" +
    "Responsibilities:\n" +
    "- Perform data analysis on large datasets to identify trends\n" +
    "- Build statistical models and diagnostic dashboards\n" +
    "- Conduct root cause analysis on business performance metrics\n" +
    "- Research industry benchmarks and competitive intelligence\n" +
    "- Create assessment reports for executive stakeholders\n" +
    "- Investigate data quality issues and audit data pipelines\n" +
    "Requirements:\n" +
    "- 3+ years data analytics experience\n" +
    "- Strong analytical and modeling skills\n" +
    "- Experience with statistical analysis tools",
};

export const FORENSIC_ACCOUNTANT_JOB: JobFixture = {
  name: "Forensic Accountant",
  expectedMode: "analytical_investigative",
  text:
    "Forensic Accountant — Investigations\n" +
    "Investigate financial irregularities and produce forensic audit reports.\n" +
    "Responsibilities:\n" +
    "- Conduct forensic analysis of financial records and transactions\n" +
    "- Investigate suspected fraud, embezzlement, and financial misconduct\n" +
    "- Perform risk analysis and vulnerability assessments of internal controls\n" +
    "- Produce detailed audit reports with evidence documentation\n" +
    "- Research regulatory requirements and provide compliance assessment\n" +
    "Requirements:\n" +
    "- CPA plus forensic accounting certification\n" +
    "- Strong investigative and analytical skills\n" +
    "- Experience with diagnostic financial modeling",
};

// ─── creative_ideation ──────────────────────────────────────

export const CREATIVE_DIRECTOR_JOB: JobFixture = {
  name: "Creative Director",
  expectedMode: "creative_ideation",
  text:
    "Creative Director\n" +
    "Lead the creative vision for our brand and marketing campaigns.\n" +
    "Responsibilities:\n" +
    "- Set creative direction for all brand campaigns and visual design\n" +
    "- Lead ideation sessions and concept development for product launches\n" +
    "- Manage content creation and storytelling across digital channels\n" +
    "- Art direction for photo shoots, video, and graphic design assets\n" +
    "- Develop brand guidelines and content strategy\n" +
    "- Run design thinking workshops with cross-functional stakeholders\n" +
    "Requirements:\n" +
    "- 6+ years creative direction or brand leadership experience\n" +
    "- Strong visual design, copywriting, and ideation portfolio\n" +
    "- Experience with UX design and marketing creative",
};

export const CONTENT_STRATEGIST_JOB: JobFixture = {
  name: "Content Strategist",
  expectedMode: "creative_ideation",
  text:
    "Content Strategist\n" +
    "Own content strategy and creative storytelling for our brand.\n" +
    "Responsibilities:\n" +
    "- Develop content strategy across blog, social, and email channels\n" +
    "- Write copywriting briefs and creative concepts for campaigns\n" +
    "- Lead ideation brainstorms for content creation initiatives\n" +
    "- Manage branding consistency and visual design guidelines\n" +
    "- Collaborate on campaign storytelling and marketing creative\n" +
    "Requirements:\n" +
    "- 3+ years content strategy or copywriting experience\n" +
    "- Portfolio demonstrating content creation and brand storytelling\n" +
    "- Experience with marketing operations and enablement",
};

// ─── Hybrid / Edge Case Jobs ────────────────────────────────

export const SALES_OPS_HYBRID_JOB: JobFixture = {
  name: "Sales Ops Hybrid",
  expectedMode: "sales_execution",
  text:
    "Sales Operations Specialist\n" +
    "Join our team to manage sales operations, CRM systems, and coordinate cross-functional workflows.\n" +
    "Responsibilities:\n" +
    "- Manage Salesforce CRM configuration and workflow automation\n" +
    "- Build reports and dashboards for the sales team\n" +
    "- Meet quarterly quota for outbound prospecting and pipeline generation\n" +
    "- Cold call leads and close deals alongside the BDR team\n" +
    "- Track territory coverage and revenue targets\n" +
    "- Coordinate with multiple teams on process improvement\n" +
    "- Handle administrative coordination and scheduling\n" +
    "Requirements:\n" +
    "- 3+ years sales operations or inside sales experience\n" +
    "- Commission-based compensation\n" +
    "- Experience with quota-carrying sales roles",
};

export const PROPERTY_MAX_GRIND_JOB: JobFixture = {
  name: "Property Max Grind",
  expectedMode: "sales_execution",
  text:
    "House Buying Specialist — Property Max\n" +
    "We're looking for motivated individuals to join our team as House Buying Specialists.\n" +
    "This is a fast-paced, commission-based role focused on acquiring residential properties.\n" +
    "Responsibilities:\n" +
    "- Make 60+ outbound calls per day to distressed property owners\n" +
    "- Door knocking in assigned neighborhoods to generate leads\n" +
    "- Field canvassing and in-person sales presentations to homeowners\n" +
    "- Cold calling from skip-traced lists using auto-dialer\n" +
    "- Meet weekly quota for signed purchase agreements\n" +
    "- Handle objection handling and overcome seller resistance\n" +
    "- Must have thick skin — high rejection rate is normal\n" +
    "- Quota-carrying role with uncapped commission\n" +
    "- Daily activity targets tracked via CRM metrics\n" +
    "Requirements:\n" +
    "- Resilience in rejection-heavy environments\n" +
    "- Phone-based and in-person sales experience preferred\n" +
    "- Commission-only compensation (OTE $80k–$120k)\n" +
    "- Valid driver's license for door-to-door territory coverage\n" +
    "- High-volume, metrics-driven work ethic",
};

// ─── False-Positive Trap Jobs ───────────────────────────────
// These roles use strategic/ownership vocabulary that could inflate
// scores for Builder/Systems or Analytical profiles, but are
// fundamentally sales or ops execution roles.

export const VP_SALES_STRATEGY_JOB: JobFixture = {
  name: "VP Sales (strategy vocabulary trap)",
  expectedMode: "sales_execution",
  text:
    "Vice President of Sales\n" +
    "Lead our sales organization and drive revenue growth strategy.\n" +
    "Responsibilities:\n" +
    "- Own the full revenue pipeline from prospecting to close\n" +
    "- Build and manage a sales team of 15 quota-carrying reps\n" +
    "- Meet or exceed $10M annual revenue target\n" +
    "- Develop territory strategy and pipeline generation playbooks\n" +
    "- Close executive-level deals and handle complex objections\n" +
    "- Conduct QBRs and forecast revenue to the board\n" +
    "- Hire, coach, and lead the inside sales and BDR organization\n" +
    "Requirements:\n" +
    "- 8+ years quota-carrying sales leadership\n" +
    "- Track record of exceeding revenue targets\n" +
    "- Experience with outbound prospecting at scale\n" +
    "- Strong closing skills and commission-driven mindset",
};

export const STARTUP_COO_OPS_JOB: JobFixture = {
  name: "Startup COO (ownership vocabulary trap)",
  expectedMode: "operational_execution",
  text:
    "Chief Operating Officer — Early-Stage Startup\n" +
    "Own all operational execution for a fast-growing 20-person company.\n" +
    "Responsibilities:\n" +
    "- Coordinate daily operations across all departments\n" +
    "- Manage procurement, vendor relationships, and invoicing\n" +
    "- Handle payroll processing and bookkeeping reconciliation\n" +
    "- Oversee onboarding coordination for new hires\n" +
    "- Manage office operations, scheduling, and administrative logistics\n" +
    "- Handle customer support escalations and help desk management\n" +
    "- Data entry and ERP system maintenance\n" +
    "Requirements:\n" +
    "- 5+ years operations or office management experience\n" +
    "- Experience with administrative coordination at scale\n" +
    "- Strong scheduling, logistics, and procurement skills",
};

export const FIELD_OPS_DIRECTOR_JOB: JobFixture = {
  name: "Field Ops Director (investigation vocabulary trap)",
  expectedMode: "operational_execution",
  text:
    "Director of Field Operations\n" +
    "Lead our field operations team and ensure operational excellence.\n" +
    "Responsibilities:\n" +
    "- Coordinate logistics and dispatch across 8 regional offices\n" +
    "- Manage procurement and inventory for field operations\n" +
    "- Handle administrative scheduling and data entry for field reports\n" +
    "- Process invoicing and payroll for 200+ field staff\n" +
    "- Coordinate onboarding logistics for seasonal workers\n" +
    "- Manage help desk ticketing for field support requests\n" +
    "- Oversee order processing and ERP system administration\n" +
    "Requirements:\n" +
    "- 7+ years logistics or field operations management\n" +
    "- Experience with dispatch coordination at scale\n" +
    "- Strong administrative and clerical management skills",
};

// ─── Execution-Dominated Builder-Vocabulary Traps ───────────
// Roles that trigger builder_systems via ambiguous vocabulary
// (infrastructure, workflow, engineering, implementation, integration,
// process improvement, "building systems") but are fundamentally
// execution/coordination roles. The structural-vs-execution discriminator
// should reclassify these from builder_systems → operational_execution.

export const CONSTRUCTION_PM_JOB: JobFixture = {
  name: "Construction PM (builder vocabulary trap)",
  expectedMode: "operational_execution",
  text:
    "Construction Project Manager — GreenField Builders\n" +
    "Lead the planning and execution of large-scale commercial construction projects.\n" +
    "Responsibilities:\n" +
    "- Oversee project implementation from preconstruction through final delivery\n" +
    "- Manage project scheduling and coordinate workflow across trades\n" +
    "- Drive process improvement initiatives to optimize site operations\n" +
    "- Integrate building systems and coordinate with engineering consultants\n" +
    "- Build and maintain project infrastructure including document management\n" +
    "- Manage stakeholder communication and vendor coordination\n" +
    "- Track budget performance and resource allocation across projects\n" +
    "- Ensure regulatory compliance and inspection readiness\n" +
    "- Review and process change orders, RFIs, and submittals\n" +
    "- Supervise subcontractor work and site safety compliance\n" +
    "Requirements:\n" +
    "- 7+ years construction project management experience\n" +
    "- PMP or equivalent certification preferred\n" +
    "- Experience with preconstruction planning and procurement\n" +
    "- Strong scheduling, budget tracking, and stakeholder management skills",
};

export const PROGRAM_COORDINATOR_JOB: JobFixture = {
  name: "Program Coordinator (builder vocabulary trap)",
  expectedMode: "operational_execution",
  text:
    "Program Coordinator — Municipal Infrastructure Division\n" +
    "Coordinate cross-functional infrastructure programs and ensure smooth project delivery.\n" +
    "Responsibilities:\n" +
    "- Manage project coordination for engineering infrastructure programs\n" +
    "- Oversee workflow integration across multiple construction phases\n" +
    "- Drive process improvement for project delivery and implementation timelines\n" +
    "- Produce progress reports and track project milestones\n" +
    "- Coordinate vendor management and subcontractor scheduling\n" +
    "- Manage budget tracking and resource allocation for program portfolio\n" +
    "- Ensure safety compliance and regulatory inspection readiness\n" +
    "- Support preconstruction planning and permit coordination\n" +
    "Requirements:\n" +
    "- 5+ years program coordination or project management experience\n" +
    "- Experience with infrastructure or construction programs\n" +
    "- Strong stakeholder communication and status reporting skills",
};

// ─── sales_execution (relationship-driven / partnerships) ───

export const BDM_JOB: JobFixture = {
  name: "Business Development Manager",
  expectedMode: "sales_execution",
  text:
    "Business Development Manager\n" +
    "Build and manage strategic partnerships to drive revenue growth.\n" +
    "Responsibilities:\n" +
    "- Develop new business opportunities through relationship development and account management\n" +
    "- Own revenue pipeline and partner lifecycle from prospecting through close\n" +
    "- Drive account growth through sponsorships and partnership agreements\n" +
    "- Manage key client relationships and negotiate partnership terms\n" +
    "- Meet quarterly revenue targets through pipeline development\n" +
    "- Identify and pursue new partnership opportunities in target markets\n" +
    "Requirements:\n" +
    "- 5+ years business development or partnerships experience\n" +
    "- Track record of revenue generation through relationship-driven sales\n" +
    "- Experience managing strategic partnerships and client accounts",
};

export const PARTNERSHIPS_MANAGER_JOB: JobFixture = {
  name: "Partnerships Manager",
  expectedMode: "sales_execution",
  text:
    "Partnerships Manager\n" +
    "Own and grow strategic partnership portfolio.\n" +
    "Responsibilities:\n" +
    "- Drive revenue generation through partner development and relationship management\n" +
    "- Manage partner lifecycle from identification through renewal\n" +
    "- Negotiate sponsorship agreements and partnership terms\n" +
    "- Build pipeline of new partnership opportunities\n" +
    "- Track account growth metrics and client retention rates\n" +
    "- Collaborate with sales team on joint revenue initiatives\n" +
    "Requirements:\n" +
    "- 4+ years partnership management or business development experience\n" +
    "- Strong relationship building and negotiation skills\n" +
    "- Experience with sponsorship sales or account management",
};

export const ACCOUNT_MANAGER_REVENUE_JOB: JobFixture = {
  name: "Account Manager (revenue-focused)",
  expectedMode: "sales_execution",
  text:
    "Account Manager\n" +
    "Manage and grow a portfolio of strategic client accounts.\n" +
    "Responsibilities:\n" +
    "- Drive revenue growth through account management and client development\n" +
    "- Own the full client lifecycle from onboarding through renewal and upsell\n" +
    "- Build relationship development plans for key accounts\n" +
    "- Identify cross-sell and partnership opportunities within existing accounts\n" +
    "- Meet quarterly revenue targets and pipeline development goals\n" +
    "- Manage client retention and satisfaction metrics\n" +
    "Requirements:\n" +
    "- 3+ years account management or sales experience\n" +
    "- Track record of revenue generation and client retention\n" +
    "- Strong relationship management and closing skills",
};

export const PRODUCT_MANAGER_JOB: JobFixture = {
  name: "Product Manager (strategy/growth — NOT sales)",
  expectedMode: "builder_systems",
  text:
    "Product Manager\n" +
    "Define product strategy and roadmap for our core platform.\n" +
    "Responsibilities:\n" +
    "- Work with engineering teams on product development and feature delivery\n" +
    "- Conduct user research and analyze product metrics\n" +
    "- Drive growth through product-led initiatives and A/B testing\n" +
    "- Coordinate cross-functional teams for feature releases\n" +
    "- Manage sprint planning and agile ceremonies\n" +
    "- Define technical requirements and acceptance criteria\n" +
    "Requirements:\n" +
    "- 4+ years product management experience\n" +
    "- Experience with software development lifecycle\n" +
    "- Strong analytical and product strategy skills",
};

export const STRATEGY_OPS_JOB: JobFixture = {
  name: "Strategy & Operations Manager (growth language — NOT sales)",
  expectedMode: "operational_execution",
  text:
    "Strategy & Operations Manager\n" +
    "Lead operational improvement and strategic planning initiatives.\n" +
    "Responsibilities:\n" +
    "- Drive operational efficiency through process improvement and scheduling optimization\n" +
    "- Coordinate cross-functional teams and manage resource allocation\n" +
    "- Support strategic growth initiatives through operational planning\n" +
    "- Manage vendor relationships and procurement processes\n" +
    "- Produce executive reporting and progress dashboards\n" +
    "- Oversee budget tracking and program delivery timelines\n" +
    "Requirements:\n" +
    "- 5+ years operations or strategy experience\n" +
    "- Strong project management and stakeholder coordination skills\n" +
    "- Experience with operational planning and resource management",
};

// ─── Execution-Evidence Guardrail Test Jobs ─────────────────
// Roles that are directionally aligned with builder_systems but
// require domain-locked or stack-specific execution depth that
// a generalist builder profile has not demonstrated.

export const SALESFORCE_CPQ_ARCHITECT_JOB: JobFixture = {
  name: "Salesforce CPQ Architect",
  expectedMode: "builder_systems",
  text:
    "Salesforce CPQ Architect — Enterprise Quote-to-Cash\n" +
    "Lead the design and implementation of Salesforce CPQ solutions for enterprise clients.\n" +
    "Responsibilities:\n" +
    "- Architect and implement Salesforce CPQ (Configure, Price, Quote) solutions\n" +
    "- Develop custom Apex classes, triggers, and Lightning Web Components\n" +
    "- Write SOQL and SOSL queries for data integration and reporting\n" +
    "- Design quote-to-cash workflows across Sales Cloud and Service Cloud\n" +
    "- Build automated approval processes and pricing rules in Salesforce\n" +
    "- Integrate Salesforce with ERP systems for order management\n" +
    "- Create SOPs for CPQ configuration and deployment processes\n" +
    "- Lead sprint planning and agile delivery for the Salesforce team\n" +
    "Requirements:\n" +
    "- 5+ years Salesforce development experience with CPQ specialization\n" +
    "- Salesforce Platform Developer certification required\n" +
    "- Expert-level Apex, Lightning (LWC), and SOQL proficiency\n" +
    "- Strong systems architecture and integration design skills\n" +
    "- Experience with enterprise quote-to-cash transformation projects",
};

export const SENIOR_PYTHON_DEVELOPER_JOB: JobFixture = {
  name: "Senior Python Developer",
  expectedMode: "builder_systems",
  text:
    "Senior Python Developer — Backend Systems\n" +
    "Join our engineering team to design and build backend services at scale.\n" +
    "Responsibilities:\n" +
    "- Write production code in Python for our backend microservices\n" +
    "- Build and maintain REST APIs using Django and Django REST Framework\n" +
    "- Design and implement data models in PostgreSQL\n" +
    "- Conduct code reviews and maintain high code quality standards\n" +
    "- Contribute to the codebase with well-tested, production-ready features\n" +
    "- Deploy services using Docker and CI/CD pipelines\n" +
    "- Collaborate with frontend engineers building React applications\n" +
    "Requirements:\n" +
    "- 5+ years hands-on Python development experience\n" +
    "- Strong proficiency in Django or Flask\n" +
    "- Experience with Python algorithms and data structures\n" +
    "- Code review experience and testing best practices\n" +
    "- Familiarity with JavaScript and TypeScript is a plus",
};

// ═══════════════════════════════════════════════════════════
// ─── CONVENIENCE GROUPINGS ──────────────────────────────────
// ═══════════════════════════════════════════════════════════

export const CORE_USERS = [CHRIS, MARCUS, PRIYA, FABIO, LUNA] as const;
export const BLENDED_USERS = [ALEX, DANA, RIO, NADIA, TOMAS] as const;
export const ALL_USERS = [...CORE_USERS, ...BLENDED_USERS, DINGUS, JEN] as const;

export const ALL_JOBS = [
  SYSTEMS_PRODUCT_JOB,
  DEVOPS_ENGINEER_JOB,
  FULLSTACK_ENGINEER_JOB,
  INSIDE_SALES_JOB,
  ENTERPRISE_AE_JOB,
  BDR_OUTBOUND_JOB,
  BDM_JOB,
  PARTNERSHIPS_MANAGER_JOB,
  ACCOUNT_MANAGER_REVENUE_JOB,
  OPS_COORDINATOR_JOB,
  WAREHOUSE_OPS_JOB,
  CALL_CENTER_JOB,
  VERDE_SOLAR_PM_JOB,
  SECURITY_ANALYST_JOB,
  DATA_ANALYST_JOB,
  FORENSIC_ACCOUNTANT_JOB,
  CREATIVE_DIRECTOR_JOB,
  CONTENT_STRATEGIST_JOB,
  SALES_OPS_HYBRID_JOB,
  PROPERTY_MAX_GRIND_JOB,
  VP_SALES_STRATEGY_JOB,
  STARTUP_COO_OPS_JOB,
  FIELD_OPS_DIRECTOR_JOB,
  CONSTRUCTION_PM_JOB,
  PROGRAM_COORDINATOR_JOB,
  PRODUCT_MANAGER_JOB,
  STRATEGY_OPS_JOB,
  SALESFORCE_CPQ_ARCHITECT_JOB,
  SENIOR_PYTHON_DEVELOPER_JOB,
  ZOOMINFO_PSE_JOB,
] as const;

export const EXECUTION_EVIDENCE_JOBS = [
  SALESFORCE_CPQ_ARCHITECT_JOB,
  SENIOR_PYTHON_DEVELOPER_JOB,
  ZOOMINFO_PSE_JOB,
] as const;

export const FALSE_POSITIVE_TRAP_JOBS = [
  VP_SALES_STRATEGY_JOB,
  STARTUP_COO_OPS_JOB,
  FIELD_OPS_DIRECTOR_JOB,
  CONSTRUCTION_PM_JOB,
  PROGRAM_COORDINATOR_JOB,
] as const;
