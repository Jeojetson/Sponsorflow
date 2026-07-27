/**
 * ASME Indy SponsorFlow — Google Apps Script backend
 * Version 3: duplicate-outreach protection, official sponsor programs,
 * outreach-route support, name-based request access, and club statistics.
 */

const SF = Object.freeze({
  VERSION: '3.0.0',
  RESEARCH_VALIDATED_AT: '2026-07-27',
  SESSION_SECONDS: 3600,
  SHEETS: {
    CONTACTS: 'Contacts',
    TEMPLATES: 'Templates',
    REQUESTS: 'Requests',
    REVISIONS: 'Revisions',
    AUDIT: 'Audit'
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
    Audit: ['id', 'requestId', 'action', 'actor', 'details', 'createdAt']
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

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SponsorFlow')
    .addItem('Initial setup', 'showInitialSetup')
    .addItem('Upgrade to v3 + import sponsor research', 'upgradeSponsorFlowV3')
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
  ui.alert('SponsorFlow setup is complete. Validated sponsor opportunities were added. Next, deploy this script as a web app.');
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
