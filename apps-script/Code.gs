/**
 * ASME Indy SponsorFlow — Google Apps Script backend
 * Version 5: sponsor outreach plus collaborative team timelines, task boards,
 * parts tracking, dependencies, comments, and activity history.
 */

const SF = Object.freeze({
  VERSION: '5.0.0',
  RESEARCH_VALIDATED_AT: '2026-07-29',
  SESSION_SECONDS: 3600,
  SHEETS: {
    CONTACTS: 'Contacts',
    TEMPLATES: 'Templates',
    REQUESTS: 'Requests',
    REVISIONS: 'Revisions',
    AUDIT: 'Audit',
    PLANNER_TEAMS: 'Planner Teams',
    PLANNER_BOARDS: 'Planner Boards',
    PLANNER_TASKS: 'Planner Tasks',
    PLANNER_COMMENTS: 'Planner Comments',
    PLANNER_ACTIVITY: 'Planner Activity'
  },
  HEADERS: {
    Contacts: [
      'id', 'companyName', 'contactName', 'email', 'outreachType', 'outreachUrl',
      'category', 'suggestedAsk', 'eligibility', 'personalizationIdea',
      'recommendedTemplateId', 'notes', 'sourceUrl', 'validatedAt',
      'validationStatus', 'verified', 'active', 'createdAt', 'updatedAt'
    ],
    Templates: ['id', 'name', 'category', 'description', 'subjectTemplate', 'bodyTemplate', 'active', 'createdAt', 'updatedAt'],
    Requests: [
      'id', 'accessHash', 'requesterName', 'requesterNameKey', 'requesterRole',
      'contactId', 'companyName', 'contactName', 'contactEmail', 'outreachType',
      'outreachUrl', 'sponsorVerification', 'duplicateAcknowledged', 'templateId',
      'templateName', 'subject', 'body', 'status', 'adminComment',
      'revisionNumber', 'createdAt', 'updatedAt', 'submittedAt', 'sentAt'
    ],
    Revisions: ['id', 'requestId', 'revisionNumber', 'actorType', 'actorName', 'subject', 'body', 'comment', 'status', 'createdAt'],
    Audit: ['id', 'requestId', 'action', 'actor', 'details', 'createdAt'],
    'Planner Teams': ['id', 'name', 'description', 'icon', 'active', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt'],
    'Planner Boards': ['id', 'teamId', 'name', 'description', 'targetStart', 'targetEnd', 'active', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt'],
    'Planner Tasks': [
      'id', 'boardId', 'title', 'description', 'status', 'priority', 'ownerNames',
      'startDate', 'dueDate', 'progress', 'isMilestone', 'tags', 'taskType',
      'campus', 'fundingMin', 'fundingMax', 'fundingAmountLabel', 'sourceUrl',
      'sourceConfidence', 'requirements', 'partName', 'partNumber', 'vendor', 'quantity', 'estimatedCost', 'orderStatus',
      'dependencyIds', 'sortOrder', 'commentCount', 'createdBy', 'updatedBy',
      'createdAt', 'updatedAt', 'completedAt', 'archived'
    ],
    'Planner Comments': ['id', 'taskId', 'authorName', 'body', 'createdAt'],
    'Planner Activity': ['id', 'taskId', 'boardId', 'action', 'actor', 'details', 'createdAt']
  }
});

const DEFAULT_TEMPLATES = [
  {
    id: 'TPL-GENERAL',
    name: 'Direct Partnership Request',
    category: 'Financial',
    description: 'A concise, sponsor-centered first message with one clear ask, one clear use, and an easy next step.',
    subjectTemplate: '{{company_name}} + Purdue Indianapolis ASME | Student engineering partnership',
    bodyTemplate: `Hello {{greeting_name}},

{{personalized_connection}}

I’m {{sender_name}}, {{sender_role}} with Purdue University Indianapolis ASME. Our student-led team designs, builds, and tests an electric racing kart, giving members practical experience in battery systems, electrical architecture, fabrication, validation, and project leadership. Our team most recently finished fifth out of 27 competitors.

We are seeking {{specific_request}} to help us {{specific_use}}.

In return, we can provide {{selected_benefits}}. We can also share concise progress updates and photos that show exactly how your support is being used.

{{custom_message}}

Would you be open to a 15-minute conversation, or could you direct me to the person who handles student partnerships or community sponsorships?

Thank you for considering an investment in Purdue Indianapolis student engineers.

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME
asmeindy@purdue.edu
https://asmevk.webflow.io`,
    active: true
  },
  {
    id: 'TPL-INKIND',
    name: 'Technical Product or Manufacturing Request',
    category: 'In-kind',
    description: 'For parts, materials, fabrication, equipment, electronics, or services tied to a concrete engineering milestone.',
    subjectTemplate: '{{requested_item_short}} | Purdue Indianapolis ASME EV-Kart',
    bodyTemplate: `Hello {{greeting_name}},

{{personalized_connection}}

I’m {{sender_name}} with the Purdue University Indianapolis ASME EV-Kart Team. Our students design and build the kart’s mechanical, electrical, and battery systems, then validate them through testing and competition.

Would {{company_name}} consider supporting the team with {{specific_request}}? This would directly help us {{specific_use}}.

We would recognize the partnership through {{selected_benefits}}. We can also provide installation photos, technical use examples, and a short impact update your team can share internally or publicly.

{{custom_message}}

If the full request is not possible, we would be grateful to discuss a partial donation, educational discount, store credit, refurbished product, or technical guidance.

Could we schedule a brief conversation about what may fit your student-support program?

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME
asmeindy@purdue.edu
https://asmevk.webflow.io`,
    active: true
  },
  {
    id: 'TPL-PROGRAM',
    name: 'Official Student-Team Program Application',
    category: 'Program application',
    description: 'Optimized for companies that already operate a student-team, education, software, or manufacturing support program.',
    subjectTemplate: 'Student team support request | Purdue Indianapolis ASME EV-Kart',
    bodyTemplate: `Hello {{greeting_name}},

I’m {{sender_name}}, {{sender_role}} with Purdue University Indianapolis ASME. Our team identified {{company_name}} as a strong fit for this request. {{personalized_connection}}

Our student team designs, builds, and tests an electric racing kart, with current work spanning {{specific_use}}. We are requesting {{specific_request}}.

The support would be used directly by students for design, manufacturing, validation, and competition preparation. In recognition, we can provide {{selected_benefits}}, along with project photos and a concise summary of the results enabled by the partnership.

{{custom_message}}

Our team website is https://asmevk.webflow.io, and our club email is asmeindy@purdue.edu. Please let us know whether any additional project files, faculty authorization, tax documentation, or technical details would strengthen the application.

Thank you for supporting hands-on engineering education.

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME`,
    active: true
  },
  {
    id: 'TPL-LOCAL',
    name: 'Indianapolis Community or Grant Request',
    category: 'Local',
    description: 'For Central Indiana employers, foundations, utilities, and community programs where local workforce impact matters.',
    subjectTemplate: 'Indianapolis student engineering partnership | Purdue ASME',
    bodyTemplate: `Hello {{greeting_name}},

{{personalized_connection}}

I’m {{sender_name}}, {{sender_role}} with Purdue University Indianapolis ASME. Our chapter gives Indianapolis students hands-on experience in electric-vehicle engineering, fabrication, testing, teamwork, and project leadership.

We are seeking {{specific_request}} to help us {{specific_use}}.

This partnership would create a visible, local investment in future engineers. In return, we can provide {{selected_benefits}} and document the impact with project photos, participation metrics, and a short student-focused update.

{{custom_message}}

Would you be available for a brief conversation, or could you direct us to the appropriate community investment, workforce development, or university relations contact?

Thank you for considering support for student engineering in Indianapolis.

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME
asmeindy@purdue.edu`,
    active: true
  },
  {
    id: 'TPL-FOLLOWUP',
    name: 'Respectful Follow-Up',
    category: 'Follow-up',
    description: 'A short second touch that makes routing or responding easy without repeating the full original email.',
    subjectTemplate: 'Following up | Purdue Indianapolis ASME and {{company_name}}',
    bodyTemplate: `Hello {{greeting_name}},

I wanted to follow up on our request regarding {{specific_request}} for the Purdue University Indianapolis ASME EV-Kart Team.

The support would help us {{specific_use}}, and we can provide {{selected_benefits}} in return.

{{personalized_connection}}

{{custom_message}}

Would you be the right person to review this request? If not, I would appreciate being directed to the appropriate student programs, community partnerships, or technical marketing contact.

Thank you for your time.

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME
asmeindy@purdue.edu`,
    active: true
  },
  {
    id: 'TPL-THANKYOU',
    name: 'Sponsor Thank-You and Fulfillment',
    category: 'Stewardship',
    description: 'Confirms the contribution, documents promised benefits, and collects the brand assets needed to fulfill them.',
    subjectTemplate: 'Thank you for supporting Purdue Indianapolis ASME',
    bodyTemplate: `Hello {{greeting_name}},

On behalf of Purdue University Indianapolis ASME, thank you for supporting our students through {{specific_request}}.

Your support will help us {{specific_use}}. We have recorded the following partnership commitments: {{selected_benefits}}.

{{custom_message}}

To prepare recognition materials, please send your preferred company name, a vector or high-resolution logo, brand-use requirements, preferred website link, and the best contact for project updates.

We look forward to sharing the student work your support makes possible.

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME
asmeindy@purdue.edu`,
    active: true
  }
];

const VALIDATED_SPONSORS = [
  {
    "id": "CON-VALID-SOLIDWORKS",
    "companyName": "SOLIDWORKS",
    "contactName": "Student Team Sponsorship Program",
    "email": "",
    "outreachType": "FORM",
    "outreachUrl": "https://www.solidworks.com/product/students/solidworks-sponsorship-student-teams",
    "category": "CAD and simulation software",
    "suggestedAsk": "complimentary SOLIDWORKS and 3DEXPERIENCE tools, simulation access, training, and student-team support",
    "eligibility": "Competitive student engineering teams; select the closest collegiate vehicle or SAE pathway on the official page.",
    "personalizationIdea": "Connect the request to CAD collaboration, structural validation, electrical packaging, and manufacturing drawings for the EV-Kart.",
    "recommendedTemplateId": "TPL-PROGRAM",
    "notes": "Official student-team sponsorship route. Prepare the team website, competition information, faculty contact, and intended software use.",
    "sourceUrl": "https://www.solidworks.com/product/students/solidworks-sponsorship-student-teams",
    "validationStatus": "OFFICIAL_STUDENT_PROGRAM"
  },
  {
    "id": "CON-VALID-ANSYS",
    "companyName": "Ansys",
    "contactName": "Student Design Team Partnership",
    "email": "",
    "outreachType": "FORM",
    "outreachUrl": "https://www.ansys.com/academic/students/student-teams",
    "category": "Engineering simulation software",
    "suggestedAsk": "a student-team partnership providing research software, learning resources, and technical support",
    "eligibility": "University-based student teams; the official program explicitly includes Formula SAE and other vehicle competitions.",
    "personalizationIdea": "Describe structural, thermal, electronics, battery cooling, or airflow analyses the team wants to perform and how results will affect design decisions.",
    "recommendedTemplateId": "TPL-PROGRAM",
    "notes": "Official student-team partnership application. Lead with two or three specific simulation use cases rather than a generic software request.",
    "sourceUrl": "https://www.ansys.com/academic/students/student-teams",
    "validationStatus": "OFFICIAL_STUDENT_PROGRAM"
  },
  {
    "id": "CON-VALID-MATHWORKS",
    "companyName": "MathWorks",
    "contactName": "Student Competition Support",
    "email": "",
    "outreachType": "FORM",
    "outreachUrl": "https://www.mathworks.com/academia/academic-support/student-competition-individual-team.html",
    "category": "Controls, data, and simulation software",
    "suggestedAsk": "complimentary MATLAB and Simulink competition licenses, online training, and technical support",
    "eligibility": "The official request must be completed by a faculty advisor or another person authorized to act for Purdue; university legal and tax information may be required.",
    "personalizationIdea": "Connect MATLAB or Simulink to battery-data analysis, controls, telemetry, lap analysis, test automation, or model-based design.",
    "recommendedTemplateId": "TPL-PROGRAM",
    "notes": "Official individual-team request route. Coordinate with the faculty advisor before submitting because institutional authorization and documentation may be required.",
    "sourceUrl": "https://www.mathworks.com/academia/academic-support/student-competition-individual-team.html",
    "validationStatus": "OFFICIAL_STUDENT_PROGRAM"
  },
  {
    "id": "CON-VALID-ALTAIR",
    "companyName": "Altair",
    "contactName": "Student Team Technology Sponsorship",
    "email": "",
    "outreachType": "FORM",
    "outreachUrl": "https://altair.com/student-team-technology-sponsorship",
    "category": "Simulation, optimization, and data software",
    "suggestedAsk": "a sponsored student-team software license, training resources, and technical guidance",
    "eligibility": "Student engineering teams can request a team license through the official sponsorship form.",
    "personalizationIdea": "Connect Altair tools to lightweighting, structural optimization, electric-drive analysis, data analytics, or sensor calibration.",
    "recommendedTemplateId": "TPL-PROGRAM",
    "notes": "Official student-team technology sponsorship form. Be specific about which tools and engineering questions the team wants to address.",
    "sourceUrl": "https://altair.com/student-team-technology-sponsorship",
    "validationStatus": "OFFICIAL_STUDENT_PROGRAM"
  },
  {
    "id": "CON-VALID-ALTIUM",
    "companyName": "Altium",
    "contactName": "Education Team Sponsorship",
    "email": "studentsupport@altium.com",
    "outreachType": "FORM",
    "outreachUrl": "https://www.altium.com/education/students",
    "category": "PCB design software",
    "suggestedAsk": "free Altium team sponsorship, PCB-design software, training, and support for EV-Kart electronics",
    "eligibility": "Student engineering teams can apply; use a Purdue-domain address and be prepared to verify enrollment if requested.",
    "personalizationIdea": "Explain the team\u2019s PCB needs for telemetry, battery monitoring, power distribution, controls, or sensor interfaces.",
    "recommendedTemplateId": "TPL-PROGRAM",
    "notes": "Official Altium Education team-sponsorship route. The support email is appropriate for education-program assistance, but use the official team application first.",
    "sourceUrl": "https://www.altium.com/education/students",
    "validationStatus": "OFFICIAL_STUDENT_PROGRAM"
  },
  {
    "id": "CON-VALID-SENDCUTSEND",
    "companyName": "SendCutSend",
    "contactName": "STEM Sponsorship Program",
    "email": "partner@sendcutsend.com",
    "outreachType": "FORM",
    "outreachUrl": "https://sendcutsend.com/stem-sponsorships/",
    "category": "Sheet metal and fabrication",
    "suggestedAsk": "$750\u2013$1,500 in discounted or sponsored laser-cut sheet metal and fabrication services for kart brackets, enclosures, and fixtures",
    "eligibility": "U.S. or Canadian college engineering teams. The official program has defined application windows and says it typically sponsors 10\u201315% of applicants.",
    "personalizationIdea": "Include drawings or renderings for specific brackets, battery enclosures, tabs, guards, or test fixtures and explain why their manufacturing process is a strong fit.",
    "recommendedTemplateId": "TPL-PROGRAM",
    "notes": "Official STEM sponsorship application. Check the live page for the current application window before submitting. Questions can go to the education support email.",
    "sourceUrl": "https://sendcutsend.com/stem-sponsorships/",
    "validationStatus": "OFFICIAL_STUDENT_PROGRAM"
  },
  {
    "id": "CON-VALID-PCBWAY",
    "companyName": "PCBWay",
    "contactName": "Educational and Engineering Sponsorship",
    "email": "sponsor@PCBWay.com",
    "outreachType": "EMAIL",
    "outreachUrl": "https://www.pcbway.com/project/sponsor/learnsponsor.aspx",
    "category": "PCB fabrication and assembly",
    "suggestedAsk": "sponsored or discounted PCB fabrication for battery monitoring, telemetry, controls, or power-distribution boards",
    "eligibility": "University projects and competition PCBs are explicitly supported; shipping may remain the team\u2019s responsibility.",
    "personalizationIdea": "Attach or describe a real PCB, its function, board quantity, timeline, and how the team will document the finished board in the kart.",
    "recommendedTemplateId": "TPL-INKIND",
    "notes": "Official educational sponsorship contact and application route. Strong applications include project details, supporting material, and PCB files or requirements.",
    "sourceUrl": "https://www.pcbway.com/Home/sponsor",
    "validationStatus": "OFFICIAL_STUDENT_PROGRAM"
  },
  {
    "id": "CON-VALID-JLCPCB",
    "companyName": "JLCPCB / EasyEDA",
    "contactName": "Education Program",
    "email": "",
    "outreachType": "FORM",
    "outreachUrl": "https://jlcpcb.com/cooperation",
    "category": "PCB fabrication and electronics education",
    "suggestedAsk": "free PCB sponsorship for a defined EV-Kart electronics board and related educational support",
    "eligibility": "The official education program supports student PCB projects through an online application.",
    "personalizationIdea": "Present one board with a clear technical purpose, expected quantities, timeline, and photos or documentation the club can share afterward.",
    "recommendedTemplateId": "TPL-PROGRAM",
    "notes": "Official education-program application. Use the application route rather than relying on a scraped or reformatted support address.",
    "sourceUrl": "https://jlcpcb.com/cooperation",
    "validationStatus": "OFFICIAL_STUDENT_PROGRAM"
  },
  {
    "id": "CON-VALID-POLYMAKER",
    "companyName": "Polymaker",
    "contactName": "Sponsorship and Donations Team",
    "email": "Support@Polymaker.com",
    "outreachType": "EMAIL",
    "outreachUrl": "https://shop.polymaker.com/blogs/order-help/marketing-donation-requests",
    "category": "Engineering-grade 3D-printing materials",
    "suggestedAsk": "engineering-grade filament for battery prototypes, cell-containment iterations, brackets, jigs, and fitment tools",
    "eligibility": "Official sponsorship requests should state the exact materials, diameters, colors, quantities, project description, and places where prints will be shared.",
    "personalizationIdea": "Reference the team\u2019s successful use of 3D-printed battery containment and specify materials and spool quantities rather than asking for generic filament support.",
    "recommendedTemplateId": "TPL-INKIND",
    "notes": "Official sponsorship email and request form. Requests involving resale of donated filament or prints are not eligible.",
    "sourceUrl": "https://shop.polymaker.com/pages/start-here",
    "validationStatus": "OFFICIAL_SPONSOR_CONTACT"
  },
  {
    "id": "CON-VALID-MOUSER",
    "companyName": "Mouser Electronics",
    "contactName": "Educational Sales Team",
    "email": "edusales@mouser.com",
    "outreachType": "EMAIL",
    "outreachUrl": "https://www.mouser.com/educationalsales/",
    "category": "Electronic components and educational purchasing",
    "suggestedAsk": "educational pricing, project quoting, or component support for connectors, sensors, protection, controls, and battery electronics",
    "eligibility": "Qualifying educational customers can register for educational pricing; sponsorship requests should be framed around a specific bill of materials and student impact.",
    "personalizationIdea": "Provide a concise bill-of-materials summary and connect the parts to battery safety, data acquisition, controls, or wiring-harness reliability.",
    "recommendedTemplateId": "TPL-INKIND",
    "notes": "Official U.S. educational sales contact. This is a strong purchasing-discount and relationship lead, but support is not guaranteed as a donation.",
    "sourceUrl": "https://www.mouser.com/educationalsales/",
    "validationStatus": "OFFICIAL_ACADEMIC_CONTACT"
  },
  {
    "id": "CON-VALID-IGUS",
    "companyName": "igus",
    "contactName": "Young Engineers Support (YES) Program",
    "email": "",
    "outreachType": "FORM",
    "outreachUrl": "https://www.igus.com/info/yes-program",
    "category": "Bearings, bushings, cable management, and motion components",
    "suggestedAsk": "free or discounted bearings, bushings, cable carriers, linear components, or samples for specific EV-Kart applications",
    "eligibility": "High-school and college students, educators, and competition teams can request support; technical drawings and specifications strengthen the request.",
    "personalizationIdea": "Identify exact pivot, steering, pedal, cable-routing, or low-maintenance bearing applications and include dimensions or drawings.",
    "recommendedTemplateId": "TPL-PROGRAM",
    "notes": "Official Young Engineers Support program. The program says it responds to sponsorship requests and may ask for technical details.",
    "sourceUrl": "https://www.igus.com/info/yes-program",
    "validationStatus": "OFFICIAL_STUDENT_PROGRAM"
  },
  {
    "id": "CON-VALID-KVASER",
    "companyName": "Kvaser",
    "contactName": "University Sponsorship Program",
    "email": "",
    "outreachType": "FORM",
    "outreachUrl": "https://kvaser.com/about-us/university-sponsorships/",
    "category": "CAN bus interfaces and vehicle communications",
    "suggestedAsk": "a Kvaser CAN interface and software support for EV-Kart diagnostics, data logging, and network development",
    "eligibility": "University teams working on CAN-based projects, including Formula SAE, can submit the official application and sponsorship package.",
    "personalizationIdea": "Describe the kart\u2019s CAN architecture, nodes, data rates, logging needs, and the exact Kvaser interface that would improve testing.",
    "recommendedTemplateId": "TPL-PROGRAM",
    "notes": "Official university sponsorship form. Prepare a sponsorship PDF and a specific product or interface request.",
    "sourceUrl": "https://kvaser.com/about-us/university-sponsorships/",
    "validationStatus": "OFFICIAL_STUDENT_PROGRAM"
  },
  {
    "id": "CON-VALID-ETAS",
    "companyName": "ETAS",
    "contactName": "Formula Student Partnership",
    "email": "formulastudent@etas.com",
    "outreachType": "EMAIL",
    "outreachUrl": "https://www.etas.com/ww/en/about-etas/careers-at-etas/students/formula-student/",
    "category": "Vehicle software, measurement, and calibration",
    "suggestedAsk": "ETAS hardware, software, product training, and technical support for vehicle data, calibration, or embedded development",
    "eligibility": "The official page welcomes Formula Student teams and asks for a detailed explanation of product use and expected contribution to team success.",
    "personalizationIdea": "Map the request to telemetry, ECU calibration, diagnostics, embedded development, or validation, and name the ETAS product class of interest.",
    "recommendedTemplateId": "TPL-PROGRAM",
    "notes": "Official Formula Student partnership email and application instructions. Verify whether the Purdue EV Grand Prix team is accepted under the same program before assuming eligibility.",
    "sourceUrl": "https://www.etas.com/ww/en/about-etas/careers-at-etas/students/formula-student/",
    "validationStatus": "OFFICIAL_STUDENT_PROGRAM"
  },
  {
    "id": "CON-VALID-MICROCHIP",
    "companyName": "Microchip Technology",
    "contactName": "Academic Program",
    "email": "academic@microchip.com",
    "outreachType": "EMAIL",
    "outreachUrl": "https://www.microchip.com/en-us/education/academic-program",
    "category": "Microcontrollers, embedded systems, and development tools",
    "suggestedAsk": "academic-program guidance, development-tool samples, educational discounts, or embedded-platform support for EV-Kart controls and monitoring",
    "eligibility": "The academic program serves educators, researchers, and students; some benefits are institution- or faculty-oriented.",
    "personalizationIdea": "Describe a concrete MCU, CAN, battery-monitoring, sensing, or embedded-control use case and ask which academic benefit is the best fit.",
    "recommendedTemplateId": "TPL-PROGRAM",
    "notes": "Official academic-program contact. This is a validated education route, not a guaranteed cash sponsorship program.",
    "sourceUrl": "https://www.microchip.com/en-us/about/contact-us",
    "validationStatus": "OFFICIAL_ACADEMIC_CONTACT"
  },
  {
    "id": "CON-VALID-WURTH",
    "companyName": "W\u00fcrth Elektronik",
    "contactName": "University Support Team",
    "email": "",
    "outreachType": "FORM",
    "outreachUrl": "https://www.we-online.com/en/support/university",
    "category": "Electronic components and technical support",
    "suggestedAsk": "component samples and technical support for power electronics, EMC, connectors, magnetics, sensing, or PCB development",
    "eligibility": "The official university program supports student projects and student organizations through its contact form.",
    "personalizationIdea": "Provide a short BOM or component-family request tied to a specific board or power-electronics problem, rather than asking for miscellaneous parts.",
    "recommendedTemplateId": "TPL-PROGRAM",
    "notes": "Official university-support route offering components and technical support. Use the contact form and reference the exact application.",
    "sourceUrl": "https://www.we-online.com/en/support/university",
    "validationStatus": "OFFICIAL_STUDENT_PROGRAM"
  },
  {
    "id": "CON-VALID-DSPACE",
    "companyName": "dSPACE",
    "contactName": "University Team Support",
    "email": "",
    "outreachType": "FORM",
    "outreachUrl": "https://www.dspace.com/en/inc/home/company/corporatecitizenship/formulastudent.cfm",
    "category": "Controls, HIL, simulation, and validation",
    "suggestedAsk": "student-team support involving controls prototyping, data acquisition, simulation, or hardware-in-the-loop validation",
    "eligibility": "The official Formula Student page invites teams seeking support to contact dSPACE; product fit should be technically specific.",
    "personalizationIdea": "Explain a controls or validation challenge\u2014such as motor control, sensor fusion, data logging, or HIL testing\u2014and how dSPACE tools would be used.",
    "recommendedTemplateId": "TPL-PROGRAM",
    "notes": "Official student-team support contact route. This may be a better fit as the EV-Kart control system becomes more advanced.",
    "sourceUrl": "https://www.dspace.com/en/inc/home/company/corporatecitizenship/formulastudent.cfm",
    "validationStatus": "OFFICIAL_STUDENT_PROGRAM"
  },
  {
    "id": "CON-VALID-ALLISON",
    "companyName": "Allison Transmission",
    "contactName": "Charitable Contributions and Sponsorships",
    "email": "marketing@allisontransmission.com",
    "outreachType": "FORM",
    "outreachUrl": "https://allisontransmission.com/company/charitable-contributions",
    "category": "Indianapolis STEM and community sponsorship",
    "suggestedAsk": "a Purdue-routed STEM sponsorship supporting EV-Kart materials, student development, transportation, or public engineering outreach",
    "eligibility": "The official program requires a U.S. 501(c)(3) nonprofit and uses a defined annual submission window; coordinate through Purdue or the appropriate university foundation office.",
    "personalizationIdea": "Lead with Indianapolis workforce development, hands-on electric-vehicle engineering, measurable student outcomes, and local visibility.",
    "recommendedTemplateId": "TPL-LOCAL",
    "notes": "Official community sponsorship route. Do not submit as an informal student group if the application requires institutional nonprofit and tax documentation.",
    "sourceUrl": "https://allisontransmission.com/company/charitable-contributions",
    "validationStatus": "OFFICIAL_COMMUNITY_APPLICATION"
  },
  {
    "id": "CON-VALID-AES",
    "companyName": "AES Indiana",
    "contactName": "Community Impact Team",
    "email": "",
    "outreachType": "FORM",
    "outreachUrl": "https://www.aesindiana.com/community-application",
    "category": "Indianapolis education and workforce grant",
    "suggestedAsk": "a Purdue-routed education and workforce-development grant for EV-Kart engineering, student participation, and Indianapolis outreach",
    "eligibility": "The project must serve AES Indiana communities and the application requests legal organization, EIN, budget, outcomes, recognition, and other institutional information.",
    "personalizationIdea": "Frame the project around Indianapolis workforce development, energy and mobility education, measurable student outcomes, and opportunities for employee engagement.",
    "recommendedTemplateId": "TPL-LOCAL",
    "notes": "Official community application. Coordinate with Purdue\u2019s authorized fundraising or foundation process before submitting institutional data.",
    "sourceUrl": "https://www.aesindiana.com/community-application",
    "validationStatus": "OFFICIAL_COMMUNITY_APPLICATION"
  }
];

const DEFAULT_PLANNER_TEAMS = [
  { id: 'TEAM-CLUB', name: 'Club-wide', description: 'Shared milestones, race deadlines, design reviews, testing windows, and cross-team commitments.', icon: 'ASME' },
  { id: 'TEAM-MECH', name: 'Mechanical Design', description: 'CAD, chassis interfaces, steering, brakes, packaging, mounts, structures, and mechanical validation.', icon: 'MECH' },
  { id: 'TEAM-KART', name: 'Kart Setup', description: 'Assembly, alignment, track setup, ergonomics, tires, brakes, handling, inspection, and race-day readiness.', icon: 'KART' },
  { id: 'TEAM-ELEC', name: 'Wiring Harness', description: 'Harness architecture, schematics, connectors, safety circuits, sensors, routing, documentation, and validation.', icon: 'WIRE' },
  { id: 'TEAM-BATT', name: 'Battery', description: 'Cells, containment, busbars, BMS, thermal work, safety review, testing, and pack integration.', icon: 'BATT' },
  { id: 'TEAM-SOFTWARE', name: 'Software', description: 'Telemetry, embedded code, dashboards, data acquisition, analysis, controls, and test tooling.', icon: 'SW' },
  { id: 'TEAM-MFG', name: 'Manufacturing Lead', description: 'Design-for-manufacture review, drawings, CAM, sourcing, fabrication, inspection, rework, and incoming parts.', icon: 'MFG' },
  { id: 'TEAM-OPS', name: 'Finance & Sponsorship', description: 'Purdue funding, sponsor outreach, budgets, purchasing controls, stewardship, travel, and operational reporting.', icon: 'FIN' }
];

const DEFAULT_PLANNER_BOARDS = [
  { id: 'BOARD-CLUB-MASTER', teamId: 'TEAM-CLUB', name: 'Club-wide Master Timeline', description: 'Major deliverables, race dates, design reviews, integration gates, testing windows, and cross-team handoffs.' },
  { id: 'BOARD-MECH-ROADMAP', teamId: 'TEAM-MECH', name: 'Mechanical Design Roadmap', description: 'Plan CAD, reviews, releases, structural work, packaging, fabrication handoffs, assembly, and validation.' },
  { id: 'BOARD-KART-ROADMAP', teamId: 'TEAM-KART', name: 'Kart Setup & Track Readiness', description: 'Coordinate assembly, setup sheets, alignment, inspection, shakedown testing, transport, and race-day readiness.' },
  { id: 'BOARD-ELEC-ROADMAP', teamId: 'TEAM-ELEC', name: 'Wiring Harness Redesign', description: 'Coordinate requirements, schematics, connector selection, routing, fabrication, continuity testing, and vehicle integration.' },
  { id: 'BOARD-BATT-ROADMAP', teamId: 'TEAM-BATT', name: 'Battery Development Roadmap', description: 'Track architecture, safety analysis, procurement, fabrication, BMS integration, validation, and pack commissioning.' },
  { id: 'BOARD-SOFTWARE-ROADMAP', teamId: 'TEAM-SOFTWARE', name: 'Software & Data Systems', description: 'Plan embedded software, telemetry, dashboards, sensor validation, data analysis, and trackside tooling.' },
  { id: 'BOARD-MFG-PARTS', teamId: 'TEAM-MFG', name: 'Manufacturing & Fabrication Pipeline', description: 'See which designs need review, drawings, material, quotes, fabrication, inspection, rework, and receipt.' },
  { id: 'BOARD-OPS-ROADMAP', teamId: 'TEAM-OPS', name: 'Purdue Funding & Sponsorship Calendar', description: 'A research-backed timeline of Purdue funding programs, application work, sponsor activity, budgets, and stewardship.', targetStart: '2026-08-01', targetEnd: '2027-05-15' }
];

const DEFAULT_FUNDING_TASKS = [
  {
    "id": "FUND-READINESS",
    "boardId": "BOARD-OPS-ROADMAP",
    "title": "Build the 2026\u201327 funding readiness packet",
    "description": "Internal prerequisite. Create one reusable package before pursuing grants: current club purpose, officer roster, advisor confirmation, project narrative, measurable student impact, itemized budget, alternative funding sources, current account statements, timeline, photos, and a one-page impact summary. Confirm the club is active and in good standing before any submission.",
    "status": "PLANNED",
    "priority": "CRITICAL",
    "ownerNames": "Finance Team",
    "startDate": "2026-08-01",
    "dueDate": "2026-08-21",
    "progress": "0",
    "isMilestone": "false",
    "tags": "finance, readiness, budget, Purdue",
    "taskType": "WORK",
    "campus": "Indianapolis / Purdue-wide",
    "fundingMin": "",
    "fundingMax": "",
    "fundingAmountLabel": "Prerequisite \u2014 no direct award",
    "sourceUrl": "https://www.purdue.edu/business/boso/manual/salesTax.php",
    "sourceConfidence": "OFFICIAL_CURRENT",
    "requirements": "President and treasurer should review Purdue student-organization financial requirements. Keep contracts, purchases, deposits, reimbursements, and gift handling within the approved Purdue process. Ask Indianapolis Student & Community Engagement which financial office/process applies to your organization.",
    "partName": "",
    "partNumber": "",
    "vendor": "",
    "quantity": "",
    "estimatedCost": "",
    "orderStatus": "NOT_NEEDED",
    "dependencyIds": "[]"
  },
  {
    "id": "FUND-INDY-INVENTORY",
    "boardId": "BOARD-OPS-ROADMAP",
    "title": "Confirm Purdue Indianapolis student-organization funding channels",
    "description": "Public Purdue Indianapolis pages describe Student & Community Engagement but do not currently publish a complete student-organization grant catalog or dollar caps. Use this task to obtain the current Indianapolis funding inventory, application routes, activity-fee eligibility, and officer training requirements directly from campus staff and the PSG Vice President Indianapolis. This is an internal target, not a published grant deadline.",
    "status": "PLANNED",
    "priority": "CRITICAL",
    "ownerNames": "Finance Team",
    "startDate": "2026-08-03",
    "dueDate": "2026-08-28",
    "progress": "0",
    "isMilestone": "true",
    "tags": "Indianapolis, Purdue, verification, finance",
    "taskType": "FUNDING",
    "campus": "Indianapolis",
    "fundingMin": "",
    "fundingMax": "",
    "fundingAmountLabel": "Amount not publicly posted",
    "sourceUrl": "https://www.purdue.edu/indianapolis/office-of-student-and-community-engagement/",
    "sourceConfidence": "CONTACT_REQUIRED",
    "requirements": "Ask for: current grant names; dollar limits; eligible expenses; application windows; whether SOGA/SFAB/PESC apply to Indianapolis organizations; how donations and contracts are processed; and the correct staff contact. Record the written response in a task comment.",
    "partName": "",
    "partNumber": "",
    "vendor": "",
    "quantity": "",
    "estimatedCost": "",
    "orderStatus": "NOT_NEEDED",
    "dependencyIds": "[\"FUND-READINESS\"]"
  },
  {
    "id": "FUND-PESC-MERIT",
    "boardId": "BOARD-OPS-ROADMAP",
    "title": "PESC / PEPC Merit Fund \u2014 confirm next engineering-organization cycle",
    "description": "PESC says Merit Fund is typically offered in fall and spring for student-run Purdue engineering organizations. It supports one-time future project costs tied to engineering impact; past guidance excludes catering social events and logo wear. The 2026 application is currently closed, so the dates below are internal monitoring targets rather than an official deadline.",
    "status": "PLANNED",
    "priority": "HIGH",
    "ownerNames": "Finance Team",
    "startDate": "2026-08-10",
    "dueDate": "2026-09-04",
    "progress": "0",
    "isMilestone": "false",
    "tags": "PESC, PEPC, engineering, grant, verify cycle",
    "taskType": "FUNDING",
    "campus": "Purdue Engineering \u2014 confirm Indianapolis eligibility",
    "fundingMin": "",
    "fundingMax": "",
    "fundingAmountLabel": "Variable; no public award cap",
    "sourceUrl": "https://www.purdueesc.org/scholarships",
    "sourceConfidence": "OFFICIAL_NO_CURRENT_DEADLINE",
    "requirements": "Confirm Indianapolis eligibility with PESC/PEPC. Prepare a one-time project-cost request, engineering impact statement, itemized budget, interview talking points, and evidence the project builds engineering knowledge or interest. A 2023 Purdue report said 21 organizations shared $12,600 and requests ranged from $300 to $8,700; that is historical context, not a current cap.",
    "partName": "",
    "partNumber": "",
    "vendor": "",
    "quantity": "",
    "estimatedCost": "",
    "orderStatus": "NOT_NEEDED",
    "dependencyIds": "[\"FUND-READINESS\"]"
  },
  {
    "id": "FUND-SOGA",
    "boardId": "BOARD-OPS-ROADMAP",
    "title": "SOGA \u2014 verify the 2026\u201327 cycle before preparing an application",
    "description": "SOGA supports West Lafayette student organizations registered with Student Activities & Organizations. Purdue guidance lists grants of $8,000 or less. Campus-open events are prioritized most; equipment and supplies are lowest in the published priority order. The public page currently shows the last 2025\u201326 period deadline (March 30, 2026), so this task uses an internal check date until 2026\u201327 dates are posted.",
    "status": "PLANNED",
    "priority": "HIGH",
    "ownerNames": "Finance Team",
    "startDate": "2026-08-10",
    "dueDate": "2026-09-04",
    "progress": "0",
    "isMilestone": "false",
    "tags": "SOGA, West Lafayette, grant, verify cycle",
    "taskType": "FUNDING",
    "campus": "West Lafayette only",
    "fundingMin": "",
    "fundingMax": "8000",
    "fundingAmountLabel": "Up to $8,000",
    "sourceUrl": "https://purdue.campuslabs.com/engage/organization/soga",
    "sourceConfidence": "OFFICIAL_NO_CURRENT_DEADLINE",
    "requirements": "Confirm whether the Indianapolis club is eligible or must partner with a West Lafayette organization. Apply through the organization finance page. Build a student-community benefit case and itemized budget. Purdue AAE guidance says organizations should not receive both SOGA and SFAB funding for the same cycle/request; verify the current rule in the guidelines.",
    "partName": "",
    "partNumber": "",
    "vendor": "",
    "quantity": "",
    "estimatedCost": "",
    "orderStatus": "NOT_NEEDED",
    "dependencyIds": "[\"FUND-READINESS\",\"FUND-INDY-INVENTORY\"]"
  },
  {
    "id": "FUND-SERVICE-LEARNING",
    "boardId": "BOARD-OPS-ROADMAP",
    "title": "Community Service / Service-Learning Student Grant",
    "description": "Purdue's Office of Engagement has funded student and student-organization projects conducted with communities, nonprofits, schools, or government partners. Purdue guidance lists up to $1,500 for a team or organization and has stated that students from regional campuses may apply. A current 2026\u201327 deadline was not publicly posted when this timeline was validated; the due date is an internal concept-development target.",
    "status": "PLANNED",
    "priority": "HIGH",
    "ownerNames": "Finance Team",
    "startDate": "2026-08-17",
    "dueDate": "2026-10-01",
    "progress": "0",
    "isMilestone": "false",
    "tags": "service learning, Indianapolis, engagement, grant",
    "taskType": "FUNDING",
    "campus": "Purdue-wide; regional campuses included in published guidance",
    "fundingMin": "100",
    "fundingMax": "1500",
    "fundingAmountLabel": "$100\u2013$1,500",
    "sourceUrl": "https://www.purdue.edu/newsroom/purduetoday/releases/2022/Q3/grants-available-to-students-for-community-service-projects.html",
    "sourceConfidence": "OFFICIAL_NO_CURRENT_DEADLINE",
    "requirements": "Identify a real community partner and co-defined need. Describe how students use engineering knowledge to provide a service, the learning outcomes, community impact, budget, dates, partner role, and evaluation plan. Contact Purdue Engagement to confirm the current application window and whether an EV/mobility, K\u201312, or community engineering project fits.",
    "partName": "",
    "partNumber": "",
    "vendor": "",
    "quantity": "",
    "estimatedCost": "",
    "orderStatus": "NOT_NEEDED",
    "dependencyIds": "[\"FUND-READINESS\"]"
  },
  {
    "id": "FUND-PSG-COSPONSOR",
    "boardId": "BOARD-OPS-ROADMAP",
    "title": "PSG Co-Sponsorship Award \u2014 verify current availability",
    "description": "An official Purdue engineering funding guide describes PSG co-sponsorship awards of up to $500 for equipment, food, travel, or space tied to an event, with applications recommended at least four weeks in advance. This information is older and a current public application page was not found, so do not count this as open until PSG confirms it.",
    "status": "BACKLOG",
    "priority": "MEDIUM",
    "ownerNames": "Finance Team",
    "startDate": "2026-08-17",
    "dueDate": "2026-09-11",
    "progress": "0",
    "isMilestone": "false",
    "tags": "PSG, event, co-sponsorship, verify",
    "taskType": "FUNDING",
    "campus": "West Lafayette \u2014 confirm Indianapolis access",
    "fundingMin": "",
    "fundingMax": "500",
    "fundingAmountLabel": "Historically up to $500; verify current program",
    "sourceUrl": "https://engineering.purdue.edu/AAE/foryou/currentstudents/student-org-funding-sources",
    "sourceConfidence": "VERIFY_CURRENT",
    "requirements": "Email Purdue Student Government and ask whether the award still exists, who is eligible, current categories, application route, meeting schedule, lead time, and whether Indianapolis organizations can apply. Only move this task to Planned after written confirmation.",
    "partName": "",
    "partNumber": "",
    "vendor": "",
    "quantity": "",
    "estimatedCost": "",
    "orderStatus": "NOT_NEEDED",
    "dependencyIds": "[\"FUND-INDY-INVENTORY\"]"
  },
  {
    "id": "FUND-PSG-JOINT",
    "boardId": "BOARD-OPS-ROADMAP",
    "title": "PSG Joint-Network Co-Sponsorship \u2014 verify current program",
    "description": "An official Purdue engineering funding guide describes joint-network awards between $500 and $2,500 for collaborative events benefiting the Purdue community, with substantial planning and audit involvement. Current public availability was not confirmed, so this is a verification task rather than an active application.",
    "status": "BACKLOG",
    "priority": "LOW",
    "ownerNames": "Finance Team",
    "startDate": "2026-08-17",
    "dueDate": "2026-09-11",
    "progress": "0",
    "isMilestone": "false",
    "tags": "PSG, collaboration, event, verify",
    "taskType": "FUNDING",
    "campus": "West Lafayette \u2014 confirm Indianapolis access",
    "fundingMin": "500",
    "fundingMax": "2500",
    "fundingAmountLabel": "Historically $500\u2013$2,500; verify current program",
    "sourceUrl": "https://engineering.purdue.edu/AAE/foryou/currentstudents/student-org-funding-sources",
    "sourceConfidence": "VERIFY_CURRENT",
    "requirements": "Identify a partner organization and a campus-benefit event concept, then ask PSG whether the program is currently active, whether Indianapolis organizations qualify, and what Senate/meeting lead time applies.",
    "partName": "",
    "partNumber": "",
    "vendor": "",
    "quantity": "",
    "estimatedCost": "",
    "orderStatus": "NOT_NEEDED",
    "dependencyIds": "[\"FUND-INDY-INVENTORY\"]"
  },
  {
    "id": "FUND-CROWDFUNDING",
    "boardId": "BOARD-OPS-ROADMAP",
    "title": "Purdue for Life crowdfunding campaign intake",
    "description": "Purdue for Life operates a Purdue crowdfunding platform used by student clubs and projects. Public pages provide a contact route but do not publish a standard award or campaign cap. Treat the date as an internal outreach target and ask Purdue for Life whether ASME Indy can launch a campaign, what fund designation is required, and what approvals and content are needed.",
    "status": "PLANNED",
    "priority": "HIGH",
    "ownerNames": "Finance Team",
    "startDate": "2026-09-01",
    "dueDate": "2026-09-30",
    "progress": "0",
    "isMilestone": "false",
    "tags": "crowdfunding, Purdue for Life, alumni, Indianapolis",
    "taskType": "FUNDING",
    "campus": "Purdue-wide; confirm organization onboarding",
    "fundingMin": "",
    "fundingMax": "",
    "fundingAmountLabel": "Variable / donor-driven",
    "sourceUrl": "https://crowdfunding.purdue.edu/about",
    "sourceConfidence": "CONTACT_REQUIRED",
    "requirements": "Contact crowdfunding@purdueforlife.org. Ask about eligibility, fund/account setup, campaign length, approval lead time, gift processing, tax receipts, donor data access, images/video requirements, matching gifts, and post-campaign stewardship. Prepare a specific funding goal and donor story before intake.",
    "partName": "",
    "partNumber": "",
    "vendor": "",
    "quantity": "",
    "estimatedCost": "",
    "orderStatus": "NOT_NEEDED",
    "dependencyIds": "[\"FUND-READINESS\"]"
  },
  {
    "id": "FUND-PDOG",
    "boardId": "BOARD-OPS-ROADMAP",
    "title": "Purdue Day of Giving 2027 participation plan",
    "description": "Purdue Day of Giving is a 24-hour online fundraiser with unit and student-organization participation, donor leaderboards, and challenge bonus money. An Autonomous RC Club at Purdue Indy had a 2026 campaign page, demonstrating Indianapolis student-team participation. The 2027 event date and onboarding deadline were not posted when validated; these are internal preparation dates.",
    "status": "PLANNED",
    "priority": "HIGH",
    "ownerNames": "Finance Team",
    "startDate": "2026-10-01",
    "dueDate": "2026-12-15",
    "progress": "0",
    "isMilestone": "false",
    "tags": "Purdue Day of Giving, alumni, fundraising, Indianapolis",
    "taskType": "FUNDING",
    "campus": "West Lafayette and Indianapolis participation observed",
    "fundingMin": "10",
    "fundingMax": "",
    "fundingAmountLabel": "Variable donations + challenge bonuses; $10 minimum gift in 2026",
    "sourceUrl": "https://dayofgiving.purdue.edu/info/faq",
    "sourceConfidence": "OFFICIAL_NO_CURRENT_DEADLINE",
    "requirements": "Contact purduedayofgiving@purdue.edu to confirm 2027 participation and onboarding. Secure the proper fund designation, define a public goal, prepare photos/video and impact metrics, build an alumni/family contact plan, assign challenge monitoring, and schedule donor thank-yous. Do not promise a challenge award; bonus amounts depend on that year's rules and leaderboard results.",
    "partName": "",
    "partNumber": "",
    "vendor": "",
    "quantity": "",
    "estimatedCost": "",
    "orderStatus": "NOT_NEEDED",
    "dependencyIds": "[\"FUND-READINESS\",\"FUND-CROWDFUNDING\"]"
  },
  {
    "id": "FUND-SFAB-APP",
    "boardId": "BOARD-OPS-ROADMAP",
    "title": "SFAB 2027 application \u2014 select a $15,000\u2013$100,000 student-body impact request",
    "description": "The current SFAB page says the application will be available by November 1, 2026 and is due February 1, 2027 at 11:55 p.m. One application is allowed per organization/department, with a minimum request of $15,000 and maximum of $100,000. This is the largest verified internal opportunity in this timeline, but it is designed for broad undergraduate student impact rather than routine club operating costs.",
    "status": "PLANNED",
    "priority": "CRITICAL",
    "ownerNames": "Finance Team",
    "startDate": "2026-11-01",
    "dueDate": "2027-02-01",
    "progress": "0",
    "isMilestone": "false",
    "tags": "SFAB, West Lafayette, major grant, official deadline",
    "taskType": "FUNDING",
    "campus": "West Lafayette undergraduate student-fee program",
    "fundingMin": "15000",
    "fundingMax": "100000",
    "fundingAmountLabel": "$15,000\u2013$100,000",
    "sourceUrl": "https://boilerlink.purdue.edu/organization/sfab",
    "sourceConfidence": "OFFICIAL_CURRENT",
    "requirements": "Email sfab@purdue.edu for the current guidelines. Define a request with student body-wide value, measurable outcomes, sustainable ownership, detailed quotes/budget, and a strong presentation case. Confirm campus and organization eligibility before investing heavily. Purdue AAE guidance says SFAB and SOGA funding should not be combined; verify the current restriction.",
    "partName": "",
    "partNumber": "",
    "vendor": "",
    "quantity": "",
    "estimatedCost": "",
    "orderStatus": "NOT_NEEDED",
    "dependencyIds": "[\"FUND-READINESS\",\"FUND-INDY-INVENTORY\"]"
  },
  {
    "id": "FUND-SFAB-SUPPORT",
    "boardId": "BOARD-OPS-ROADMAP",
    "title": "SFAB supporting files \u2014 deck, letters, and account statements",
    "description": "Current SFAB instructions require PowerPoint files by February 5, 2027 at 5:00 p.m. via attachment. Letters of support for capital improvements and/or bank statements are also due at that time. The published account-statement window is July 1, 2025 through December 31, 2026. Missing required materials can jeopardize funding.",
    "status": "PLANNED",
    "priority": "CRITICAL",
    "ownerNames": "Finance Team",
    "startDate": "2027-02-02",
    "dueDate": "2027-02-05",
    "progress": "0",
    "isMilestone": "true",
    "tags": "SFAB, presentation, documents, official deadline",
    "taskType": "WORK",
    "campus": "West Lafayette",
    "fundingMin": "",
    "fundingMax": "",
    "fundingAmountLabel": "Supports $15,000\u2013$100,000 application",
    "sourceUrl": "https://boilerlink.purdue.edu/organization/sfab",
    "sourceConfidence": "OFFICIAL_CURRENT",
    "requirements": "Submit the deck as a PowerPoint attachment, not a link. Include the exact required letters/account statements, verify every quote and total, and retain delivery confirmation. Assign one officer to final compliance review before 5:00 p.m.",
    "partName": "",
    "partNumber": "",
    "vendor": "",
    "quantity": "",
    "estimatedCost": "",
    "orderStatus": "NOT_NEEDED",
    "dependencyIds": "[\"FUND-SFAB-APP\"]"
  },
  {
    "id": "FUND-SFAB-PRESENT",
    "boardId": "BOARD-OPS-ROADMAP",
    "title": "SFAB presentation and Q&A readiness",
    "description": "SFAB presentations are scheduled for a weekend in February 2027; the exact date was not yet announced. The public page says the presentation schedule will be sent by the end of the business day February 8, 2027. This task uses a February window and should be updated when the official slot arrives.",
    "status": "PLANNED",
    "priority": "CRITICAL",
    "ownerNames": "Finance Team",
    "startDate": "2027-02-06",
    "dueDate": "2027-02-28",
    "progress": "0",
    "isMilestone": "true",
    "tags": "SFAB, presentation, Q&A",
    "taskType": "MEETING",
    "campus": "West Lafayette",
    "fundingMin": "",
    "fundingMax": "",
    "fundingAmountLabel": "Decision stage for $15,000\u2013$100,000 request",
    "sourceUrl": "https://boilerlink.purdue.edu/organization/sfab",
    "sourceConfidence": "OFFICIAL_CURRENT",
    "requirements": "Rehearse a concise problem, student impact, implementation, budget, stewardship, risk, and sustainability narrative. Prepare answers on who benefits, why this cannot be covered by current funds, quotes, ongoing costs, ownership, storage, maintenance, and evaluation.",
    "partName": "",
    "partNumber": "",
    "vendor": "",
    "quantity": "",
    "estimatedCost": "",
    "orderStatus": "NOT_NEEDED",
    "dependencyIds": "[\"FUND-SFAB-SUPPORT\"]"
  },
  {
    "id": "FUND-STEWARDSHIP",
    "boardId": "BOARD-OPS-ROADMAP",
    "title": "Award closeout, sponsor stewardship, and impact reporting system",
    "description": "Create one closeout workflow for every Purdue award and donor-funded campaign: approval documentation, restricted-use tracking, receipts, before/after photos, student participation, technical outputs, thank-you messages, sponsor benefits, and a concise impact report. This reduces audit risk and improves future applications.",
    "status": "BACKLOG",
    "priority": "HIGH",
    "ownerNames": "Finance Team",
    "startDate": "2027-03-01",
    "dueDate": "2027-05-15",
    "progress": "0",
    "isMilestone": "false",
    "tags": "stewardship, reporting, finance, impact",
    "taskType": "WORK",
    "campus": "Purdue-wide",
    "fundingMin": "",
    "fundingMax": "",
    "fundingAmountLabel": "Protects all awarded funds",
    "sourceUrl": "https://www.purdue.edu/business/boso/manual/salesTax.php",
    "sourceConfidence": "OFFICIAL_CURRENT",
    "requirements": "For each award, record restrictions, approved budget, spending route, receipts, deliverables, recognition promises, reporting dates, responsible officer, and fund balance. Store public-safe impact evidence separately from confidential financial records.",
    "partName": "",
    "partNumber": "",
    "vendor": "",
    "quantity": "",
    "estimatedCost": "",
    "orderStatus": "NOT_NEEDED",
    "dependencyIds": "[]"
  }
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SponsorFlow')
    .addItem('Initial setup', 'showInitialSetup')
    .addItem('Upgrade to v5 + team planner & funding calendar', 'upgradeSponsorFlowV5')
    .addItem('Import or refresh validated sponsors', 'seedValidatedSponsors')
    .addItem('Refresh polished templates', 'refreshPolishedTemplates')
    .addItem('Change admin password', 'showChangeAdminPassword')
    .addItem('Change GitHub Pages origin', 'showChangeFrontendOrigin')
    .addSeparator()
    .addItem('Open admin dashboard', 'openAdminDashboard')
    .addToUi();
}

function showInitialSetup() {
  const ui = SpreadsheetApp.getUi();
  const passwordPrompt = ui.prompt(
    'SponsorFlow initial setup',
    'Create one strong admin password (at least 14 characters). It will be hashed and will not be saved in the sheet.',
    ui.ButtonSet.OK_CANCEL
  );
  if (passwordPrompt.getSelectedButton() !== ui.Button.OK) return;

  const originPrompt = ui.prompt(
    'GitHub Pages origin',
    'Enter only the origin, such as https://yourusername.github.io (do not include the repository path).',
    ui.ButtonSet.OK_CANCEL
  );
  if (originPrompt.getSelectedButton() !== ui.Button.OK) return;

  setupSponsorFlow_();
  setAdminPassword_(passwordPrompt.getResponseText());
  setFrontendOrigin_(originPrompt.getResponseText());
  refreshDefaultTemplates_();
  seedValidatedSponsors_();
  seedDefaultPlannerStructure_();
  ui.alert('SponsorFlow setup is complete. Sponsor opportunities, team workspaces, analytics, and the Purdue funding calendar were added. Next, deploy this script as a web app.');
}

function upgradeSponsorFlowV5() {
  setupSponsorFlow_();
  refreshDefaultTemplates_();
  const sponsorResult = seedValidatedSponsors_();
  const plannerResult = seedDefaultPlannerStructure_();
  SpreadsheetApp.getUi().alert(
    `SponsorFlow was upgraded to version 5. Existing sponsor and planner data were preserved. ` +
    `${plannerResult.teamsCreated} teams were added, ${plannerResult.teamsUpdated} default teams were polished, ` +
    `${plannerResult.boardsCreated} timelines were added, ${plannerResult.boardsUpdated} default timelines were polished, ` +
    `and ${plannerResult.tasksCreated} funding tasks were added / ${plannerResult.tasksUpdated} research records refreshed. ` +
    `${sponsorResult.created} sponsor opportunities were added and ${sponsorResult.updated} refreshed.`
  );
}

function upgradeSponsorFlowV4() {
  setupSponsorFlow_();
  refreshDefaultTemplates_();
  const sponsorResult = seedValidatedSponsors_();
  const plannerResult = seedDefaultPlannerStructure_();
  SpreadsheetApp.getUi().alert(
    `SponsorFlow was upgraded to version 4. Existing sponsor data was preserved. ` +
    `${sponsorResult.created} sponsor opportunities were added, ${sponsorResult.updated} were refreshed, ` +
    `and ${plannerResult.teamsCreated} teams / ${plannerResult.boardsCreated} timelines were created where missing.`
  );
}

function upgradeSponsorFlowV3() {
  setupSponsorFlow_();
  refreshDefaultTemplates_();
  const result = seedValidatedSponsors_();
  SpreadsheetApp.getUi().alert(
    `SponsorFlow was upgraded to version 3. Existing data was preserved. ` +
    `${result.created} sponsor opportunities were added and ${result.updated} were refreshed.`
  );
}

function seedValidatedSponsors() {
  setupSponsorFlow_();
  const result = seedValidatedSponsors_();
  SpreadsheetApp.getUi().alert(
    `Validated sponsor research refreshed: ${result.created} added, ${result.updated} updated, ${result.skipped} preserved.`
  );
}

function refreshPolishedTemplates() {
  setupSponsorFlow_();
  refreshDefaultTemplates_();
  SpreadsheetApp.getUi().alert('The six built-in templates were refreshed. Custom templates were not changed.');
}

function showChangeAdminPassword() {
  const ui = SpreadsheetApp.getUi();
  const prompt = ui.prompt('Change admin password', 'Enter a new password with at least 14 characters.', ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  setAdminPassword_(prompt.getResponseText());
  ui.alert('The admin password was changed. Existing admin sessions will expire within one hour.');
}

function showChangeFrontendOrigin() {
  const ui = SpreadsheetApp.getUi();
  const current = PropertiesService.getScriptProperties().getProperty('FRONTEND_ORIGIN') || '';
  const prompt = ui.prompt('Change GitHub Pages origin', `Current: ${current}\n\nEnter an origin such as https://yourusername.github.io`, ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  setFrontendOrigin_(prompt.getResponseText());
  ui.alert('The allowed frontend origin was updated.');
}

function openAdminDashboard() {
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert('Deploy the script as a web app first.');
    return;
  }
  const html = HtmlService.createHtmlOutput(`<script>window.open(${JSON.stringify(url + '?view=admin')}, '_blank');google.script.host.close();</script>`)
    .setWidth(10).setHeight(10);
  SpreadsheetApp.getUi().showModalDialog(html, 'Opening SponsorFlow');
}

function doGet(e) {
  if (e && e.parameter && e.parameter.view === 'admin') {
    return HtmlService.createHtmlOutputFromFile('Admin')
      .setTitle('ASME Indy SponsorFlow Admin')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return ContentService.createTextOutput('ASME Indy SponsorFlow data service is running.');
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  const origin = String(p.origin || '');
  const callId = String(p.callId || '');
  try {
    validateFrontendOrigin_(origin);
    ensureConfigured_();
    let data;
    switch (p.action) {
      case 'bootstrap': data = publicBootstrap_(); break;
      case 'checkSponsorHistory': data = checkSponsorHistory_(p); break;
      case 'createRequest': data = createRequest_(p); break;
      case 'getRequestsByName': data = getRequestsByName_(p); break;
      case 'getRequestByName': data = getRequestByName_(p); break;
      case 'reviseRequest': data = reviseRequest_(p); break;
      case 'plannerBootstrap': data = plannerBootstrap_(); break;
      case 'savePlannerTeam': data = savePlannerTeam_(p); break;
      case 'savePlannerBoard': data = savePlannerBoard_(p); break;
      case 'savePlannerTask': data = savePlannerTask_(p); break;
      case 'movePlannerTask': data = movePlannerTask_(p); break;
      case 'archivePlannerTask': data = archivePlannerTask_(p); break;
      case 'getPlannerTaskDetail': data = getPlannerTaskDetail_(p); break;
      case 'addPlannerComment': data = addPlannerComment_(p); break;
      default: throw new Error('Unknown SponsorFlow action.');
    }
    return bridgeResponse_(origin, callId, { ok: true, data: data });
  } catch (error) {
    return bridgeResponse_(origin, callId, { ok: false, error: cleanError_(error) });
  }
}

function setupSponsorFlow_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  if (active) props.setProperty('SPREADSHEET_ID', active.getId());
  if (!props.getProperty('SPREADSHEET_ID')) throw new Error('SponsorFlow must be bound to a Google Sheet.');
  if (!props.getProperty('APP_SALT')) props.setProperty('APP_SALT', Utilities.getUuid() + Utilities.getUuid());
  ensureSchema_();
}

function ensureSchema_() {
  const spreadsheet = spreadsheet_();
  Object.keys(SF.HEADERS).forEach(name => ensureSheet_(spreadsheet, name, SF.HEADERS[name]));
  if (sheet_(SF.SHEETS.TEMPLATES).getLastRow() <= 1) refreshDefaultTemplates_();
  PropertiesService.getScriptProperties().setProperty('SCHEMA_VERSION', SF.VERSION);
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0].filter(Boolean);
    const missing = headers.filter(header => existing.indexOf(header) === -1);
    if (missing.length) sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
  const columnCount = sheet.getLastColumn();
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columnCount).setFontWeight('bold').setBackground('#cfb991');
  sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 2), columnCount).setNumberFormat('@');
}

function refreshDefaultTemplates_() {
  const now = nowIso_();
  DEFAULT_TEMPLATES.forEach(template => {
    const record = Object.assign({}, template, { active: String(template.active), updatedAt: now });
    const existing = findObjectById_(SF.SHEETS.TEMPLATES, template.id);
    if (existing) updateObjectById_(SF.SHEETS.TEMPLATES, template.id, record);
    else appendObject_(SF.SHEETS.TEMPLATES, Object.assign({}, record, { createdAt: now }));
  });
  PropertiesService.getScriptProperties().setProperty('DEFAULT_TEMPLATE_VERSION', SF.VERSION);
}

function seedValidatedSponsors_() {
  const now = nowIso_();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  VALIDATED_SPONSORS.forEach(sponsor => {
    const existing = findObjectById_(SF.SHEETS.CONTACTS, sponsor.id);
    const record = Object.assign({}, sponsor, {
      validatedAt: SF.RESEARCH_VALIDATED_AT,
      updatedAt: now
    });

    if (existing) {
      // Keep an officer's active/verified choices while refreshing official research.
      record.verified = String(toBool_(existing.verified));
      record.active = String(toBool_(existing.active));
      updateObjectById_(SF.SHEETS.CONTACTS, sponsor.id, record);
      updated += 1;
    } else {
      record.verified = 'true';
      record.active = 'true';
      record.createdAt = now;
      appendObject_(SF.SHEETS.CONTACTS, record);
      created += 1;
    }
  });

  PropertiesService.getScriptProperties().setProperty('VALIDATED_SPONSOR_VERSION', SF.RESEARCH_VALIDATED_AT);
  return { created: created, updated: updated, skipped: skipped };
}


function setAdminPassword_(password) {
  password = String(password || '');
  if (password.length < 14) throw new Error('The admin password must contain at least 14 characters.');
  const props = PropertiesService.getScriptProperties();
  const salt = Utilities.getUuid() + Utilities.getUuid();
  props.setProperties({ ADMIN_PASSWORD_SALT: salt, ADMIN_PASSWORD_HASH: sha256_(salt + password) });
}

function setFrontendOrigin_(origin) {
  origin = String(origin || '').trim().replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)) {
    throw new Error('Enter an HTTPS origin only, such as https://yourusername.github.io');
  }
  PropertiesService.getScriptProperties().setProperty('FRONTEND_ORIGIN', origin);
}

function ensureConfigured_() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SPREADSHEET_ID') || !props.getProperty('ADMIN_PASSWORD_HASH') || !props.getProperty('FRONTEND_ORIGIN')) {
    throw new Error('SponsorFlow has not completed initial setup. Open the Google Sheet and use SponsorFlow → Initial setup.');
  }
  if (props.getProperty('SCHEMA_VERSION') !== SF.VERSION) ensureSchema_();
}

function validateFrontendOrigin_(origin) {
  const allowed = PropertiesService.getScriptProperties().getProperty('FRONTEND_ORIGIN');
  const isLocalPreview = /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
  if (!allowed || (origin !== allowed && !isLocalPreview)) throw new Error('This website is not allowed to use the SponsorFlow data service.');
}

function bridgeResponse_(origin, callId, payload) {
  const message = Object.assign({ type: 'sponsorflow-api', callId: callId }, payload);
  const safeMessage = JSON.stringify(message).replace(/</g, '\\u003c');
  const safeOrigin = JSON.stringify(origin).replace(/</g, '\\u003c');
  return HtmlService
    .createHtmlOutput(`<!doctype html><meta charset="utf-8"><script>window.top.postMessage(${safeMessage},${safeOrigin});</script>`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function publicBootstrap_() {
  const requests = readObjects_(SF.SHEETS.REQUESTS);
  const contacts = readObjects_(SF.SHEETS.CONTACTS)
    .filter(row => toBool_(row.verified) && toBool_(row.active))
    .map(row => {
      const history = sponsorHistory_(requests, {
        contactId: row.id,
        companyName: row.companyName,
        contactEmail: row.email
      });
      return {
        id: row.id,
        companyName: row.companyName,
        contactName: row.contactName,
        category: row.category,
        outreachType: outreachType_(row),
        outreachUrl: row.outreachUrl || '',
        suggestedAsk: row.suggestedAsk || '',
        eligibility: row.eligibility || '',
        personalizationIdea: row.personalizationIdea || '',
        recommendedTemplateId: row.recommendedTemplateId || '',
        validationStatus: row.validationStatus || '',
        validatedAt: row.validatedAt || '',
        sourceUrl: row.sourceUrl || '',
        history: history
      };
    })
    .sort((a, b) => {
      const aPriority = a.history.activeCount > 0 ? 2 : a.history.sentCount > 0 ? 1 : 0;
      const bPriority = b.history.activeCount > 0 ? 2 : b.history.sentCount > 0 ? 1 : 0;
      return aPriority - bPriority || a.companyName.localeCompare(b.companyName);
    });
  const templates = readObjects_(SF.SHEETS.TEMPLATES)
    .filter(row => toBool_(row.active))
    .map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      subjectTemplate: row.subjectTemplate,
      bodyTemplate: row.bodyTemplate
    }));
  return {
    contacts: contacts,
    templates: templates,
    stats: buildPublicStats_(requests),
    memberNames: memberNames_(requests),
    version: SF.VERSION,
    researchValidatedAt: SF.RESEARCH_VALIDATED_AT
  };
}

function checkSponsorHistory_(p) {
  const companyName = optionalText_(p.companyName, 160);
  const rawEmail = String(p.contactEmail || '').trim();
  const contactEmail = rawEmail ? requireEmail_(rawEmail) : '';
  if (!companyName && !contactEmail) throw new Error('Enter a company name or sponsor email first.');
  return sponsorHistory_(readObjects_(SF.SHEETS.REQUESTS), {
    companyName: companyName,
    contactEmail: contactEmail
  });
}

function createRequest_(p) {
  return withWriteLock_(function () {
    const requesterName = requireText_(p.requesterName, 'Your name', 2, 80);
    const requesterRole = optionalText_(p.requesterRole, 80);
    const template = findObjectById_(SF.SHEETS.TEMPLATES, requireText_(p.templateId, 'Template', 1, 80));
    if (!template || !toBool_(template.active)) throw new Error('The selected email template is no longer available.');

    const id = makeUniqueRequestId_();
    const sponsor = resolveSponsor_(p, id, requesterName);
    const priorHistory = sponsorHistory_(readObjects_(SF.SHEETS.REQUESTS), sponsor);
    const duplicateAcknowledged = toBool_(p.duplicateAcknowledged);
    if (priorHistory.totalCount > 0 && !duplicateAcknowledged) {
      const detail = priorHistory.activeCount
        ? `${priorHistory.activeCount} active request${priorHistory.activeCount === 1 ? '' : 's'}`
        : `${priorHistory.sentCount} sent message${priorHistory.sentCount === 1 ? '' : 's'}`;
      throw new Error(`SponsorFlow found prior outreach for ${sponsor.companyName} (${detail}). Review the history warning and confirm that this is an intentional follow-up before submitting.`);
    }

    const subject = requireText_(p.subject, 'Subject', 10, 200);
    const body = requireText_(p.body, 'Email body', 100, 12000);
    if (/{{[^}]+}}/.test(subject + body)) throw new Error('Resolve every template placeholder before submitting.');

    const now = nowIso_();
    const record = {
      id: id,
      accessHash: '',
      requesterName: requesterName,
      requesterNameKey: normalizeNameKey_(requesterName),
      requesterRole: requesterRole,
      contactId: sponsor.contactId,
      companyName: sponsor.companyName,
      contactName: sponsor.contactName,
      contactEmail: sponsor.contactEmail,
      outreachType: sponsor.outreachType,
      outreachUrl: sponsor.outreachUrl,
      sponsorVerification: sponsor.verification,
      duplicateAcknowledged: String(duplicateAcknowledged),
      templateId: template.id,
      templateName: template.name,
      subject: subject,
      body: body,
      status: 'PENDING_REVIEW',
      adminComment: '',
      revisionNumber: '1',
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
      sentAt: ''
    };
    appendObject_(SF.SHEETS.REQUESTS, record);
    appendRevision_(record, 'MEMBER', requesterName, '', 'PENDING_REVIEW');
    appendAudit_(
      id,
      'REQUEST_SUBMITTED',
      requesterName,
      `Revision 1 for ${sponsor.companyName} (${sponsor.verification}); prior outreach: ${priorHistory.totalCount}; duplicate confirmed: ${duplicateAcknowledged}`
    );
    return {
      requestId: id,
      status: record.status,
      sponsorVerification: sponsor.verification,
      outreachType: sponsor.outreachType,
      priorHistory: priorHistory
    };
  });
}

function resolveSponsor_(p, requestId, requesterName) {
  const mode = String(p.sponsorMode || 'directory').toLowerCase();
  if (mode !== 'custom') {
    const contact = findObjectById_(SF.SHEETS.CONTACTS, requireText_(p.contactId, 'Sponsor contact', 1, 80));
    if (!contact || !toBool_(contact.verified) || !toBool_(contact.active)) throw new Error('The selected sponsor contact is no longer available.');
    const type = outreachType_(contact);
    if (type === 'EMAIL' && !contact.email) throw new Error('This sponsor contact is missing an email address.');
    if (type === 'FORM' && !contact.outreachUrl) throw new Error('This sponsor contact is missing its official application link.');
    return {
      contactId: contact.id,
      companyName: contact.companyName,
      contactName: contact.contactName,
      contactEmail: contact.email || '',
      outreachType: type,
      outreachUrl: contact.outreachUrl || '',
      verification: 'VERIFIED'
    };
  }

  const companyName = requireText_(p.customCompanyName, 'Company name', 2, 160);
  const contactName = optionalText_(p.customContactName, 120);
  const contactEmail = requireEmail_(p.customContactEmail);
  const contacts = readObjects_(SF.SHEETS.CONTACTS);
  let existing = contacts.find(row => String(row.email || '').toLowerCase() === contactEmail);
  if (!existing) {
    const now = nowIso_();
    existing = {
      id: 'CON-' + randomCode_(10),
      companyName: companyName,
      contactName: contactName,
      email: contactEmail,
      outreachType: 'EMAIL',
      outreachUrl: '',
      category: 'Member suggestion',
      suggestedAsk: '',
      eligibility: '',
      personalizationIdea: '',
      recommendedTemplateId: '',
      notes: `Suggested by ${requesterName} in ${requestId}. Verify before approval.`,
      sourceUrl: '',
      validatedAt: '',
      validationStatus: 'MEMBER_SUGGESTION',
      verified: 'false',
      active: 'false',
      createdAt: now,
      updatedAt: now
    };
    appendObject_(SF.SHEETS.CONTACTS, existing);
    appendAudit_(requestId, 'UNVERIFIED_CONTACT_SUGGESTED', requesterName, `${companyName} <${contactEmail}>`);
  }
  const verified = toBool_(existing.verified) && toBool_(existing.active);
  return {
    contactId: existing.id,
    companyName: verified ? existing.companyName : companyName,
    contactName: verified ? existing.contactName : contactName,
    contactEmail: contactEmail,
    outreachType: 'EMAIL',
    outreachUrl: existing.outreachUrl || '',
    verification: verified ? 'VERIFIED' : 'UNVERIFIED'
  };
}

function getRequestsByName_(p) {
  const requesterName = requireText_(p.requesterName, 'Your name', 2, 80);
  const key = normalizeNameKey_(requesterName);
  return readObjects_(SF.SHEETS.REQUESTS)
    .filter(record => normalizeNameKey_(record.requesterNameKey || record.requesterName) === key)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 200)
    .map(publicRequest_);
}

function getRequestByName_(p) {
  const id = requirePattern_(String(p.requestId || '').toUpperCase(), /^REQ-[A-Z2-9]{8}$/, 'Invalid request ID.');
  const requesterName = requireText_(p.requesterName, 'Your name', 2, 80);
  const record = findObjectById_(SF.SHEETS.REQUESTS, id);
  if (!record || normalizeNameKey_(record.requesterNameKey || record.requesterName) !== normalizeNameKey_(requesterName)) {
    throw new Error('No request with that ID was found under this name.');
  }
  return publicRequest_(record);
}

function reviseRequest_(p) {
  return withWriteLock_(function () {
    const id = requirePattern_(String(p.requestId || '').toUpperCase(), /^REQ-[A-Z2-9]{8}$/, 'Invalid request ID.');
    const requesterName = requireText_(p.requesterName, 'Your name', 2, 80);
    const record = findObjectById_(SF.SHEETS.REQUESTS, id);
    if (!record || normalizeNameKey_(record.requesterNameKey || record.requesterName) !== normalizeNameKey_(requesterName)) {
      throw new Error('This request is not filed under that name.');
    }
    if (record.status !== 'CHANGES_REQUESTED') throw new Error('This request is not currently open for revision.');
    const subject = requireText_(p.subject, 'Subject', 10, 200);
    const body = requireText_(p.body, 'Email body', 100, 12000);
    if (/{{[^}]+}}/.test(subject + body)) throw new Error('Resolve every template placeholder before submitting.');
    const revisionNumber = Number(record.revisionNumber || 1) + 1;
    const now = nowIso_();
    updateObjectById_(SF.SHEETS.REQUESTS, id, {
      requesterName: requesterName,
      requesterNameKey: normalizeNameKey_(requesterName),
      requesterRole: optionalText_(p.requesterRole, 80),
      subject: subject,
      body: body,
      status: 'PENDING_REVIEW',
      revisionNumber: String(revisionNumber),
      updatedAt: now,
      submittedAt: now
    });
    const updated = findObjectById_(SF.SHEETS.REQUESTS, id);
    appendRevision_(updated, 'MEMBER', requesterName, '', 'PENDING_REVIEW');
    appendAudit_(id, 'REVISION_SUBMITTED', requesterName, `Revision ${revisionNumber}`);
    return { requestId: id, status: 'PENDING_REVIEW', revisionNumber: revisionNumber };
  });
}


function outreachType_(record) {
  const explicit = String(record.outreachType || '').toUpperCase();
  if (explicit === 'FORM' || explicit === 'EMAIL') return explicit;
  return record.email || record.contactEmail ? 'EMAIL' : 'FORM';
}

function normalizeCompanyKey_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(incorporated|inc|llc|ltd|limited|corporation|corp|company|co)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function sponsorHistory_(requests, sponsor, excludeRequestId) {
  const contactId = String(sponsor.contactId || sponsor.id || '');
  const email = String(sponsor.contactEmail || sponsor.email || '').trim().toLowerCase();
  const companyKey = normalizeCompanyKey_(sponsor.companyName);
  const matched = requests.filter(row => {
    if (excludeRequestId && row.id === excludeRequestId) return false;
    const sameContact = contactId && String(row.contactId || '') === contactId;
    const sameEmail = email && String(row.contactEmail || '').trim().toLowerCase() === email;
    const sameCompany = companyKey && normalizeCompanyKey_(row.companyName) === companyKey;
    return Boolean(sameContact || sameEmail || sameCompany);
  });

  const activeStatuses = ['PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'];
  const sentRows = matched.filter(row => row.status === 'SENT');
  const activeRows = matched.filter(row => activeStatuses.indexOf(row.status) !== -1);
  const sorted = matched.slice().sort((a, b) =>
    String(b.sentAt || b.updatedAt || b.createdAt).localeCompare(String(a.sentAt || a.updatedAt || a.createdAt))
  );
  const last = sorted[0] || null;
  const lastSent = sentRows.slice().sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)))[0] || null;
  let state = 'AVAILABLE';
  if (activeRows.length) state = 'ACTIVE';
  else if (sentRows.length) state = 'SENT';
  else if (matched.length) state = 'PREVIOUS';

  return {
    state: state,
    totalCount: matched.length,
    sentCount: sentRows.length,
    activeCount: activeRows.length,
    lastStatus: last ? last.status : '',
    lastActivityAt: last ? (last.sentAt || last.updatedAt || last.createdAt || '') : '',
    lastSentAt: lastSent ? (lastSent.sentAt || lastSent.updatedAt || '') : ''
  };
}

function publicRequest_(record) {
  return {
    id: record.id,
    requesterName: record.requesterName,
    requesterRole: record.requesterRole,
    contactId: record.contactId,
    companyName: record.companyName,
    contactName: record.contactName,
    outreachType: outreachType_(record),
    outreachUrl: record.outreachUrl || '',
    sponsorVerification: sponsorVerification_(record),
    duplicateAcknowledged: toBool_(record.duplicateAcknowledged),
    templateId: record.templateId,
    templateName: record.templateName,
    subject: record.subject,
    body: record.body,
    status: record.status,
    adminComment: record.adminComment,
    revisionNumber: Number(record.revisionNumber || 1),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    sentAt: record.sentAt
  };
}

function buildPublicStats_(requests) {
  const sent = requests.filter(row => row.status === 'SENT');
  const pending = requests.filter(row => ['PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'].indexOf(row.status) !== -1);
  return {
    totalRequests: requests.length,
    totalSent: sent.length,
    totalPending: pending.length,
    participatingMembers: memberNames_(requests).length,
    leadersSent: leaderboard_(sent),
    leadersPending: leaderboard_(pending),
    timeline: sentTimeline_(sent)
  };
}

function memberNames_(requests) {
  const names = new Map();
  requests.forEach(row => {
    const key = normalizeNameKey_(row.requesterNameKey || row.requesterName);
    if (!key) return;
    const current = names.get(key);
    if (!current || String(row.updatedAt) > String(current.updatedAt)) names.set(key, { name: row.requesterName, updatedAt: row.updatedAt });
  });
  return Array.from(names.values()).map(item => item.name).sort((a, b) => a.localeCompare(b));
}

function leaderboard_(rows) {
  const counts = new Map();
  rows.forEach(row => {
    const key = normalizeNameKey_(row.requesterNameKey || row.requesterName);
    if (!key) return;
    const current = counts.get(key) || { name: row.requesterName, count: 0, updatedAt: '' };
    current.count += 1;
    if (String(row.updatedAt) >= String(current.updatedAt)) {
      current.name = row.requesterName;
      current.updatedAt = row.updatedAt;
    }
    counts.set(key, current);
  });
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8)
    .map(item => ({ name: item.name, count: item.count }));
}

function sentTimeline_(rows) {
  const months = new Map();
  rows.forEach(row => {
    const date = new Date(row.sentAt || row.updatedAt || row.createdAt);
    if (isNaN(date.getTime())) return;
    const key = Utilities.formatDate(date, 'UTC', 'yyyy-MM');
    months.set(key, (months.get(key) || 0) + 1);
  });
  const recorded = Array.from(months.keys()).sort();
  if (!recorded.length) return [];
  const startParts = recorded[0].split('-').map(Number);
  const endParts = recorded[recorded.length - 1].split('-').map(Number);
  const cursor = new Date(Date.UTC(startParts[0], startParts[1] - 1, 1));
  const end = new Date(Date.UTC(endParts[0], endParts[1] - 1, 1));
  const points = [];
  let cumulative = 0;
  while (cursor <= end) {
    const key = Utilities.formatDate(cursor, 'UTC', 'yyyy-MM');
    const count = months.get(key) || 0;
    cumulative += count;
    points.push({ month: key, count: count, cumulative: cumulative });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return points;
}

function sponsorVerification_(record) {
  const explicit = String(record.sponsorVerification || '').toUpperCase();
  if (explicit === 'VERIFIED' || explicit === 'UNVERIFIED') return explicit;
  return record.contactId ? 'VERIFIED' : 'UNVERIFIED';
}

// -------------------------- Admin dashboard server API --------------------------

function adminLogin(password) {
  ensureConfigured_();
  const cache = CacheService.getScriptCache();
  const failures = Number(cache.get('ADMIN_LOGIN_FAILURES') || 0);
  if (failures >= 12) throw new Error('Too many failed login attempts. Wait ten minutes and try again.');
  const props = PropertiesService.getScriptProperties();
  const expected = props.getProperty('ADMIN_PASSWORD_HASH');
  const actual = sha256_(props.getProperty('ADMIN_PASSWORD_SALT') + String(password || ''));
  if (!constantTimeEqual_(expected, actual)) {
    cache.put('ADMIN_LOGIN_FAILURES', String(failures + 1), 600);
    throw new Error('Incorrect admin password.');
  }
  cache.remove('ADMIN_LOGIN_FAILURES');
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  cache.put('ADMIN_SESSION_' + sha256_(token), nowIso_(), SF.SESSION_SECONDS);
  return { token: token, expiresInSeconds: SF.SESSION_SECONDS };
}

function adminLogout(token) {
  if (token) CacheService.getScriptCache().remove('ADMIN_SESSION_' + sha256_(String(token)));
  return true;
}

function getAdminData(token) {
  requireAdminToken_(token);
  const rawRequests = readObjects_(SF.SHEETS.REQUESTS);
  const requests = rawRequests
    .map(row => Object.assign({}, row, {
      outreachType: outreachType_(row),
      sponsorVerification: sponsorVerification_(row),
      duplicateAcknowledged: toBool_(row.duplicateAcknowledged),
      revisionNumber: Number(row.revisionNumber || 1),
      priorOutreach: sponsorHistory_(rawRequests, row, row.id)
    }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const contacts = readObjects_(SF.SHEETS.CONTACTS)
    .map(row => Object.assign({}, row, {
      outreachType: outreachType_(row),
      history: sponsorHistory_(rawRequests, {
        contactId: row.id,
        companyName: row.companyName,
        contactEmail: row.email
      })
    }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
  const templates = readObjects_(SF.SHEETS.TEMPLATES);
  return {
    requests: requests,
    contacts: contacts,
    templates: templates,
    clubEmail: 'asmeindy@purdue.edu',
    researchValidatedAt: SF.RESEARCH_VALIDATED_AT
  };
}

function adminUpdateRequest(token, requestId, nextStatus, comment) {
  requireAdminToken_(token);
  return withWriteLock_(function () {
    const id = requireText_(requestId, 'Request ID', 1, 80);
    const status = String(nextStatus || '').toUpperCase();
    const allowed = ['CHANGES_REQUESTED', 'APPROVED', 'SENT', 'REJECTED'];
    if (allowed.indexOf(status) === -1) throw new Error('Invalid request status.');
    const record = findObjectById_(SF.SHEETS.REQUESTS, id);
    if (!record) throw new Error('Request not found.');
    if (record.status === 'SENT') throw new Error('A sent request cannot be changed.');
    if ((status === 'APPROVED' || status === 'SENT') && sponsorVerification_(record) !== 'VERIFIED') {
      throw new Error('Verify the sponsor email before approving or marking this request sent.');
    }
    if (status === 'SENT' && record.status !== 'APPROVED') {
      throw new Error('Approve the request before marking it sent.');
    }
    const cleanComment = optionalText_(comment, 2000);
    if ((status === 'CHANGES_REQUESTED' || status === 'REJECTED') && cleanComment.length < 4) {
      throw new Error('Add a helpful comment before sending the request back or rejecting it.');
    }
    const updates = { status: status, adminComment: cleanComment, updatedAt: nowIso_() };
    if (status === 'SENT') updates.sentAt = nowIso_();
    updateObjectById_(SF.SHEETS.REQUESTS, id, updates);
    const updated = findObjectById_(SF.SHEETS.REQUESTS, id);
    appendRevision_(updated, 'ADMIN', 'SponsorFlow Admin', cleanComment, status);
    appendAudit_(id, 'STATUS_' + status, 'SponsorFlow Admin', cleanComment);
    return publicRequest_(updated);
  });
}

function adminVerifySponsor(token, requestId) {
  requireAdminToken_(token);
  return withWriteLock_(function () {
    const id = requireText_(requestId, 'Request ID', 1, 80);
    const request = findObjectById_(SF.SHEETS.REQUESTS, id);
    if (!request) throw new Error('Request not found.');
    const email = requireEmail_(request.contactEmail);
    const contacts = readObjects_(SF.SHEETS.CONTACTS);
    let contact = contacts.find(row => String(row.email || '').toLowerCase() === email);
    const now = nowIso_();
    if (contact) {
      updateObjectById_(SF.SHEETS.CONTACTS, contact.id, {
        companyName: request.companyName,
        contactName: request.contactName,
        email: email,
        outreachType: 'EMAIL',
        validationStatus: contact.validationStatus || 'OFFICER_VERIFIED',
        validatedAt: contact.validatedAt || now.slice(0, 10),
        verified: 'true',
        active: 'true',
        updatedAt: now
      });
    } else {
      contact = {
        id: 'CON-' + randomCode_(10),
        companyName: request.companyName,
        contactName: request.contactName,
        email: email,
        outreachType: 'EMAIL',
        outreachUrl: '',
        category: 'Member suggestion',
        suggestedAsk: '',
        eligibility: '',
        personalizationIdea: '',
        recommendedTemplateId: '',
        notes: `Verified from request ${id}.`,
        sourceUrl: '',
        validatedAt: now.slice(0, 10),
        validationStatus: 'OFFICER_VERIFIED',
        verified: 'true',
        active: 'true',
        createdAt: now,
        updatedAt: now
      };
      appendObject_(SF.SHEETS.CONTACTS, contact);
    }
    markRequestsVerifiedByEmail_(email, contact.id);
    appendAudit_(id, 'SPONSOR_VERIFIED', 'SponsorFlow Admin', `${request.companyName} <${email}>`);
    return true;
  });
}

function adminSaveContact(token, data) {
  requireAdminToken_(token);
  return withWriteLock_(function () {
    data = data || {};
    const existingId = optionalText_(data.id, 80);
    const id = existingId || ('CON-' + randomCode_(10));
    const now = nowIso_();
    const email = optionalEmail_(data.email);
    const outreachUrl = optionalUrl_(data.outreachUrl);
    const requestedType = String(data.outreachType || '').toUpperCase();
    const outreachType = requestedType === 'FORM' ? 'FORM' : requestedType === 'EMAIL' ? 'EMAIL' : (email ? 'EMAIL' : 'FORM');
    if (outreachType === 'EMAIL' && !email) throw new Error('Enter an email address for an email outreach route.');
    if (outreachType === 'FORM' && !outreachUrl) throw new Error('Enter the official application URL for a form outreach route.');

    const record = {
      id: id,
      companyName: requireText_(data.companyName, 'Company name', 2, 160),
      contactName: optionalText_(data.contactName, 120),
      email: email,
      outreachType: outreachType,
      outreachUrl: outreachUrl,
      category: optionalText_(data.category, 100),
      suggestedAsk: optionalText_(data.suggestedAsk, 1200),
      eligibility: optionalText_(data.eligibility, 1600),
      personalizationIdea: optionalText_(data.personalizationIdea, 1600),
      recommendedTemplateId: optionalText_(data.recommendedTemplateId, 80),
      notes: optionalText_(data.notes, 2500),
      sourceUrl: optionalUrl_(data.sourceUrl),
      validatedAt: optionalDateText_(data.validatedAt),
      validationStatus: optionalText_(data.validationStatus, 80) || (toBool_(data.verified) ? 'OFFICER_VERIFIED' : 'UNVERIFIED'),
      verified: String(toBool_(data.verified)),
      active: String(data.active === false || String(data.active).toLowerCase() === 'false' ? false : true),
      updatedAt: now
    };
    if (existingId) {
      if (!findObjectById_(SF.SHEETS.CONTACTS, existingId)) throw new Error('Contact not found.');
      updateObjectById_(SF.SHEETS.CONTACTS, existingId, record);
    } else {
      record.createdAt = now;
      appendObject_(SF.SHEETS.CONTACTS, record);
    }
    if (toBool_(record.verified) && record.email) markRequestsVerifiedByEmail_(record.email, id);
    appendAudit_('', existingId ? 'CONTACT_UPDATED' : 'CONTACT_CREATED', 'SponsorFlow Admin', `${record.companyName} (${record.outreachType})`);
    return findObjectById_(SF.SHEETS.CONTACTS, id);
  });
}

function adminSaveTemplate(token, data) {
  requireAdminToken_(token);
  return withWriteLock_(function () {
    data = data || {};
    const existingId = optionalText_(data.id, 80);
    const id = existingId || ('TPL-' + randomCode_(10));
    const now = nowIso_();
    const record = {
      id: id,
      name: requireText_(data.name, 'Template name', 2, 160),
      category: requireText_(data.category, 'Template category', 2, 80),
      description: optionalText_(data.description, 600),
      subjectTemplate: requireText_(data.subjectTemplate, 'Subject template', 5, 300),
      bodyTemplate: requireText_(data.bodyTemplate, 'Body template', 100, 15000),
      active: String(data.active === false || String(data.active).toLowerCase() === 'false' ? false : true),
      updatedAt: now
    };
    if (existingId) {
      if (!findObjectById_(SF.SHEETS.TEMPLATES, existingId)) throw new Error('Template not found.');
      updateObjectById_(SF.SHEETS.TEMPLATES, existingId, record);
    } else {
      record.createdAt = now;
      appendObject_(SF.SHEETS.TEMPLATES, record);
    }
    appendAudit_('', existingId ? 'TEMPLATE_UPDATED' : 'TEMPLATE_CREATED', 'SponsorFlow Admin', record.name);
    return findObjectById_(SF.SHEETS.TEMPLATES, id);
  });
}

function requireAdminToken_(token) {
  token = String(token || '');
  if (token.length < 40) throw new Error('Your admin session has expired. Sign in again.');
  const cache = CacheService.getScriptCache();
  const key = 'ADMIN_SESSION_' + sha256_(token);
  if (!cache.get(key)) throw new Error('Your admin session has expired. Sign in again.');
  cache.put(key, nowIso_(), SF.SESSION_SECONDS);
}

function markRequestsVerifiedByEmail_(email, contactId) {
  const sheet = sheet_(SF.SHEETS.REQUESTS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  const headers = values[0].map(String);
  const emailIndex = headers.indexOf('contactEmail');
  const verificationIndex = headers.indexOf('sponsorVerification');
  const contactIdIndex = headers.indexOf('contactId');
  if (emailIndex < 0 || verificationIndex < 0) return;
  let changed = false;
  for (let row = 1; row < values.length; row += 1) {
    if (String(decodeCell_(values[row][emailIndex])).toLowerCase() !== String(email).toLowerCase()) continue;
    values[row][verificationIndex] = 'VERIFIED';
    if (contactIdIndex >= 0) values[row][contactIdIndex] = contactId;
    changed = true;
  }
  if (changed) sheet.getRange(1, 1, values.length, headers.length).setValues(values);
}

// -------------------------- Collaborative project planner --------------------------

function seedDefaultPlannerStructure_() {
  ensureSchema_();
  const now = nowIso_();
  let teamsCreated = 0;
  let teamsUpdated = 0;
  let boardsCreated = 0;
  let boardsUpdated = 0;
  let tasksCreated = 0;
  let tasksUpdated = 0;

  DEFAULT_PLANNER_TEAMS.forEach(team => {
    const existing = findObjectById_(SF.SHEETS.PLANNER_TEAMS, team.id);
    if (existing) {
      updateObjectById_(SF.SHEETS.PLANNER_TEAMS, team.id, Object.assign({}, team, { active: 'true', updatedBy: 'SponsorFlow v5 migration', updatedAt: now }));
      teamsUpdated += 1;
    } else {
      appendObject_(SF.SHEETS.PLANNER_TEAMS, Object.assign({}, team, {
        active: 'true', createdBy: 'SponsorFlow setup', updatedBy: 'SponsorFlow setup',
        createdAt: now, updatedAt: now
      }));
      teamsCreated += 1;
    }
  });

  DEFAULT_PLANNER_BOARDS.forEach(board => {
    const existing = findObjectById_(SF.SHEETS.PLANNER_BOARDS, board.id);
    const record = Object.assign({}, board, {
      targetStart: board.targetStart || (existing ? existing.targetStart : ''),
      targetEnd: board.targetEnd || (existing ? existing.targetEnd : ''),
      active: 'true', updatedBy: 'SponsorFlow v5 migration', updatedAt: now
    });
    if (existing) {
      updateObjectById_(SF.SHEETS.PLANNER_BOARDS, board.id, record);
      boardsUpdated += 1;
    } else {
      appendObject_(SF.SHEETS.PLANNER_BOARDS, Object.assign({}, record, { createdBy: 'SponsorFlow setup', createdAt: now }));
      boardsCreated += 1;
    }
  });

  DEFAULT_FUNDING_TASKS.forEach(task => {
    const existing = findObjectById_(SF.SHEETS.PLANNER_TASKS, task.id);
    const researchFields = {
      boardId: task.boardId, title: task.title, description: task.description, tags: task.tags,
      taskType: task.taskType, campus: task.campus, fundingMin: task.fundingMin,
      fundingMax: task.fundingMax, fundingAmountLabel: task.fundingAmountLabel,
      sourceUrl: task.sourceUrl, sourceConfidence: task.sourceConfidence,
      requirements: task.requirements, isMilestone: task.isMilestone,
      dependencyIds: task.dependencyIds, updatedBy: 'SponsorFlow v5 research', updatedAt: now,
      archived: 'false'
    };
    if (existing) {
      updateObjectById_(SF.SHEETS.PLANNER_TASKS, task.id, researchFields);
      tasksUpdated += 1;
    } else {
      appendObject_(SF.SHEETS.PLANNER_TASKS, Object.assign({}, task, {
        sortOrder: String(Date.now() + tasksCreated), commentCount: '0',
        createdBy: 'SponsorFlow v5 research', updatedBy: 'SponsorFlow v5 research',
        createdAt: now, updatedAt: now, completedAt: '', archived: 'false'
      }));
      appendPlannerActivity_(task.id, task.boardId, 'TASK_CREATED', 'SponsorFlow v5 research', `${task.title} · research-backed funding calendar`);
      tasksCreated += 1;
    }
  });

  PropertiesService.getScriptProperties().setProperty('PLANNER_SCHEMA_VERSION', SF.VERSION);
  return { teamsCreated, teamsUpdated, boardsCreated, boardsUpdated, tasksCreated, tasksUpdated };
}

function plannerBootstrap_() {
  if (readObjects_(SF.SHEETS.PLANNER_TEAMS).length === 0) {
    withWriteLock_(function () { seedDefaultPlannerStructure_(); });
  }

  const teams = readObjects_(SF.SHEETS.PLANNER_TEAMS)
    .filter(row => toBool_(row.active))
    .map(plannerTeamPublic_)
    .sort((a, b) => a.name.localeCompare(b.name));
  const teamIds = new Set(teams.map(team => team.id));

  const boards = readObjects_(SF.SHEETS.PLANNER_BOARDS)
    .filter(row => toBool_(row.active) && teamIds.has(row.teamId))
    .map(plannerBoardPublic_)
    .sort((a, b) => a.name.localeCompare(b.name));
  const boardIds = new Set(boards.map(board => board.id));

  const commentCounts = {};
  readObjects_(SF.SHEETS.PLANNER_COMMENTS).forEach(comment => {
    commentCounts[comment.taskId] = (commentCounts[comment.taskId] || 0) + 1;
  });

  const tasks = readObjects_(SF.SHEETS.PLANNER_TASKS)
    .filter(row => boardIds.has(row.boardId) && !toBool_(row.archived))
    .map(row => plannerTaskPublic_(row, commentCounts[row.id] || Number(row.commentCount || 0)))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.title.localeCompare(b.title));

  return { teams: teams, boards: boards, tasks: tasks, version: SF.VERSION };
}

function savePlannerTeam_(p) {
  return withWriteLock_(function () {
    const actor = plannerActor_(p.actorName);
    const existingId = optionalText_(p.id, 80);
    const existing = existingId ? findObjectById_(SF.SHEETS.PLANNER_TEAMS, existingId) : null;
    if (existingId && !existing) throw new Error('Team not found. Refresh the planner and try again.');
    const id = existingId || makePlannerId_('TEAM', SF.SHEETS.PLANNER_TEAMS);
    const now = nowIso_();
    const name = requireText_(p.name, 'Team name', 2, 100);
    const duplicate = readObjects_(SF.SHEETS.PLANNER_TEAMS).find(row => row.id !== id && toBool_(row.active) && normalizeNameKey_(row.name) === normalizeNameKey_(name));
    if (duplicate) throw new Error('A team with that name already exists.');

    const record = {
      id: id,
      name: name,
      description: optionalText_(p.description, 600),
      icon: optionalText_(p.icon, 8).toUpperCase(),
      active: 'true',
      updatedBy: actor,
      updatedAt: now
    };
    if (existing) updateObjectById_(SF.SHEETS.PLANNER_TEAMS, id, record);
    else appendObject_(SF.SHEETS.PLANNER_TEAMS, Object.assign({}, record, { createdBy: actor, createdAt: now }));
    appendPlannerActivity_('', '', existing ? 'TEAM_UPDATED' : 'TEAM_CREATED', actor, name);
    return plannerTeamPublic_(findObjectById_(SF.SHEETS.PLANNER_TEAMS, id));
  });
}

function savePlannerBoard_(p) {
  return withWriteLock_(function () {
    const actor = plannerActor_(p.actorName);
    const teamId = requireText_(p.teamId, 'Team', 2, 80);
    const team = findObjectById_(SF.SHEETS.PLANNER_TEAMS, teamId);
    if (!team || !toBool_(team.active)) throw new Error('Choose an active planner team.');

    const existingId = optionalText_(p.id, 80);
    const existing = existingId ? findObjectById_(SF.SHEETS.PLANNER_BOARDS, existingId) : null;
    if (existingId && !existing) throw new Error('Timeline not found. Refresh the planner and try again.');
    const id = existingId || makePlannerId_('BOARD', SF.SHEETS.PLANNER_BOARDS);
    const name = requireText_(p.name, 'Timeline name', 2, 140);
    const targetStart = optionalIsoDate_(p.targetStart, 'Target start');
    const targetEnd = optionalIsoDate_(p.targetEnd, 'Target finish');
    if (targetStart && targetEnd && targetEnd < targetStart) throw new Error('Target finish must be on or after target start.');
    const duplicate = readObjects_(SF.SHEETS.PLANNER_BOARDS).find(row => row.id !== id && row.teamId === teamId && toBool_(row.active) && normalizeNameKey_(row.name) === normalizeNameKey_(name));
    if (duplicate) throw new Error('That team already has a timeline with this name.');

    const now = nowIso_();
    const record = {
      id: id,
      teamId: teamId,
      name: name,
      description: optionalText_(p.description, 800),
      targetStart: targetStart,
      targetEnd: targetEnd,
      active: 'true',
      updatedBy: actor,
      updatedAt: now
    };
    if (existing) updateObjectById_(SF.SHEETS.PLANNER_BOARDS, id, record);
    else appendObject_(SF.SHEETS.PLANNER_BOARDS, Object.assign({}, record, { createdBy: actor, createdAt: now }));
    appendPlannerActivity_('', id, existing ? 'BOARD_UPDATED' : 'BOARD_CREATED', actor, name);
    return plannerBoardPublic_(findObjectById_(SF.SHEETS.PLANNER_BOARDS, id));
  });
}

function savePlannerTask_(p) {
  return withWriteLock_(function () {
    const actor = plannerActor_(p.actorName);
    const boardId = requireText_(p.boardId, 'Timeline', 2, 80);
    const board = findObjectById_(SF.SHEETS.PLANNER_BOARDS, boardId);
    if (!board || !toBool_(board.active)) throw new Error('Choose an active timeline.');

    const existingId = optionalText_(p.id, 80);
    const existing = existingId ? findObjectById_(SF.SHEETS.PLANNER_TASKS, existingId) : null;
    if (existingId && !existing) throw new Error('Task not found. Refresh the planner and try again.');
    if (existing && existing.boardId !== boardId) throw new Error('A task cannot be moved between timelines from this editor.');
    requireFreshPlannerRecord_(existing, p.expectedUpdatedAt);

    const id = existingId || makePlannerId_('TASK', SF.SHEETS.PLANNER_TASKS);
    const taskType = requirePlannerChoice_(p.taskType || 'WORK', ['WORK', 'FUNDING', 'PURCHASE', 'MEETING'], 'task type');
    const status = requirePlannerChoice_(p.status, ['BACKLOG', 'PLANNED', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE'], 'task status');
    const priority = requirePlannerChoice_(p.priority, ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], 'priority');
    const sourceConfidence = requirePlannerChoice_(p.sourceConfidence || 'TEAM_ENTERED', ['OFFICIAL_CURRENT', 'OFFICIAL_NO_CURRENT_DEADLINE', 'VERIFY_CURRENT', 'CONTACT_REQUIRED', 'TEAM_ENTERED'], 'source confidence');
    const orderStatus = requirePlannerChoice_(p.orderStatus || 'NOT_NEEDED', ['NOT_NEEDED', 'NEEDS_SPEC', 'NEEDS_QUOTE', 'READY_TO_ORDER', 'ORDERED', 'SHIPPED', 'RECEIVED'], 'order status');
    const startDate = optionalIsoDate_(p.startDate, 'Start date');
    const dueDate = optionalIsoDate_(p.dueDate, 'Due date');
    if (startDate && dueDate && dueDate < startDate) throw new Error('Due date must be on or after the start date.');
    const fundingMinValue = String(p.fundingMin == null ? '' : p.fundingMin).trim() === '' ? null : Number(p.fundingMin);
    const fundingMaxValue = String(p.fundingMax == null ? '' : p.fundingMax).trim() === '' ? null : Number(p.fundingMax);
    if (fundingMinValue != null && fundingMaxValue != null && fundingMaxValue < fundingMinValue) throw new Error('Funding maximum must be at least the funding minimum.');

    const dependencies = parsePlannerIdList_(p.dependencyIds, 80);
    if (dependencies.indexOf(id) !== -1) throw new Error('A task cannot depend on itself.');
    validatePlannerDependencies_(boardId, id, dependencies);

    let progress = plannerInteger_(p.progress, 'Progress', 0, 100, 0);
    if (status === 'DONE') progress = 100;
    const now = nowIso_();
    const completedAt = status === 'DONE' ? (existing && existing.status === 'DONE' && existing.completedAt ? existing.completedAt : now) : '';
    const record = {
      id: id,
      boardId: boardId,
      title: requireText_(p.title, 'Task title', 2, 180),
      description: optionalText_(p.description, 4000),
      status: status,
      priority: priority,
      ownerNames: normalizePlannerList_(p.ownerNames, 300),
      startDate: startDate,
      dueDate: dueDate,
      progress: String(progress),
      isMilestone: String(toBool_(p.isMilestone)),
      tags: normalizePlannerList_(p.tags, 300),
      taskType: taskType,
      campus: optionalText_(p.campus, 120),
      fundingMin: plannerOptionalNumber_(p.fundingMin, 'Funding minimum', 0, 10000000, false),
      fundingMax: plannerOptionalNumber_(p.fundingMax, 'Funding maximum', 0, 10000000, false),
      fundingAmountLabel: optionalText_(p.fundingAmountLabel, 160),
      sourceUrl: optionalUrl_(p.sourceUrl),
      sourceConfidence: sourceConfidence,
      requirements: optionalText_(p.requirements, 3000),
      partName: optionalText_(p.partName, 180),
      partNumber: optionalText_(p.partNumber, 120),
      vendor: optionalText_(p.vendor, 160),
      quantity: plannerOptionalNumber_(p.quantity, 'Quantity', 0, 100000, true),
      estimatedCost: plannerOptionalNumber_(p.estimatedCost, 'Estimated cost', 0, 1000000, false),
      orderStatus: orderStatus,
      dependencyIds: JSON.stringify(dependencies),
      sortOrder: existing && existing.sortOrder ? existing.sortOrder : String(Date.now()),
      commentCount: existing && existing.commentCount ? existing.commentCount : '0',
      updatedBy: actor,
      updatedAt: now,
      completedAt: completedAt,
      archived: 'false'
    };

    if (existing) {
      updateObjectById_(SF.SHEETS.PLANNER_TASKS, id, record);
      appendPlannerActivity_(id, boardId, 'TASK_UPDATED', actor, summarizeTaskChanges_(existing, record));
    } else {
      appendObject_(SF.SHEETS.PLANNER_TASKS, Object.assign({}, record, { createdBy: actor, createdAt: now }));
      appendPlannerActivity_(id, boardId, 'TASK_CREATED', actor, `${record.title} · ${priority} priority · ${status}`);
    }
    return plannerTaskPublic_(findObjectById_(SF.SHEETS.PLANNER_TASKS, id));
  });
}

function movePlannerTask_(p) {
  return withWriteLock_(function () {
    const actor = plannerActor_(p.actorName);
    const taskId = requireText_(p.taskId, 'Task', 2, 80);
    const task = findObjectById_(SF.SHEETS.PLANNER_TASKS, taskId);
    if (!task || toBool_(task.archived)) throw new Error('Task not found. Refresh the planner and try again.');
    requireFreshPlannerRecord_(task, p.expectedUpdatedAt);
    const taskType = requirePlannerChoice_(p.taskType || 'WORK', ['WORK', 'FUNDING', 'PURCHASE', 'MEETING'], 'task type');
    const status = requirePlannerChoice_(p.status, ['BACKLOG', 'PLANNED', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE'], 'task status');
    const now = nowIso_();
    const previous = task.status;
    const updates = {
      status: status,
      progress: status === 'DONE' ? '100' : task.progress,
      completedAt: status === 'DONE' ? (task.completedAt || now) : '',
      updatedBy: actor,
      updatedAt: now
    };
    updateObjectById_(SF.SHEETS.PLANNER_TASKS, taskId, updates);
    appendPlannerActivity_(taskId, task.boardId, 'STATUS_CHANGED', actor, `${previous} → ${status}`);
    return plannerTaskPublic_(findObjectById_(SF.SHEETS.PLANNER_TASKS, taskId));
  });
}

function archivePlannerTask_(p) {
  return withWriteLock_(function () {
    const actor = plannerActor_(p.actorName);
    const taskId = requireText_(p.taskId, 'Task', 2, 80);
    const task = findObjectById_(SF.SHEETS.PLANNER_TASKS, taskId);
    if (!task || toBool_(task.archived)) throw new Error('Task not found.');
    requireFreshPlannerRecord_(task, p.expectedUpdatedAt);
    const now = nowIso_();
    updateObjectById_(SF.SHEETS.PLANNER_TASKS, taskId, { archived: 'true', updatedBy: actor, updatedAt: now });
    appendPlannerActivity_(taskId, task.boardId, 'TASK_ARCHIVED', actor, task.title);
    return { id: taskId, archived: true };
  });
}

function getPlannerTaskDetail_(p) {
  const taskId = requireText_(p.taskId, 'Task', 2, 80);
  const task = findObjectById_(SF.SHEETS.PLANNER_TASKS, taskId);
  if (!task || toBool_(task.archived)) throw new Error('Task not found.');
  const comments = readObjects_(SF.SHEETS.PLANNER_COMMENTS)
    .filter(row => row.taskId === taskId)
    .map(row => ({ id: row.id, taskId: row.taskId, authorName: row.authorName, body: row.body, createdAt: row.createdAt }))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const activity = readObjects_(SF.SHEETS.PLANNER_ACTIVITY)
    .filter(row => row.taskId === taskId)
    .map(row => ({ id: row.id, action: row.action, actor: row.actor, details: row.details, createdAt: row.createdAt }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 100);
  return { task: plannerTaskPublic_(task, comments.length), comments: comments, activity: activity };
}

function addPlannerComment_(p) {
  return withWriteLock_(function () {
    const actor = plannerActor_(p.actorName);
    const taskId = requireText_(p.taskId, 'Task', 2, 80);
    const task = findObjectById_(SF.SHEETS.PLANNER_TASKS, taskId);
    if (!task || toBool_(task.archived)) throw new Error('Task not found.');
    const body = requireText_(p.body, 'Comment', 2, 1500);
    const now = nowIso_();
    appendObject_(SF.SHEETS.PLANNER_COMMENTS, { id: makePlannerId_('COMMENT', SF.SHEETS.PLANNER_COMMENTS), taskId: taskId, authorName: actor, body: body, createdAt: now });
    const count = readObjects_(SF.SHEETS.PLANNER_COMMENTS).filter(row => row.taskId === taskId).length;
    updateObjectById_(SF.SHEETS.PLANNER_TASKS, taskId, { commentCount: String(count) });
    appendPlannerActivity_(taskId, task.boardId, 'COMMENT_ADDED', actor, body.length > 120 ? body.slice(0, 117) + '…' : body);
    return getPlannerTaskDetail_({ taskId: taskId });
  });
}

function plannerTeamPublic_(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    icon: row.icon || '',
    active: toBool_(row.active),
    createdBy: row.createdBy || '',
    updatedBy: row.updatedBy || '',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || ''
  };
}

function plannerBoardPublic_(row) {
  return {
    id: row.id,
    teamId: row.teamId,
    name: row.name,
    description: row.description || '',
    targetStart: row.targetStart || '',
    targetEnd: row.targetEnd || '',
    active: toBool_(row.active),
    createdBy: row.createdBy || '',
    updatedBy: row.updatedBy || '',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || ''
  };
}

function plannerTaskPublic_(row, commentCount) {
  return {
    id: row.id,
    boardId: row.boardId,
    title: row.title,
    description: row.description || '',
    status: row.status || 'PLANNED',
    priority: row.priority || 'MEDIUM',
    ownerNames: row.ownerNames || '',
    startDate: row.startDate || '',
    dueDate: row.dueDate || '',
    progress: Number(row.progress || 0),
    isMilestone: toBool_(row.isMilestone),
    tags: row.tags || '',
    taskType: row.taskType || 'WORK',
    campus: row.campus || '',
    fundingMin: row.fundingMin === '' ? '' : Number(row.fundingMin),
    fundingMax: row.fundingMax === '' ? '' : Number(row.fundingMax),
    fundingAmountLabel: row.fundingAmountLabel || '',
    sourceUrl: row.sourceUrl || '',
    sourceConfidence: row.sourceConfidence || 'TEAM_ENTERED',
    requirements: row.requirements || '',
    partName: row.partName || '',
    partNumber: row.partNumber || '',
    vendor: row.vendor || '',
    quantity: row.quantity === '' ? '' : Number(row.quantity),
    estimatedCost: row.estimatedCost === '' ? '' : Number(row.estimatedCost),
    orderStatus: row.orderStatus || 'NOT_NEEDED',
    dependencyIds: parsePlannerIdList_(row.dependencyIds, 80),
    sortOrder: Number(row.sortOrder || 0),
    commentCount: Number(commentCount == null ? row.commentCount || 0 : commentCount),
    createdBy: row.createdBy || '',
    updatedBy: row.updatedBy || '',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
    completedAt: row.completedAt || '',
    archived: toBool_(row.archived)
  };
}

function validatePlannerDependencies_(boardId, taskId, dependencies) {
  const boardTasks = readObjects_(SF.SHEETS.PLANNER_TASKS).filter(row => row.boardId === boardId && !toBool_(row.archived));
  const available = new Set(boardTasks.map(row => row.id));
  dependencies.forEach(id => {
    if (!available.has(id)) throw new Error('One of the selected dependencies is no longer available on this timeline.');
  });

  const graph = {};
  boardTasks.forEach(row => graph[row.id] = parsePlannerIdList_(row.dependencyIds, 80));
  graph[taskId] = dependencies.slice();
  const visiting = {};
  const visited = {};
  function visit(id) {
    if (visiting[id]) throw new Error('These dependencies create a circular chain. Remove one of the links.');
    if (visited[id]) return;
    visiting[id] = true;
    (graph[id] || []).forEach(visit);
    visiting[id] = false;
    visited[id] = true;
  }
  Object.keys(graph).forEach(visit);
}

function requireFreshPlannerRecord_(existing, expectedUpdatedAt) {
  if (!existing) return;
  const expected = String(expectedUpdatedAt || '').trim();
  if (expected && String(existing.updatedAt || '') !== expected) {
    throw new Error('Someone else updated this task while you were editing. Refresh the planner, review their changes, and try again.');
  }
}

function summarizeTaskChanges_(before, after) {
  const labels = {
    title: 'title', description: 'description', status: 'status', priority: 'priority', ownerNames: 'owners',
    startDate: 'start date', dueDate: 'due date', progress: 'progress', isMilestone: 'milestone', tags: 'tags',
    taskType: 'task type', campus: 'campus', fundingMin: 'funding minimum', fundingMax: 'funding maximum',
    fundingAmountLabel: 'funding label', sourceUrl: 'source URL', sourceConfidence: 'source confidence', requirements: 'requirements',
    partName: 'part', partNumber: 'part number', vendor: 'vendor', quantity: 'quantity', estimatedCost: 'estimated cost',
    orderStatus: 'order status', dependencyIds: 'dependencies'
  };
  const changed = Object.keys(labels).filter(key => String(before[key] || '') !== String(after[key] || '')).map(key => labels[key]);
  return changed.length ? `Updated ${changed.join(', ')}` : 'Saved without field changes';
}

function appendPlannerActivity_(taskId, boardId, action, actor, details) {
  appendObject_(SF.SHEETS.PLANNER_ACTIVITY, {
    id: makePlannerId_('ACT', SF.SHEETS.PLANNER_ACTIVITY),
    taskId: taskId || '',
    boardId: boardId || '',
    action: action,
    actor: actor,
    details: details || '',
    createdAt: nowIso_()
  });
}

function plannerActor_(value) {
  return requireText_(String(value || '').trim().replace(/\s+/g, ' '), 'Your name', 2, 80);
}

function requirePlannerChoice_(value, choices, label) {
  const clean = String(value || '').trim().toUpperCase();
  if (choices.indexOf(clean) === -1) throw new Error(`Choose a valid ${label}.`);
  return clean;
}

function optionalIsoDate_(value, label) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean) || isNaN(new Date(clean + 'T00:00:00').getTime())) throw new Error(`${label} must be a valid date.`);
  return clean;
}

function plannerInteger_(value, label, min, max, fallback) {
  if (String(value || '').trim() === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${label} must be a whole number between ${min} and ${max}.`);
  return number;
}

function plannerOptionalNumber_(value, label, min, max, integerOnly) {
  const clean = String(value == null ? '' : value).trim();
  if (!clean) return '';
  const number = Number(clean);
  if (!isFinite(number) || number < min || number > max || (integerOnly && !Number.isInteger(number))) {
    throw new Error(`${label} must be ${integerOnly ? 'a whole number' : 'a number'} between ${min} and ${max}.`);
  }
  return String(integerOnly ? number : Math.round(number * 100) / 100);
}

function normalizePlannerList_(value, maxLength) {
  const values = String(value || '').split(/[,;]+/).map(item => item.trim()).filter(Boolean);
  const unique = [];
  const keys = {};
  values.forEach(item => {
    const key = item.toLowerCase();
    if (!keys[key]) { keys[key] = true; unique.push(item); }
  });
  const result = unique.join(', ');
  if (result.length > maxLength) throw new Error('One of the submitted list fields is too long.');
  return result;
}

function parsePlannerIdList_(value, maxItems) {
  let values = [];
  if (Array.isArray(value)) values = value;
  else {
    const text = String(value || '').trim();
    if (!text) return [];
    if (text.charAt(0) === '[') {
      try { values = JSON.parse(text); } catch (error) { throw new Error('The dependency list could not be read.'); }
    } else values = text.split(/[,;]+/);
  }
  if (!Array.isArray(values)) throw new Error('The dependency list is invalid.');
  const clean = values.map(item => String(item || '').trim()).filter(Boolean);
  if (clean.length > maxItems) throw new Error('Too many dependencies were selected.');
  const unique = [];
  const seen = {};
  clean.forEach(id => {
    if (!/^[A-Z0-9-]{4,80}$/i.test(id)) throw new Error('A dependency identifier is invalid.');
    if (!seen[id]) { seen[id] = true; unique.push(id); }
  });
  return unique;
}

function makePlannerId_(prefix, sheetName) {
  let id = '';
  do { id = prefix + '-' + randomCode_(10); } while (findObjectById_(sheetName, id));
  return id;
}


// -------------------------- Storage helpers --------------------------

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SponsorFlow spreadsheet is not configured.');
  return SpreadsheetApp.openById(id);
}

function sheet_(name) {
  const sheet = spreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error(`Missing sheet: ${name}`);
  return sheet;
}

function readObjects_(name) {
  const sheet = sheet_(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(value => value !== '')).map(row => {
    const object = {};
    headers.forEach((header, index) => object[header] = decodeCell_(row[index]));
    return object;
  });
}

function appendObject_(name, object) {
  const sheet = sheet_(name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(String);
  const values = headers.map(header => encodeCell_(object[header] == null ? '' : object[header]));
  sheet.appendRow(values);
}

function findObjectById_(name, id) {
  return readObjects_(name).find(row => row.id === id) || null;
}

function updateObjectById_(name, id, updates) {
  const sheet = sheet_(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('Record not found.');
  const headers = values[0].map(String);
  const idIndex = headers.indexOf('id');
  const rowIndex = values.findIndex((row, index) => index > 0 && decodeCell_(row[idIndex]) === id);
  if (rowIndex < 1) throw new Error('Record not found.');
  Object.keys(updates).forEach(key => {
    const columnIndex = headers.indexOf(key);
    if (columnIndex >= 0) values[rowIndex][columnIndex] = encodeCell_(updates[key]);
  });
  sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([values[rowIndex]]);
}

function appendRevision_(request, actorType, actorName, comment, status) {
  appendObject_(SF.SHEETS.REVISIONS, {
    id: 'REV-' + randomCode_(12),
    requestId: request.id,
    revisionNumber: request.revisionNumber,
    actorType: actorType,
    actorName: actorName,
    subject: request.subject,
    body: request.body,
    comment: comment,
    status: status,
    createdAt: nowIso_()
  });
}

function appendAudit_(requestId, action, actor, details) {
  appendObject_(SF.SHEETS.AUDIT, {
    id: 'AUD-' + randomCode_(12),
    requestId: requestId,
    action: action,
    actor: actor,
    details: details,
    createdAt: nowIso_()
  });
}

function withWriteLock_(callback) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('SponsorFlow is busy. Try again in a moment.');
  try { return callback(); } finally { lock.releaseLock(); }
}

// -------------------------- Validation and utility helpers --------------------------

function sha256_(value) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return digest.map(byte => (byte + 256).toString(16).slice(-2)).join('');
}

function constantTimeEqual_(left, right) {
  left = String(left || '');
  right = String(right || '');
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function requireText_(value, label, minLength, maxLength) {
  const clean = String(value || '').trim().replace(/\r\n/g, '\n');
  if (clean.length < minLength) throw new Error(`${label} is required.`);
  if (clean.length > maxLength) throw new Error(`${label} is too long.`);
  return clean;
}

function optionalText_(value, maxLength) {
  const clean = String(value || '').trim().replace(/\r\n/g, '\n');
  if (clean.length > maxLength) throw new Error('One of the submitted fields is too long.');
  return clean;
}

function requirePattern_(value, pattern, message) {
  const clean = String(value || '').trim();
  if (!pattern.test(clean)) throw new Error(message);
  return clean;
}

function requireEmail_(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid sponsor email address.');
  return email;
}


function optionalEmail_(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid sponsor email address.');
  return email;
}

function optionalUrl_(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (!/^https:\/\/[^\s]+$/i.test(url) || url.length > 1000) throw new Error('Enter a valid HTTPS URL.');
  return url;
}

function optionalDateText_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Validated date must use YYYY-MM-DD.');
  return text;
}

function normalizeNameKey_(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function makeUniqueRequestId_() {
  let id = '';
  do { id = 'REQ-' + randomCode_(8); } while (findObjectById_(SF.SHEETS.REQUESTS, id));
  return id;
}

function randomCode_(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let output = '';
  while (output.length < length) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random());
    bytes.forEach(byte => {
      if (output.length < length) output += alphabet[(byte + 256) % alphabet.length];
    });
  }
  return output;
}

function nowIso_() {
  return new Date().toISOString();
}

function toBool_(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function encodeCell_(value) {
  if (value instanceof Date) value = value.toISOString();
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function decodeCell_(value) {
  if (value instanceof Date) return value.toISOString();
  const text = String(value == null ? '' : value);
  return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
}

function cleanError_(error) {
  return error && error.message ? String(error.message) : 'The request could not be completed.';
}
